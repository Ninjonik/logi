/**
 * Small text rules the announcement, roster, forum and DM cards share: the
 * match title from its team codes, the sides row with team code chips and
 * faction emblems, the category chip, the weekday dates of the boards
 * ("ne 11. 10.", "so 10. 10. v 19:30"), player names and the match forum's
 * channel name. Pure; the copy is passed in.
 */

import { panelFactionOf } from "@/domain/discord-publications/panel-presentation"

import {
    escapeMarkdownText,
    type ChipTone,
    type MessageChip,
} from "./message-view"
import { discordTimestamp, fillTemplate } from "./format"
import { factionEmblem } from "./faction-emblem"

export type MatchTeamText = {
    slot?: string
    side?: string | null
    snapshot: { name: string; shortCode?: string | null }
}

const SLOT_ORDER: Record<string, number> = { a: 0, b: 1, c: 2 }

/** Assigned teams in slot order (a, b, c). */
export function sortedMatchTeams<T extends { slot?: string }>(
    teams: readonly T[] | undefined
): T[] {
    return [...(teams ?? [])].sort(
        (left, right) =>
            (SLOT_ORDER[left.slot ?? ""] ?? 9) -
            (SLOT_ORDER[right.slot ?? ""] ?? 9)
    )
}

function oneLine(value: string) {
    return value.replace(/[\s\p{Cc}]+/gu, " ").trim()
}

/** A team's short code ("VLK"), else its name. */
export function teamCode(team: MatchTeamText) {
    return oneLine(team.snapshot.shortCode?.trim() || team.snapshot.name)
}

/**
 * The plain match title of the boards: the team codes "VLK vs ROG" when the
 * match has two or more teams, else the event's name.
 */
export function matchTitle(event: {
    name: string
    matchTeams?: readonly MatchTeamText[]
}) {
    const codes = sortedMatchTeams(event.matchTeams)
        .map(teamCode)
        .filter(Boolean)
    return codes.length >= 2 ? codes.join(" vs ") : oneLine(event.name)
}

/** The HLL faction of a stored side ("Allies"/"Axis"); other sides have none. */
export function sideKind(side: string | null | undefined) {
    const faction = panelFactionOf(side)
    return faction === "allies" || faction === "axis" ? faction : undefined
}

/** A side in the clan language ("Spojenci"), or the stored side escaped. */
export function sideLabel(
    side: string,
    factions: Record<"allies" | "axis", string>
) {
    const kind = sideKind(side)
    return kind ? factions[kind] : escapeMarkdownText(oneLine(side))
}

/**
 * A team code as an inline-code chip ("`VLK`"), the board's code chip
 * (L1-06). Backticks cannot be escaped inside one, so they are dropped.
 */
