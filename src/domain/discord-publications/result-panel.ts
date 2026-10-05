import {
    escapeMarkdownText,
    panelFrame,
    type MessageBlock,
    type MessageView,
} from "../discord-messages/message-view"
import { resolveClanOutcome } from "../discord-messages/match-result"
import type { ResultCardFacts } from "./result-card"
import type { ResultPanelCopy } from "./panel-copy"
import type { PanelGame } from "./settings"

/**
 * One confirmed result of the clan (L3-25..32, P6-32..38): a card per match
 * in the game's results channel. A correction edits the same card and says
 * what the score was before. Values the result does not record are left out,
 * never guessed.
 */
export type ResultCardEvent = {
    id: string
    name: string
    result: {
        status: string
        version: number
        reviewedAt: string | null
        participants: Array<{ label: string; score: number | null }>
    }
    card: ResultCardFacts | null
    /** Public match page; only when one exists. */
    matchUrl: string | null
}

export type ResultCardInput = {
    copy: ResultPanelCopy
    game: PanelGame
    /** "Hell Let Loose" or "Wardogs" in the clan language. */
    gameName: string
    /** Intl locale and zone for dates ("ne 11. 10."). */
    locale: string
    timeZone: string
    event: ResultCardEvent
    /** "Foy · den": the event's map, already in the clan language. */
    mapLabel: string | null
    /** Localized side names, e.g. Allies → "Spojenci". */
    sideName: (label: string) => string
    /** The sign before a side or faction (application emoji or fallback). */
    sideSign: (label: string) => string | undefined
    compact: boolean
    showMap: boolean
    accentColor: string | null
}

/** "ne 11. 10." in the clan's zone; null for a missing date. */
export function shortDate(
    value: string | number | null | undefined,
    locale: string,
    timeZone: string
) {
    const ms = typeof value === "number" ? value : Date.parse(value ?? "")
    if (!Number.isFinite(ms)) return null
    const format = (zone: string) =>
        new Intl.DateTimeFormat(locale, {
            weekday: "short",
            day: "numeric",
            month: "numeric",
            timeZone: zone,
        })
            .format(ms)
            .replace(/,/g, "")
            .replace(/\.\s*$/, ".")
    try {
        return format(timeZone)
    } catch {
        return format("UTC")
    }
}

const scoreText = (value: number | null) =>
    value === null ? "—" : String(value)

/** Team code of a participant by its side, else null. */
function teamOf(label: string, card: ResultCardFacts | null) {
    const key = label.trim().toLowerCase()
    return (
        card?.teams.find((team) => team.side?.trim().toLowerCase() === key)
            ?.code ?? null
    )
}

