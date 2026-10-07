import {
    DISCORD_MESSAGE_LIMITS,
    escapeMarkdownText,
    panelFrame,
    type ChipTone,
    type MessageBlock,
    type MessageButton,
    type MessageField,
    type MessageMedia,
    type MessageView,
} from "../discord-messages/message-view"
import {
    chipText,
    countLayoutComponents,
    layoutMessageView,
    layoutTextLength,
    type MessageLayoutOptions,
} from "../discord-messages/message-layout"
import type {
    LeagueFixtureView,
    LeagueFixturesView,
    LeagueStandingsView,
} from "./panels"
import {
    discordTimestamp,
    discordWeekdayTimestamp,
} from "../discord-messages/format"
import type { PanelFactionEmoji } from "../discord-publications/panel-presentation"
import { OUR_TEAM_MARKER, layoutStandingsTable } from "./standings-table"
import type { PreparationChip, PreparationTone } from "./preparation"
import { factionEmblem } from "../discord-messages/faction-emblem"
import { fitWithinLimit, LEAGUE_PANEL_REFRESH_MS } from "./panels"
import { shortDate } from "../discord-publications/result-panel"
import type { LeagueCopy, LeagueDay } from "./league-copy"
import type { LeagueLinkReplyView } from "./link-reply"

/**
 * The two WD League messages (P6-06..31) and the link reply (L3-56) as
 * Components V2 views on the shared panel frame. Every word comes from the
 * clan-language copy; League text (team names, map names, match types) is
 * escaped. Both panels fit Discord's 4,000 characters and 40 components by
 * leaving out trailing rows and saying how many more there are (P6-B05).
 */
export type LeaguePanelLook = {
    copy: LeagueCopy
    /** Intl locale of the clan language. */
    locale: string
    timeZone: string
    /** The panel's own bar colour; null is the clan colour. */
    accentColor: string | null
    /** The bot's layout options, so the fit uses exactly what Discord counts. */
    layout: MessageLayoutOptions
    /** Installed faction emoji; the neutral marker otherwise. */
    emoji: PanelFactionEmoji
    /** Chip icons per tone, as the bot lays out chips. */
    chipIcons?: Partial<Record<ChipTone, string>>
    /** The admin paused the panel (L3-54): content stays, the chip says so. */
    paused: { since: number | null } | null
    now: number
}

/** Green done, orange running, grey not yet (P6-31). */
const TONE: Record<PreparationTone, ChipTone> = {
    done: "success",
    running: "warning",
    pending: "neutral",
}

const plain = (value: string | null | undefined) =>
    value ? escapeMarkdownText(value) : ""

function fits(view: MessageView, layout: MessageLayoutOptions) {
    const laid = layoutMessageView(view, layout)
    return countLayoutComponents(laid) > DISCORD_MESSAGE_LIMITS.components
        ? Number.POSITIVE_INFINITY
        : layoutTextLength(laid)
}

/** Adds the paused chip and fixes the footer time, keeping content and links (L3-54). */
function markPaused(view: MessageView, look: LeaguePanelLook, dataAt: number) {
    if (!look.paused || !view.header) return view
    view.header.paused = {
        reason: look.copy.pausedReason,
        since: dataAt,
    }
    if (view.footer?.kind === "managed") {
        view.footer.updatedStyle = "f"
        view.footer.refreshSeconds = undefined
    }
    return view
}

/** "WD League · tabulka" (P6-07..12) or its waiting state until the first results. */
export function leagueStandingsMessage(
    view: LeagueStandingsView,
    look: LeaguePanelLook
): MessageView {
    const copy = look.copy.standings
    const dataAt = view.dataAt ? Date.parse(view.dataAt) : look.now
    const rule = view.pointsRule ? copy.rule(view.pointsRule) : copy.mixedRule
    const build = (rows: LeagueStandingsView["rows"], hidden: number) => {
        const content: MessageBlock[] =
            view.state === "ready"
                ? [
                      {
                          kind: "text",
                          markdown: `${copy.played(view.matchesCounted)} · ${rule}`,
                      },
                      {
                          kind: "text",
                          markdown: `\`\`\`ansi\n${layoutStandingsTable(rows, copy.columns, { ansi: true }).text}\n\`\`\``,
                      },
                      ...(hidden
                          ? [
                                {
                                    kind: "text" as const,
                                    markdown: copy.moreTeams(hidden),
                                },
                            ]
                          : []),
                      { kind: "text", markdown: `-# ${copy.legend}` },
                  ]
                : [
                      { kind: "text", markdown: rule },
                      { kind: "text", markdown: copy.waiting },
                  ]
        return panelFrame({
            accentColor: look.accentColor,
            label: copy.label(view.season),
            title: copy.title,
            content,
            actions: [
                [{ kind: "link", url: view.links.league, label: copy.open }],
            ],
            updatedAt: dataAt,
            footerNotes: [copy.footer],
        })
    }
    // Measured as posted: the paused chip and detail count too (L3-54, P6-B05).
    const finish = (rows: LeagueStandingsView["rows"], hidden: number) =>
        markPaused(build(rows, hidden), look, dataAt)
    const fitted = fitWithinLimit(view.rows, (rows, hidden) =>
        fits(finish([...rows], hidden), look.layout)
    )
    return finish(fitted.shown, fitted.hidden)
}