export function teamCodeChip(code: string) {
    const clean = code
        .replace(/[`\r\n]+/g, "")
        .trim()
        .slice(0, 24)
    return clean ? `\`${clean}\`` : ""
}

/**
 * The sides row "`VLK` Spojenci ★  vs  `ROG` Osa ✚" (L1-12, L1-130, L2-07):
 * every team as its code chip with its side and faction emblem, or the
 * clan's own side when the match has no teams. No coloured squares. The one
 * implementation behind the announcement, the forum post and the DMs.
 */
export function sidesRow(input: {
    /** Teams in slot order with their codes ("VLK") and stored sides. */
    teams: ReadonlyArray<{ code: string; side?: string | null }>
    side?: string | null
    factions: Record<"allies" | "axis", string>
    emoji?: Parameters<typeof factionEmblem>[1]
    /** The word between teams, "vs". */
    versus?: string
}) {
    const part = (code: string | undefined, side: string | null | undefined) =>
        [
            code ? teamCodeChip(code) : undefined,
            side?.trim() ? sideLabel(side, input.factions) : undefined,
            side?.trim() ? factionEmblem(side, input.emoji) : undefined,
        ]
            .filter(Boolean)
            .join(" ")
    if (input.teams.length)
        return input.teams
            .map((team) => part(team.code, team.side))
            .join(`  ${input.versus ?? "vs"}  `)
    return input.side?.trim() ? part(undefined, input.side) : undefined
}

/** The sides row of a stored match: its assigned teams, else the clan's side. */
export function matchSidesLine(input: {
    teams?: readonly MatchTeamText[]
    side?: string | null
    factions: Record<"allies" | "axis", string>
    emoji?: Parameters<typeof factionEmblem>[1]
    versus?: string
}) {
    return sidesRow({
        ...input,
        teams: sortedMatchTeams(input.teams).map((team) => ({
            code: teamCode(team),
            side: team.side,
        })),
    })
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

/**
 * The match category as a chip next to the title (L1-11, L1-130); none for
 * an uncategorised match.
 */
export function categoryChip(
    category: { label: string; color?: string | null } | null | undefined
): MessageChip[] {
    const label = category?.label.trim()
    return label ? [{ label, tone: categoryChipTone(category?.color) }] : []
}

/** The weekday in the clan language and zone ("ne"), without a trailing dot. */
export function weekdayName(
    value: string | number | null | undefined,
    locale: string,
    timeZone: string
) {
    if (value === null || value === undefined || value === "") return undefined
    const ms = typeof value === "number" ? value : Date.parse(value)
    if (!Number.isFinite(ms)) return undefined
    const format = (zone: string) =>
        new Intl.DateTimeFormat(locale, { weekday: "short", timeZone: zone })
            .format(ms)
            .replace(/\.$/, "")
    try {
        return format(timeZone)
    } catch {
        return format("UTC")
    }
}

/** "ne <t:…:d>": the weekday and the date as a Discord timestamp. */
export function weekdayDate(
    value: string | number | null | undefined,
    locale: string,
    timeZone: string
) {
    const day = weekdayName(value, locale, timeZone)
    const date = discordTimestamp(value, "d")
    return day && date ? `${day} ${date}` : undefined
}

/** "so <t:…:d> v <t:…:t>" with the language's connector ("{date} v {time}"). */
export function weekdayDateAt(
    value: string | number | null | undefined,
    locale: string,
    timeZone: string,
    template: string
) {
    const date = weekdayDate(value, locale, timeZone)
    const time = discordTimestamp(value, "t")
    return date && time ? fillTemplate(template, { date, time }) : undefined
}

/** A channel mention, or undefined without a channel. */
export function channelMention(channelId: string | null | undefined) {
    const id = channelId?.trim()
    return id && /^\d{17,20}$/.test(id) ? `<#${id}>` : undefined
}

/**
 * A player's name for a card: the custom name or the stored display name,
 * escaped; else a mention (it shows the member's name and never pings,
 * because messages are sent without allowed mentions).
 */
export function playerName(
    player: { id?: string | null; customName?: string | null },
    names: Readonly<Record<string, string>>
) {
    const custom = player.customName?.trim()
    if (custom) return escapeMarkdownText(oneLine(custom))
    const id = player.id?.trim()
    if (!id) return undefined
    const name = names[id]?.trim()
    if (name) return escapeMarkdownText(oneLine(name))
    return /^\d{17,20}$/.test(id) ? `<@${id}>` : escapeMarkdownText(id)
}

/**
 * The match forum's channel name, "vlk-vs-rog-11-10": the match title and
 * the day and month of the game in the clan's zone, in the lower-case,
 * hyphenated form Discord gives channel names.
 */
export function matchForumChannelName(
    title: string,
    gameStart: string,
    timeZone: string
) {
    const ms = Date.parse(gameStart)
    let dayMonth = ""
    if (Number.isFinite(ms)) {
        const parts = (zone: string) =>
            new Intl.DateTimeFormat("en-GB", {
                day: "2-digit",
                month: "2-digit",
                timeZone: zone,
            }).formatToParts(ms)
        let formatted: Intl.DateTimeFormatPart[]
        try {
            formatted = parts(timeZone)
        } catch {
            formatted = parts("UTC")
        }
        const day = formatted.find((part) => part.type === "day")?.value
        const month = formatted.find((part) => part.type === "month")?.value
        if (day && month) dayMonth = `${day}-${month}`
    }
    const slug = title
        .toLocaleLowerCase()
        .normalize("NFC")
        .replace(/[^\p{L}\p{N}_-]+/gu, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
    return [slug.slice(0, 90), dayMonth].filter(Boolean).join("-").slice(0, 100)
}

/** A late notice's arrival time ("20:15") when the player wrote one. */
export function noticeArrivalTime(reason: string | null | undefined) {
    const match = reason?.match(/\b([01]?\d|2[0-3])[:.]([0-5]\d)\b/)
    return match ? `${match[1]!.padStart(2, "0")}:${match[2]}` : undefined
}