export function resultCardView(input: ResultCardInput): MessageView {
    const { copy, event } = input
    const card = event.card
    const participants = event.result.participants.slice(0, 16)
    const corrected = event.result.status === "corrected"
    const clanSide = card?.side?.trim().toLowerCase() ?? null
    const isClan = (label: string) =>
        clanSide !== null && label.trim().toLowerCase() === clanSide
    const outcome = resolveClanOutcome({
        participants,
        clanSide: card?.side,
        imported: card?.imported,
    })
    const multi = participants.length > 2 || input.game === "wardogs"
    const ranked = participants
        .map((participant, index) => ({ participant, index }))
        .sort(
            (a, b) =>
                (b.participant.score ?? -Infinity) -
                    (a.participant.score ?? -Infinity) || a.index - b.index
        )
    const clanPlace = ranked.findIndex((entry) =>
        isClan(entry.participant.label)
    )
    const league = card?.league
    const labelParts = [
        copy.label,
        card?.category ?? undefined,
        corrected
            ? copy.corrected
            : league?.fixtureNumber != null
              ? copy.match(String(league.fixtureNumber))
              : input.gameName,
    ].filter((part): part is string => Boolean(part))
    const code = (label: string) => teamOf(label, card)
    const named = (label: string) => code(label) ?? input.sideName(label)

    let title: string
    const content: MessageBlock[] = []
    if (!multi && participants.length === 2) {
        const [first, second] = participants as [
            (typeof participants)[0],
            (typeof participants)[0],
        ]
        title = `${named(first.label)} ${scoreText(first.score)} : ${scoreText(second.score)} ${named(second.label)}`
        if (!input.compact && (code(first.label) || code(second.label))) {
            const side = (label: string) => {
                const sign = input.sideSign(label)
                return `${escapeMarkdownText(input.sideName(label))}${sign ? ` ${sign}` : ""}`
            }
            content.push({
                kind: "text",
                markdown: `${side(first.label)} · ${side(second.label)}`,
            })
        }
    } else {
        const codes = ranked
            .map((entry) => code(entry.participant.label))
            .filter((value): value is string => Boolean(value))
        title =
            codes.length === participants.length && codes.length > 1
                ? codes.join(" vs ")
                : event.name
        content.push({
            kind: "list",
            marker: "none",
            items: ranked.map(({ participant }, place) => {
                const team = code(participant.label)
                const sign = input.sideSign(participant.label)
                const teamText = team
                    ? isClan(participant.label)
                        ? `**${escapeMarkdownText(team)}**`
                        : escapeMarkdownText(team)
                    : null
                return [
                    `${place + 1}.`,
                    [
                        teamText,
                        `${sign ? `${sign} ` : ""}${escapeMarkdownText(input.sideName(participant.label))}`,
                        `**${scoreText(participant.score)}** ${copy.points}`,
                    ]
                        .filter(Boolean)
                        .join(" · "),
                ].join(" ")
            }),
        })
    }

    const previous =
        corrected && card?.previous?.length
            ? card.previous.map((entry) => scoreText(entry.score)).join(" : ")
            : null
    const played = shortDate(
        card?.playedAt ?? null,
        input.locale,
        input.timeZone
    )
    const reviewed = event.result.reviewedAt
    const mapParts = input.showMap
        ? league?.map
            ? [league.map, league.zone]
                  .filter((part): part is string => Boolean(part))
                  .map((part) => escapeMarkdownText(part))
                  .join(" · ")
            : input.mapLabel
              ? escapeMarkdownText(input.mapLabel)
              : null
        : null
    const facts = (
        corrected && input.compact
            ? [
                  reviewed
                      ? copy.correctedAt(
                            `<t:${Math.floor(Date.parse(reviewed) / 1000)}:f>`,
                            previous ?? "—"
                        )
                      : null,
                  mapParts,
              ]
            : [
                  mapParts,
                  played,
                  card?.reviewer
                      ? copy.confirmedBy(escapeMarkdownText(card.reviewer))
                      : null,
                  corrected && reviewed && previous
                      ? copy.correctedAt(
                            `<t:${Math.floor(Date.parse(reviewed) / 1000)}:f>`,
                            previous
                        )
                      : null,
              ]
    ).filter((part): part is string => Boolean(part))

    const chip = multi
        ? clanPlace >= 0
            ? {
                  label: copy.place(String(clanPlace + 1)),
                  tone: "success" as const,
              }
            : null
        : outcome
          ? {
                label: copy.outcomes[outcome.outcome],
                tone:
                    outcome.outcome === "win"
                        ? ("success" as const)
                        : outcome.outcome === "loss"
                          ? ("danger" as const)
                          : ("neutral" as const),
            }
          : null

    const view = panelFrame({
        accentColor: input.accentColor,
        label: labelParts.join(" · "),
        title,
        ...(chip ? { state: { chip, detail: facts.join(" · ") } } : {}),
        content: chip
            ? content
            : [
                  ...content,
                  ...(facts.length
                      ? [{ kind: "text" as const, markdown: facts.join(" · ") }]
                      : []),
              ],
        actions: event.matchUrl
            ? [
                  [
                      {
                          kind: "link" as const,
                          url: event.matchUrl,
                          label: copy.viewMatch,
                      },
                  ],
              ]
            : [],
        updatedAt: reviewed ?? "",
    })
    if (view.footer?.kind === "managed") view.footer.updatedStyle = "f"
    return view
}
