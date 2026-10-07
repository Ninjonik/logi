import type { Dictionary } from "@/i18n/dictionaries"

import { plural, type PluralForms } from "./panel-copy"

type TimeText = Dictionary["discordPanelsPage"]["time"]

const SECOND = 1000
const MINUTE = 60 * SECOND
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

function relative(
    locale: string,
    value: number,
    unit: Intl.RelativeTimeFormatUnit
) {
    return new Intl.RelativeTimeFormat(locale, {
        style: "short",
        numeric: "always",
    }).format(value, unit)
}

function unitOf(ms: number): [number, Intl.RelativeTimeFormatUnit] {
    const abs = Math.abs(ms)
    if (abs < MINUTE) return [Math.round(ms / SECOND), "second"]
    if (abs < HOUR) return [Math.round(ms / MINUTE), "minute"]
    if (abs < DAY) return [Math.round(ms / HOUR), "hour"]
    return [Math.round(ms / DAY), "day"]
}

/** "před 12 s", "před 18 min" (P1-04, P1-13). */
export function timeAgo(at: number, now: number, locale: string) {
    const [value, unit] = unitOf(Math.min(-SECOND, at - now))
    return relative(locale, value, unit)
}

/** "za 48 s"; a time already due reads "teď" (P1-13 "další obnova za 48 s"). */
export function timeIn(
    at: number,
    now: number,
    locale: string,
    text: TimeText
) {
    const ms = at - now
    if (ms < SECOND) return text.now
    const [value, unit] = unitOf(ms)
    return relative(locale, value, unit)
}

/** "17:58" or "17:58:09" in the reader's zone. */
export function clockTime(at: number, locale: string, seconds = false) {
    return new Intl.DateTimeFormat(locale, {
        hour: "2-digit",
        minute: "2-digit",
        ...(seconds ? { second: "2-digit" } : {}),
    }).format(at)
}

const dayKey = (ms: number) => {
    const date = new Date(ms)
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/** "dnes v 17:40", "včera v 22:14", "ne 4. 10. v 21:10" (P1-17, P1-22, P2-31). */
export function dayTime(
    at: number,
    now: number,
    locale: string,
    text: TimeText,
    seconds = false
) {
    const time = clockTime(at, locale, seconds)
    if (dayKey(at) === dayKey(now)) return text.today.replace("{time}", time)
    if (dayKey(at) === dayKey(now - DAY))
        return text.yesterday.replace("{time}", time)
    const date = new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "numeric",
    })
        .format(at)
        .replace(/,/g, "")
    return text.date.replace("{date}", date).replace("{time}", time)
}

/** "ne 4. 10." (P2-30 "ověřen ne 4. 10."). */
export function shortDay(at: number, locale: string) {
    return new Intl.DateTimeFormat(locale, {
        weekday: "short",
        day: "numeric",
        month: "numeric",
    })
        .format(at)
        .replace(/,/g, "")
}

/**
 * The gap between an error and the next success in words, for "Další
 * pokus o {after} později prošel." (P2-32): "minutu", "2 minuty", "40 sekund".
 */
export function recoveryGap(
    ms: number,
    locale: string,
    forms: Record<"second" | "minute" | "hour" | "day", PluralForms>
) {
    const [value, unit] = unitOf(Math.max(SECOND, ms))
    const key =
        unit === "second" || unit === "minute" || unit === "hour" ? unit : "day"
    return plural(forms[key], Math.abs(value), locale)
}
