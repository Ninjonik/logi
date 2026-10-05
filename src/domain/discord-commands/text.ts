/**
 * Small text helpers of the command replies: mentions, natural lists, the
 * Czech "z"/"ze" before a number, short dates in the clan's zone and
 * numbers in the clan's locale.
 */

const SNOWFLAKE = /^\d{17,20}$/

/** `<#id>` for a channel ID; anything else gives undefined. */
export function channelMention(channelId: string | null | undefined) {
    return channelId && SNOWFLAKE.test(channelId)
        ? `<#${channelId}>`
        : undefined
}

/** `<@&id>` for a role ID; anything else gives undefined. */
export function roleMention(roleId: string | null | undefined) {
    return roleId && SNOWFLAKE.test(roleId) ? `<@&${roleId}>` : undefined
}

/** `<@id>` for a user ID; anything else gives undefined. */
export function userMention(userId: string | null | undefined) {
    return userId && SNOWFLAKE.test(userId) ? `<@${userId}>` : undefined
}

/** "a", "a b" → "a a b", "a, b a c" with the language's last joiner. */
export function joinNatural(items: readonly string[], lastJoiner: string) {
    if (items.length <= 1) return items[0] ?? ""
    return `${items.slice(0, -1).join(", ")}${lastJoiner}${items[items.length - 1]}`
}

/**
 * The Czech preposition before a written number, as the boards write it:
 * "ze 3 serverů", "4 ze 7 výher", but "8 z 12 výher", "z 21 z 23 her". It is
 * "ze" only before the one-digit numbers read dvou, tří, čtyř, šesti, sedmi.
 */
export function czechFrom(value: number) {
    return [2, 3, 4, 6, 7].includes(Math.abs(Math.trunc(value))) ? "ze" : "z"
}

function safeFormat(
    locale: string,
    options: Intl.DateTimeFormatOptions,
    timeZone: string | undefined,
    value: number
) {
    try {
        return new Intl.DateTimeFormat(locale, { ...options, timeZone }).format(
            value
        )
    } catch {
        return new Intl.DateTimeFormat(locale, {
            ...options,
            timeZone: "UTC",
        }).format(value)
    }
}

const toMs = (value: string | number | Date | null | undefined) =>
    value === null || value === undefined || value === ""
        ? Number.NaN
        : value instanceof Date
          ? value.getTime()
          : typeof value === "number"
            ? value
            : Date.parse(value)

/** "so 3. 10." in the clan's language and zone; undefined for an invalid date. */
export function shortDay(
    value: string | number | Date | null | undefined,
    locale: string,
    timeZone?: string
) {
    const ms = toMs(value)
    if (!Number.isFinite(ms)) return undefined
    return safeFormat(
        locale,
        { weekday: "short", day: "numeric", month: "numeric" },
        timeZone,
        ms
    )
}

/** "2. 6." (day and month) in the clan's language and zone. */
export function dayMonth(
    value: string | number | Date | null | undefined,
    locale: string,
    timeZone?: string
) {
    const ms = toMs(value)
    if (!Number.isFinite(ms)) return undefined
    return safeFormat(
        locale,
        { day: "numeric", month: "numeric" },
        timeZone,
        ms
    )
}

/** "20:00" in the clan's zone. */
export function clockTime(
    value: string | number | Date | null | undefined,
    locale: string,
    timeZone?: string
) {
    const ms = toMs(value)
    if (!Number.isFinite(ms)) return undefined
    return safeFormat(
        locale,
        { hour: "2-digit", minute: "2-digit", hour12: false },
        timeZone,
        ms
    )
}

/** Numbers as the clan reads them: "1 284", "1,37"; "—" when unknown. */
export function clanNumber(locale: string, maximumFractionDigits = 2) {
    const format = new Intl.NumberFormat(locale, { maximumFractionDigits })
    return (value: number | null | undefined) =>
        value === null || value === undefined || !Number.isFinite(value)
            ? "—"
            : format.format(value)
}

/** One decimal always ("13,0"), as the per-match averages read. */
export function clanDecimal(locale: string) {
    const format = new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
    })
    return (value: number | null | undefined) =>
        value === null || value === undefined || !Number.isFinite(value)
            ? "—"
            : format.format(value)
}

/** Text from people or providers, safe inside a reply: no pings, no markup. */
export function safeInlineText(value: string, max = 100) {
    return value
        .replace(/[\u0000-\u001f\u007f\p{Cf}]/gu, " ")
        .replace(/@/g, "@​")
        .replace(/([\\*_~`|[\]<>#])/g, "\\$1")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, max)
}