function chipLabel(chip: PreparationChip, copy: LeagueCopy["fixtures"]) {
    switch (chip.kind) {
        case "rules":
            return chip.picked !== null && chip.total !== null
                ? copy.chips.rules(chip.picked, chip.total)
                : copy.chips.rulesUnknown
        case "mapVote":
            return chip.tone === "done"
                ? copy.chips.voteDone
                : chip.tone === "running"
                  ? copy.chips.voteRunning
                  : copy.chips.votePending
        case "moderator":
            return chip.tone === "done"
                ? copy.chips.moderatorDone
                : copy.chips.moderatorPending
        case "readyCheck":
            return chip.tone === "done"
                ? copy.chips.readyDone
                : chip.tone === "running"
                  ? copy.chips.readyRunning
                  : copy.chips.readyPending
        case "notStarted":
            return copy.chips.notStarted
    }
}

/** The preparation chips of one fixture as one line (P6-25). */
export function preparationLine(
    chips: readonly PreparationChip[],
    look: Pick<LeaguePanelLook, "copy" | "chipIcons" | "locale" | "timeZone">
) {
    const copy = look.copy.fixtures
    return chips
        .map((chip) => {
            const text = chipText(
                { label: chipLabel(chip, copy), tone: TONE[chip.tone] },
                look.chipIcons
            )
            if (chip.kind !== "mapVote") return text
            if (chip.tone === "running" && chip.closesAt)
                return `${text} · ${copy.chips.voteCloses(discordTimestamp(chip.closesAt, "R")!)}`
            if (chip.tone === "pending" && chip.opensAt)
                return chipText(
                    {
                        label: copy.chips.voteFrom(
                            shortDate(
                                chip.opensAt,
                                look.locale,
                                look.timeZone
                            ) ?? ""
                        ),
                        tone: "neutral",
                    },
                    look.chipIcons
                )
            return text
        })
        .join(" · ")
}

function teamLine(
    team: LeagueFixtureView["teams"][number],
    look: LeaguePanelLook
) {
    const copy = look.copy.fixtures
    const code = `**${plain(team.code)}**`
    const name = team.name ? plain(team.name) : null
    const emblem = factionEmblem(team.faction, look.emoji)
    return [
        [
            team.ours ? `${OUR_TEAM_MARKER} ${code}` : code,
            name ? (team.ours ? `**${name}**` : name) : null,
        ]
            .filter(Boolean)
            .join(" "),
        team.nations?.length ? team.nations.map(plain).join(" ") : null,
        team.memberCount !== null ? copy.members(team.memberCount) : null,
        team.faction
            ? [emblem, plain(team.faction)].filter(Boolean).join(" ")
            : null,
    ]
        .filter(Boolean)
        .join(" · ")
}

