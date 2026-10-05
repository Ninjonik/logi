/**
 * The match announcement card in `#oznameni` (board L1 1.0–1.8): one message
 * from the announcement to the result, edited in place. Its state is a chip
 * inside the card, the bar keeps the clan colour and the category is a chip
 * next to the title (L1-02, L1-07). The bot sends this view through the
 * message kit and the dashboard previews the same view, so the new-match flow
 * shows exactly what the bot posts.
 */

import {
    announcementActions,
    fullSignupGroups,
    type AnnouncementAction,
    type AnnouncementState,
} from "@/domain/events/announcement-state"
import {
    panelFactionOf,
    type PanelFactionEmoji,
} from "@/domain/discord-publications/panel-presentation"
import { SIGNUP_NOT_ATTENDING, TRAINING_ATTEND } from "@/domain/events/types"
import { resolveClanOutcome, type ClanOutcome } from "./match-result"

import {
    escapeMarkdownText,
    type ChipTone,
    type MessageBlock,
    type MessageButton,
    type MessageChip,
    type MessageMedia,
    type MessageMetaLine,
    type MessageView,
} from "./message-view"
import {
    discordTimestamp,
    discordWeekdayTimestamp,
    fillTemplate,
    formatCount,
} from "./format"
import { formatGroupCount, type SignupGroupCount } from "./signup-counts"
import type { MatchAnnouncementCopy } from "./match-announcement-copy"
import { factionEmblem } from "./faction-emblem"
import { chipText } from "./message-layout"

/** The facts every match card (announcement, replies, sign-up list) names. */
export type MatchCardEvent = {
    kind: "match" | "training"
    eventId: string
    guildId: string
    name: string
    category?: { label: string; color?: string | null } | null
    /** Assigned teams by slot with their stored side ("Allies", "Valkyra"). */
    teams: ReadonlyArray<{ code: string; side: string | null }>
    /** The clan's side when the match has no teams. */
    side?: string | null
    /** Markdown-safe map label, "Foy · den". */
    mapLabel?: string | null
    /** A training's server name (never its password, L1-03). */
    server?: string | null
    meetingStart: string
    gameStart: string
    registrationEnd: string
    /** The clan's time zone, for the weekday of a date. */
    timeZone: string
    /** The clan language's Intl locale (`cs-CZ`). */
    locale: string
    factionEmoji?: PanelFactionEmoji
}

export type AnnouncementCounts = {
    groups: readonly SignupGroupCount[]
    /** Attending without a group: reserves of full groups or general sign-ups. */
    withoutGroup: number
    /** Everyone attending, groups and reserves together. */
    total: number
    declined: number
    /** The match offers a sign-up without a group. */
    generalSignup?: boolean
}

export type AnnouncementResult = {
    outcome: ClanOutcome | null
    /** The clan's score first when the clan is known, else as reviewed. */
    scores: [number | null, number | null] | null
    reviewer?: string | null
}

export type AnnouncementViewInput = {
    event: MatchCardEvent
    state: AnnouncementState
    counts: AnnouncementCounts
    /** Roster places and reserves once it is published. */
    roster?: {
        players: number
        reserves: number
        /** The roster channel (`#info-akce`); none when the card is the roster. */
        channelId?: string | null
        /** The roster picture when this card doubles as the roster (L1-43). */
        image?: MessageMedia | null
    } | null
    /** Confirmations from the meeting on ("Potvrzeno 15 z 18"). */
    confirmation?: {
        confirmed: number
        total: number
        late: number
        cannotCome: number
    } | null
    notes?: string | null
    meetingChannelId?: string | null
    forumChannelId?: string | null
    result?: AnnouncementResult | null
    resultsChannelId?: string | null
    /** A Discord scheduled event exists, so a cancellation names it. */
    scheduledEvent?: boolean
    thumbnail?: MessageMedia | null
    links: { calendar: string; roster?: string | null; match?: string | null }
    copy: MatchAnnouncementCopy
}

