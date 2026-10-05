/**
 * Shared formatting rules for every message the Discord bot posts, so the
 * announcement, roster, personal assignment, reminders and panels look like
 * one product: one accent colour, short Discord timestamps and plural-aware
 * counts in the clan's language.
 */

/** Logi amber; used when neither the event category nor the clan sets a colour. */
export const DEFAULT_MESSAGE_ACCENT_COLOR = 0xffb000

const HEX_COLOR = /^#?([0-9a-f]{6})$/i

/** Discord integer colour for `#RRGGBB` (or `RRGGBB`); undefined when malformed. */
export function parseDiscordColor(
    value: string | null | undefined
): number | undefined {
    const match = value?.trim().match(HEX_COLOR)
    return match ? Number.parseInt(match[1]!, 16) : undefined
}

/**
 * The accent of a bot message: an event category colour wins (events with a
 * category use the category colour), then the clan colour, then Logi amber.
 */
export function resolveMessageAccentColor(input: {
    categoryColor?: string | null
    clanColor?: string | null
}): number {
    return (
        parseDiscordColor(input.categoryColor) ??
        parseDiscordColor(input.clanColor) ??
        DEFAULT_MESSAGE_ACCENT_COLOR
    )
}

export type DiscordTimestampStyle = "t" | "T" | "d" | "D" | "f" | "F" | "R"

/**
 * Discord timestamp markup (`<t:unix:style>`), which every reader sees in
 * their own time zone and language. Undefined for an invalid date.
 */
export function discordTimestamp(
    value: string | number | null | undefined,
    style: DiscordTimestampStyle
): string | undefined {
    if (value === null || value === undefined || value === "") return undefined
    const ms = typeof value === "number" ? value : Date.parse(value)
    return Number.isFinite(ms)
        ? `<t:${Math.floor(ms / 1000)}:${style}>`
        : undefined
}

/** Plural forms keyed by `Intl.PluralRules` categories; `{count}` is replaced. */
export type PluralForms = {
    one: string
    few?: string
    many?: string
    other: string
}

/** "1 hráč", "3 hráči", "6 hráčů" in the given locale. */
export function formatCount(
    locale: string,
    count: number,
    forms: PluralForms
): string {
    let category: Intl.LDMLPluralRule = "other"
    try {
        category = new Intl.PluralRules(locale).select(count)
    } catch {
        category = count === 1 ? "one" : "other"
    }
    const template =
        (category === "one" || category === "few" || category === "many"
            ? forms[category]
            : undefined) ?? forms.other
    return template.replace("{count}", String(count))
}

/** Replaces `{name}` placeholders; unknown placeholders stay untouched. */
export function fillTemplate(
    template: string,
    values: Record<string, string>
): string {
    return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
        Object.prototype.hasOwnProperty.call(values, key)
            ? values[key]!
            : placeholder
    )
}

const LEADER_ROLE_PATTERNS = [
    /\bsquad\s*leader\b/,
    /\bofficer\b/,
    /\bleader\b/,
    /\bsl\b/,
    /\bvelitel\b/,
    /\bcommander\b/,
    /\bspotter\b/,
    /f(?:ü|ue)hrer\b/,
]

/**
 * Whether a roster role leads its squad. Hell Let Loose squads are led by the
 * Officer (infantry), Tank Commander (armour), Spotter (recon) and the
 * Commander; clans also name the slot "Squad Leader", "SL" or "Velitel".
 */
export function isSquadLeaderRole(roleName: string | null | undefined) {
    const normalized = roleName?.trim().toLowerCase()
    return Boolean(
        normalized &&
        LEADER_ROLE_PATTERNS.some((pattern) => pattern.test(normalized))
    )
}

/** The first player in a squad whose role leads it, if the roster marks one. */
export function findSquadLeader<T extends { roleName?: string | null }>(
    players: readonly T[]
): T | undefined {
    return players.find((player) => isSquadLeaderRole(player.roleName))
}