/** One fixture as a section: header, teams, map and host, chips, link (P6-22..26). */
export function fixtureField(
    fixture: LeagueFixtureView,
    look: LeaguePanelLook,
    thumbnail?: MessageMedia
): MessageField {
    const copy = look.copy.fixtures
    const when = fixture.scheduledAt
        ? discordWeekdayTimestamp(
              fixture.scheduledAt,
              look.locale,
              look.timeZone
          )
        : undefined
    const host = fixture.host?.teamCode
        ? copy.host(plain(fixture.host.teamCode))
        : fixture.host?.mode?.toLowerCase().startsWith("league")
          ? copy.hostLeague
          : null
    const place = fixture.map
        ? [fixture.map.name, fixture.map.zone, fixture.map.lighting]
              .filter((part): part is string => Boolean(part))
              .map(plain)
              .join(" · ")
        : copy.mapAfterVote
    const lines = [
        when
            ? fixture.phase === "live"
                ? `**${when}**`
                : `**${when}** · ${discordTimestamp(fixture.scheduledAt, "R")}`
            : null,
        ...fixture.teams.map((team) => teamLine(team, look)),
        [place, host].filter(Boolean).join(" · "),
        fixture.preparation.length
            ? preparationLine(fixture.preparation, look)
            : null,
        `[${copy.detail}](${fixture.sourceUrl})`,
    ].filter((line): line is string => Boolean(line))
    return {
        title:
            [
                fixture.fixtureNumber !== null
                    ? `#${fixture.fixtureNumber}`
                    : null,
                fixture.type,
            ]
                .filter(Boolean)
                .join(" · ") || "—",
        ...(fixture.phase === "live"
            ? { chip: { label: copy.live, tone: "success" as const } }
            : {}),
        text: lines.join("\n"),
        ...(thumbnail ? { thumbnail } : {}),
    }
}

/** A day of the clan's calendar, for "3.–9. 10.". */
export function leagueDay(
    value: string | number,
    locale: string,
    timeZone: string
): LeagueDay {
    const ms = typeof value === "number" ? value : Date.parse(value)
    const parts = (zone: string) =>
        new Intl.DateTimeFormat(locale, {
            day: "numeric",
            month: "numeric",
            timeZone: zone,
        }).formatToParts(ms)
    let found: Intl.DateTimeFormatPart[]
    let zone = timeZone
    try {
        found = parts(timeZone)
    } catch {
        zone = "UTC"
        found = parts("UTC")
    }
    const number = (type: string) =>
        Number(found.find((part) => part.type === type)?.value ?? 0)
    return {
        day: number("day"),
        month: number("month"),
        monthShort: new Intl.DateTimeFormat(locale, {
            month: "short",
            timeZone: zone,
        })
            .format(ms)
            .replace(/\.$/, ""),
    }
}

function recentBlocks(
    recent: NonNullable<LeagueFixturesView["recentResults"]>,
    look: LeaguePanelLook,
    withHeading: boolean
): MessageBlock[] {
    const copy = look.copy.recent
    const rows = recent.items.map((item) => {
        const when = shortDate(item.occurredAt, look.locale, look.timeZone)
        const head = [
            item.fixtureNumber !== null ? `**#${item.fixtureNumber}**` : null,
            [when, plain(item.type)].filter(Boolean).join(" · "),
        ]
            .filter(Boolean)
            .join(" ")
        const podium = item.podium
            .map(
                (entry) =>
                    `${entry.place}. ${entry.ours ? `**${plain(entry.teamCode)}**` : plain(entry.teamCode)}`
            )
            .join("  ")
        return [head, podium].filter(Boolean).join(" · ")
    })
    const range = copy.range(
        leagueDay(recent.from, look.locale, look.timeZone),
        leagueDay(recent.to, look.locale, look.timeZone)
    )
    return [
        ...(withHeading
            ? [
                  { kind: "separator" as const, divider: true },
                  {
                      kind: "text" as const,
                      markdown: `**${copy.heading}** · ${range}`,
                  },
              ]
            : []),
        {
            kind: "text",
            markdown:
                recent.state === "waiting_for_results"
                    ? copy.waiting
                    : rows.length
                      ? rows.join("\n")
                      : copy.empty,
        },
    ]
}

/**
 * "WD League · nejbližší zápasy" with the recent results under the fixtures
 * (P6-17..31, owner decision). `thumbnails` holds the map image of fixtures
 * whose map is known (P6-24). With the fixtures switched off the message is
 * the board's "WD League · poslední výsledky".
 */