const TONE_RGB: Record<ChipTone, [number, number, number]> = {
    success: [0x3b, 0xa5, 0x5c],
    warning: [0xf0, 0xb2, 0x32],
    danger: [0xed, 0x42, 0x45],
    neutral: [0x80, 0x84, 0x8e],
    info: [0x58, 0x65, 0xf2],
}

/**
 * The chip tone closest to a category colour: the colour appears only as the
 * chip's dot (L1-07). A category without a colour is neutral.
 */
export function categoryChipTone(color: string | null | undefined): ChipTone {
    const match = color?.trim().match(/^#?([0-9a-f]{6})$/i)
    if (!match) return "neutral"
    const value = Number.parseInt(match[1]!, 16)
    const rgb = [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    let best: ChipTone = "neutral"
    let distance = Number.POSITIVE_INFINITY
    for (const [tone, target] of Object.entries(TONE_RGB) as Array<
        [ChipTone, [number, number, number]]
    >) {
        const next =
            (rgb[0]! - target[0]) ** 2 +
            (rgb[1]! - target[1]) ** 2 +
            (rgb[2]! - target[2]) ** 2
        if (next < distance) {
            distance = next
            best = tone
        }
    }
    return best
}

/** The state chip and its dot colour (L1-09). */
export function announcementStateChip(
    state: AnnouncementState,
    copy: MatchAnnouncementCopy
): MessageChip {
    const tones: Record<AnnouncementState, ChipTone> = {
        open: "success",
        closed: "neutral",
        roster: "info",
        starting: "warning",
        playing: "success",
        played: "neutral",
        cancelled: "danger",
    }
    return { label: copy.states[state], tone: tones[state] }
}

/** A team code as an inline-code chip ("`VLK`"); backticks cannot be escaped. */
function teamChip(code: string) {
    const clean = code
        .replace(/[`\r\n]+/g, "")
        .trim()
        .slice(0, 24)
    return clean ? `\`${clean}\`` : ""
}

/** "Spojenci"/"Osa" for Hell Let Loose sides; other sides as stored. */
export function sideLabel(side: string, copy: MatchAnnouncementCopy) {
    const faction = panelFactionOf(side)
    return faction === "allies" || faction === "axis"
        ? copy.card.factions[faction]
        : escapeMarkdownText(side.trim())
}

/**
 * "VLK vs ROG" from the team codes, the event name otherwise; a training is
 * "Trénink · …" unless its name already says so (L1-11, L1-62).
 */
export function matchCardTitle(
    event: Pick<MatchCardEvent, "kind" | "name" | "teams" | "locale">,
    copy: MatchAnnouncementCopy
) {
    const name = event.name.replace(/[\s\p{Cc}]+/gu, " ").trim()
    if (event.kind === "training") {
        const word = copy.card.training
        return name
            .toLocaleLowerCase(event.locale)
            .includes(word.toLocaleLowerCase(event.locale))
            ? name
            : `${word} · ${name}`
    }
    const codes = event.teams
        .map((team) => team.code.replace(/[\s\p{Cc}]+/gu, " ").trim())
        .filter(Boolean)
    return codes.length >= 2 ? codes.join(` ${copy.card.versus} `) : name
}

/** "VLK vs ROG · Přátelák": the title with the category, for plain contexts. */
export function matchCardFullTitle(
    event: Pick<
        MatchCardEvent,
        "kind" | "name" | "teams" | "locale" | "category"
    >,
    copy: MatchAnnouncementCopy
) {
    const title = matchCardTitle(event, copy)
    const category = event.category?.label.trim()
    return event.kind === "match" && category && category !== title
        ? `${title} · ${category}`
        : title
}

/**
 * The sides row (L1-12): "`VLK` Spojenci ★  vs  `ROG` Osa ✚". Without teams
 * the clan's own side.
 */
export function matchSidesLine(
    event: MatchCardEvent,
    copy: MatchAnnouncementCopy
) {
    if (event.kind !== "match") return undefined
    const side = (value: string | null | undefined) => {
        const trimmed = value?.trim()
        if (!trimmed) return []
        return [
            sideLabel(trimmed, copy),
            factionEmblem(trimmed, event.factionEmoji),
        ].filter((part): part is string => Boolean(part))
    }
    if (event.teams.length) {
        return event.teams
            .map((team) =>
                [teamChip(team.code), ...side(team.side)]
                    .filter(Boolean)
                    .join(" ")
            )
            .join(`  ${copy.card.versus}  `)
    }
    const own = side(event.side)
    return own.length ? own.join(" ") : undefined
}

/** "ne 11. 10. · 20:00" with Discord timestamps (L1-05). */
export function weekdayTime(
    event: Pick<MatchCardEvent, "locale" | "timeZone">,
    iso: string
) {
    return discordWeekdayTimestamp(iso, event.locale, event.timeZone) ?? ""
}

/** "so 10. 10. v 19:30": a closed deadline as a date at a time (L1-71, L1-95). */
export function weekdayAt(
    event: Pick<MatchCardEvent, "locale" | "timeZone">,
    iso: string,
    copy: MatchAnnouncementCopy
) {
    const date = discordTimestamp(iso, "d")
    const time = discordTimestamp(iso, "t")
    if (!date || !time) return ""
    let weekday = ""
    try {
        weekday = new Intl.DateTimeFormat(event.locale, {
            weekday: "short",
            timeZone: event.timeZone,
        })
            .format(Date.parse(iso))
            .replace(/\.$/, "")
    } catch {
        weekday = ""
    }
    return [weekday, date, copy.card.at, time].filter(Boolean).join(" ")
}

/** "Tanky a Recon" in the clan language. */
export function joinNames(
    names: readonly string[],
    copy: MatchAnnouncementCopy
) {
    if (names.length <= 1) return names.join("")
    return `${names.slice(0, -1).join(", ")}${copy.card.and}${names[names.length - 1]}`
}

/** "**Přihlášeno 17** · Pěchota 12 · Tanky 4/6 · Recon 1/2" (L1-17, L1-29, L1-34). */
export function announcementCountsLine(
    input: {
        kind: "match" | "training"
        state: AnnouncementState
        counts: AnnouncementCounts
    },
    copy: MatchAnnouncementCopy
) {
    const { counts } = input
    const open = input.state === "open"
    const groups = input.kind === "match" ? counts.groups : []
    const signedUp = groups.length
        ? counts.total - counts.withoutGroup
        : counts.total
    const parts = [
        `**${fillTemplate(copy.card.signedUp, { count: String(signedUp) })}**`,
        ...groups.map((group) => {
            const name = escapeMarkdownText(group.name)
            if (!open) return `${name} ${group.count}`
            const text = formatGroupCount({ ...group, name })
            return group.max !== undefined && group.count >= group.max
                ? `${text} ${copy.card.full}`
                : text
        }),
    ]
    if (groups.length && counts.withoutGroup)
        parts.push(
            fillTemplate(
                counts.generalSignup
                    ? copy.card.withoutGroup
                    : copy.card.reserves,
                { count: String(counts.withoutGroup) }
            )
        )
    // A match lists who is not coming once sign-ups closed; a training always.
    if (counts.declined && (input.kind === "training" || !open))
        parts.push(
            fillTemplate(copy.card.declined, { count: String(counts.declined) })
        )
    return parts.join(" · ")
}

/** "**Potvrzeno 15 z 18** · přijde později 1 · nepřijde 1" (L1-46). */
export function confirmationLine(
    confirmation: NonNullable<AnnouncementViewInput["confirmation"]>,
    copy: MatchAnnouncementCopy
) {
    return [
        `**${fillTemplate(copy.card.confirmed, {
            confirmed: String(confirmation.confirmed),
            total: String(confirmation.total),
        })}**`,
        ...(confirmation.late
            ? [
                  fillTemplate(copy.card.late, {
                      count: String(confirmation.late),
                  }),
              ]
            : []),
        ...(confirmation.cannotCome
            ? [
                  fillTemplate(copy.card.cannotCome, {
                      count: String(confirmation.cannotCome),
                  }),
              ]
            : []),
    ].join(" · ")
}

/**
 * The announcement's result from a reviewed result: the clan's outcome and
 * its score first when the clan's side names a participant, else the scores
 * as reviewed. Nothing is invented: an unclear outcome shows only the scores.
 */
export function toAnnouncementResult(input: {
    participants: ReadonlyArray<{ label: string; score: number | null }>
    clanSide?: string | null
    imported?: {
        outcome: "victory" | "defeat" | "draw"
        score: { sideA: number; sideB: number }
    } | null
    reviewer?: string | null
}): AnnouncementResult | null {
    const participants = input.participants
    if (!participants.length) return null
    const resolved = resolveClanOutcome({
        participants,
        clanSide: input.clanSide,
        imported: input.imported,
    })
    const clanIndex = resolved?.clanIndex ?? null
    let scores: AnnouncementResult["scores"] = null
    if (clanIndex !== null && participants.length >= 2) {
        const others = participants
            .filter((_, index) => index !== clanIndex)
            .map((participant) => participant.score)
            .filter((score): score is number => score !== null)
        scores = [
            participants[clanIndex]?.score ?? null,
            others.length ? Math.max(...others) : null,
        ]
    } else if (participants.length === 2) {
        scores = [
            participants[0]?.score ?? null,
            participants[1]?.score ?? null,
        ]
    }
    return {
        outcome: resolved?.outcome ?? null,
        scores,
        reviewer: input.reviewer?.trim() || null,
    }
}

/** "Výhra 4 : 1 · potvrdil Kowalski" (L1-52). */
export function resultLine(
    result: AnnouncementResult,
    copy: MatchAnnouncementCopy
) {
    const score = (value: number | null) =>
        value === null || !Number.isFinite(value) ? "–" : String(value)
    const scores = result.scores
        ? `${score(result.scores[0])} : ${score(result.scores[1])}`
        : undefined
    const head = [
        result.outcome ? copy.card.outcomes[result.outcome] : undefined,
        scores,
    ]
        .filter(Boolean)
        .join(" ")
    if (!head) return undefined
    const reviewer = result.reviewer?.trim()
    return [
        `**${head}**`,
        reviewer
            ? fillTemplate(copy.card.confirmedBy, {
                  name: escapeMarkdownText(reviewer.slice(0, 80)),
              })
            : undefined,
    ]
        .filter(Boolean)
        .join(" · ")
}

/** The custom IDs of the announcement's buttons; the bot routes them. */
export function announcementCustomId(
    action: Exclude<AnnouncementAction, "calendar" | "openRoster" | "match">,
    event: Pick<MatchCardEvent, "eventId" | "guildId" | "kind">
) {
    const { eventId, guildId } = event
    switch (action) {
        case "signup":
            // A training has no groups to choose: the button signs up at once.
            return event.kind === "training"
                ? `signup:${eventId}:${TRAINING_ATTEND}:${guildId}`
                : `signup-picker:${eventId}:${guildId}`
        case "editSignup":
            return `check-signup:${eventId}:${guildId}`
        case "decline":
            return `signup:${eventId}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}:${guildId}`
        case "attendees":
            return `attendees:${eventId}`
        case "assignment":
            return `roster-assignment:${eventId}`
        case "confirm":
            return `attendance:${eventId}:ack`
        case "late":
            return `attendance-late:${eventId}`
    }
}

function announcementButton(
    action: AnnouncementAction,
    input: AnnouncementViewInput
): MessageButton | null {
    const { copy, event, links } = input
    const label = copy.buttons[action]
    switch (action) {
        case "calendar":
            return { kind: "link", url: links.calendar, label }
        case "openRoster":
            return links.roster
                ? { kind: "link", url: links.roster, label }
                : null
        case "match":
            return links.match
                ? { kind: "link", url: links.match, label }
                : null
        case "signup":
            return {
                kind: "action",
                id: announcementCustomId(action, event),
                label,
                style: "success",
            }
        case "decline":
            return {
                kind: "action",
                id: announcementCustomId(action, event),
                label,
                style: "danger",
            }
        case "assignment":
        case "confirm":
            return {
                kind: "action",
                id: announcementCustomId(action, event),
                label,
                // "Zobrazit zařazení" is the primary action only while the
                // card shows the published roster (L1-39, L1-49).
                style:
                    action === "confirm" || input.state === "roster"
                        ? "primary"
                        : "secondary",
            }
        default:
            return {
                kind: "action",
                id: announcementCustomId(action, event),
                label,
                style: "secondary",
            }
    }
}

/** The text after the state chip (L1-16, L1-28, L1-33, L1-37, L1-45, L1-50, L1-51, L1-57). */
function stateDetail(input: AnnouncementViewInput) {
    const { copy, event, state } = input
    const card = copy.card
    switch (state) {
        case "open": {
            const until = fillTemplate(card.until, {
                time: weekdayTime(event, event.registrationEnd),
            })
            const full = fullSignupGroups(input.counts.groups).map((group) =>
                escapeMarkdownText(group.name)
            )
            return full.length && event.kind === "match"
                ? `${until} · ${fillTemplate(card.fullGroups, {
                      groups: joinNames(full, copy),
                  })}`
                : until
        }
        case "closed":
            return event.kind === "training"
                ? card.trainingClosedDetail
                : card.closedDetail
        case "roster": {
            const roster = input.roster
            if (!roster) return undefined
            const players = formatCount(
                event.locale,
                roster.players,
                card.rosterPlayers
            )
            const text = roster.reserves
                ? fillTemplate(card.rosterAnd, {
                      players,
                      reserves: formatCount(
                          event.locale,
                          roster.reserves,
                          card.rosterReserves
                      ),
                  })
                : players
            return roster.channelId
                ? fillTemplate(card.rosterIn, {
                      roster: text,
                      channel: `<#${roster.channelId}>`,
                  })
                : text
        }
        case "starting":
            return input.meetingChannelId
                ? fillTemplate(card.startingIn, {
                      channel: `<#${input.meetingChannelId}>`,
                  })
                : card.starting
        case "playing":
            return fillTemplate(card.playingSince, {
                time: discordTimestamp(event.gameStart, "t") ?? "",
            })
        case "played":
            return [
                weekdayTime(event, event.gameStart),
                event.kind === "match" ? event.mapLabel?.trim() : undefined,
            ]
                .filter(Boolean)
                .join(" · ")
        case "cancelled":
            return event.kind === "training"
                ? card.trainingCancelledDetail
                : card.cancelledDetail
    }
}

/** The meta lines under the title: sides, start, facts (L1-12..14, L1-44, L1-56, L1-63). */
function metaLines(input: AnnouncementViewInput): MessageMetaLine[] {
    const { copy, event, state } = input
    const lines: MessageMetaLine[] = []
    const sides = matchSidesLine(event, copy)
    if (sides) lines.push({ text: sides, line: "side" })
    if (state === "played") return lines
    const start = weekdayTime(event, event.gameStart)
    if (start) {
        const relative = discordTimestamp(event.gameStart, "R")
        lines.push({
            line: "start",
            text:
                state === "cancelled"
                    ? `~~${start}~~`
                    : state === "playing" || !relative
                      ? `**${start}**`
                      : `**${start}** · ${relative}`,
        })
    }
    if (state === "cancelled") return lines
    // From the meeting on, the meeting is no longer news (L1-44).
    const meeting =
        state === "starting" || state === "playing"
            ? undefined
            : discordTimestamp(event.meetingStart, "t")
    const facts = [
        event.kind === "match" ? event.mapLabel?.trim() : undefined,
        meeting
            ? fillTemplate(copy.card.meetingAt, { time: meeting })
            : undefined,
        event.kind === "training" && event.server?.trim()
            ? fillTemplate(copy.card.server, {
                  server: escapeMarkdownText(event.server.trim()),
              })
            : undefined,
    ].filter((fact): fact is string => Boolean(fact))
    if (facts.length) lines.push({ text: facts.join(" · "), line: "details" })
    return lines
}

/**
 * The announcement card in one state (L1-B03), with the state's buttons
 * (L1-B04). Never the server password (L1-03, L1-B07).
 */
export function buildAnnouncementView(
    input: AnnouncementViewInput
): MessageView {
    const { copy, event, state } = input
    const blocks: MessageBlock[] = []
    const meta = metaLines(input)
    if (meta.length) blocks.push({ kind: "meta", lines: meta })

    const detail = stateDetail(input)
    const status = [
        [chipText(announcementStateChip(state, copy)), detail]
            .filter(Boolean)
            .join(" · "),
    ]
    if (state === "open" || state === "closed")
        status.push(
            announcementCountsLine(
                { kind: event.kind, state, counts: input.counts },
                copy
            )
        )
    if ((state === "starting" || state === "playing") && input.confirmation)
        status.push(confirmationLine(input.confirmation, copy))
    else if ((state === "starting" || state === "playing") && !input.roster)
        status.push(
            announcementCountsLine(
                { kind: event.kind, state: "closed", counts: input.counts },
                copy
            )
        )
    if (state === "played" && input.result) {
        const line = resultLine(input.result, copy)
        if (line) status.push(line)
    }
    blocks.push({ kind: "text", markdown: status.join("\n") })

    if (state === "cancelled") {
        blocks.push({
            kind: "text",
            markdown: input.scheduledEvent
                ? copy.card.cancelledBody
                : copy.card.cancelledBodyNoEvent,
        })
    } else if (state !== "played" && input.notes?.trim()) {
        blocks.push({ kind: "text", markdown: input.notes.trim() })
    }

    const rosterImage = input.roster?.image
    if (
        rosterImage &&
        (state === "roster" || state === "starting" || state === "playing")
    )
        blocks.push({ kind: "gallery", items: [rosterImage] })

    const rows = announcementActions(state, {
        kind: event.kind,
        rosterPublished: Boolean(input.roster),
        hasMatchPage: Boolean(input.links.match),
    })
        .map((row) =>
            row
                .map((action) => announcementButton(action, input))
                .filter((button): button is MessageButton => button !== null)
        )
        .filter((row) => row.length)
    blocks.push({ kind: "separator", divider: true, spacing: "small" })
    for (const buttons of rows) blocks.push({ kind: "buttons", buttons })

    const notes =
        state === "played"
            ? input.resultsChannelId
                ? [
                      fillTemplate(copy.card.resultsFooter, {
                          channel: `<#${input.resultsChannelId}>`,
                      }),
                  ]
                : []
            : state !== "cancelled" &&
                event.kind === "match" &&
                input.forumChannelId
              ? [
                    fillTemplate(copy.card.forumFooter, {
                        channel: `<#${input.forumChannelId}>`,
                    }),
                ]
              : []

    return {
        // One clan colour, whatever the state or category (L1-02).
        accent: "clan",
        header: {
            title: matchCardTitle(event, copy),
            chips:
                event.kind === "match" && event.category?.label.trim()
                    ? [
                          {
                              label: event.category.label.trim(),
                              tone: categoryChipTone(event.category.color),
                          },
                      ]
                    : [],
            ...(input.thumbnail && event.kind === "match"
                ? { thumbnail: input.thumbnail }
                : {}),
        },
        blocks,
        footer: { kind: "managed", notes },
    }
}

/** The role ping above the card, sent only with the first post (L1-10, L1-25). */
export function announcementPingLine(roleIds: readonly string[]) {
    const unique = [...new Set(roleIds.map((id) => id.trim()).filter(Boolean))]
    return unique.length
        ? unique.map((roleId) => `<@&${roleId}>`).join(" ")
        : undefined
}