export function leagueFixturesMessage(
    view: LeagueFixturesView,
    look: LeaguePanelLook,
    options: {
        fixtures: boolean
        thumbnails?: ReadonlyMap<string, MessageMedia>
    }
): MessageView {
    const copy = look.copy.fixtures
    const recentCopy = look.copy.recent
    const dataAt = view.dataAt ? Date.parse(view.dataAt) : look.now
    const onlyResults = !options.fixtures && view.recentResults !== null
    const actions: MessageButton[] = [
        ...(options.fixtures
            ? [
                  {
                      kind: "link" as const,
                      url: view.links.fixtures,
                      label: copy.all,
                  },
              ]
            : []),
        ...(view.recentResults
            ? [
                  {
                      kind: "link" as const,
                      url: view.links.results,
                      label: recentCopy.link,
                  },
              ]
            : []),
    ]
    const build = (shown: readonly LeagueFixtureView[], hidden: number) => {
        const content: MessageBlock[] = []
        if (options.fixtures) {
            content.push({ kind: "text", markdown: copy.meta(shown.length) })
            if (shown.length)
                content.push({
                    kind: "fields",
                    items: shown.map((fixture) =>
                        fixtureField(
                            fixture,
                            look,
                            options.thumbnails?.get(fixture.matchId)
                        )
                    ),
                })
            else if (!hidden)
                content.push({ kind: "text", markdown: copy.empty })
            if (hidden)
                content.push({ kind: "text", markdown: copy.more(hidden) })
        }
        if (view.recentResults)
            content.push(
                ...recentBlocks(view.recentResults, look, options.fixtures)
            )
        return panelFrame({
            accentColor: look.accentColor,
            label: onlyResults
                ? recentCopy.label(
                      recentCopy.range(
                          leagueDay(
                              view.recentResults!.from,
                              look.locale,
                              look.timeZone
                          ),
                          leagueDay(
                              view.recentResults!.to,
                              look.locale,
                              look.timeZone
                          )
                      )
                  )
                : copy.label,
            title: onlyResults ? recentCopy.title : copy.title,
            ...(view.stale && options.fixtures
                ? {
                      state: {
                          chip: { label: copy.stale, tone: "warning" as const },
                          detail: copy.lastData(
                              discordTimestamp(dataAt, "R") ?? ""
                          ),
                      },
                  }
                : {}),
            content,
            actions: actions.length ? [actions] : [],
            updatedAt: dataAt,
            refreshSeconds: options.fixtures
                ? LEAGUE_PANEL_REFRESH_MS / 1000
                : undefined,
            footerNotes: [
                onlyResults ? look.copy.standings.footer : copy.footer,
            ],
        })
    }
    // Measured as posted: the paused chip and detail count too (L3-54, P6-B05).
    const finish = (shown: readonly LeagueFixtureView[], hidden: number) =>
        markPaused(build(shown, hidden), look, dataAt)
    const fitted = fitWithinLimit(
        view.fixtures,
        (shown, hidden) => fits(finish(shown, hidden), look.layout),
        DISCORD_MESSAGE_LIMITS.totalText,
        view.hidden
    )
    return finish(fitted.shown, fitted.hidden)
}

/**
 * The reply to a person who posted a League link (L3-56): the match, when it
 * is, where the self-updating message is, and the League page. Footer
 * "Spravováno v Logi" only.
 */
export function leagueLinkReplyMessage(
    reply: LeagueLinkReplyView,
    look: Pick<LeaguePanelLook, "copy" | "locale" | "timeZone" | "accentColor">
): MessageView {
    const copy = look.copy.reply
    const when = reply.scheduledAt
        ? discordWeekdayTimestamp(reply.scheduledAt, look.locale, look.timeZone)
        : undefined
    const buttons: MessageButton[] = [
        ...(reply.panelMessageUrl
            ? [
                  {
                      kind: "link" as const,
                      url: reply.panelMessageUrl,
                      label: copy.openPanel,
                  },
              ]
            : []),
        { kind: "link", url: reply.sourceUrl, label: copy.openLeague },
    ]
    return {
        accent: look.accentColor?.trim()
            ? { custom: look.accentColor.trim() }
            : "clan",
        header: {
            label: copy
                .label(
                    reply.fixtureNumber !== null
                        ? String(reply.fixtureNumber)
                        : ""
                )
                .trim(),
            title: reply.teamCodes.join(" vs "),
        },
        blocks: [
            ...(when
                ? [
                      {
                          kind: "text" as const,
                          markdown: `${when} · ${discordTimestamp(reply.scheduledAt, "R")}`,
                      },
                  ]
                : []),
            {
                kind: "text",
                markdown: copy.body(`<#${reply.panelChannelId}>`),
            },
            { kind: "buttons", buttons },
        ],
        footer: { kind: "managed" },
    }
}
