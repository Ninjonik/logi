import {
    formatClanDateTime,
    formatClanRelativeTime,
    getIntlLocaleForClanLanguage,
} from "@/lib/clan-language/core"

import type { TimestampStyle } from "./markdown"

const OPTIONS: Record<
    Exclude<TimestampStyle, "R" | "f">,
    Intl.DateTimeFormatOptions
> = {
    t: { timeStyle: "short" },
    T: { timeStyle: "medium" },
    d: { dateStyle: "short" },
    D: { dateStyle: "long" },
    F: { dateStyle: "full", timeStyle: "short" },
}

/**
 * A Discord timestamp as the preview shows it, in the clan language: `R`
 * relative to `now`, `f` as date and time, and the other styles as Discord
 * draws them. `timeZone` stands in for the reader's own zone.
 */
export function formatPreviewTimestamp(input: {
    unix: number
    style: TimestampStyle
    language: string | null | undefined
    now: number
    timeZone?: string
}) {
    const ms = input.unix * 1000
    if (input.style === "R")
        return formatClanRelativeTime(input.language, ms, input.now)
    if (input.style === "f")
        return formatClanDateTime(input.language, ms, input.timeZone)
    const date = new Date(ms)
    if (!Number.isFinite(date.getTime())) return undefined
    return new Intl.DateTimeFormat(
        getIntlLocaleForClanLanguage(input.language),
        {
            ...OPTIONS[input.style],
            ...(input.timeZone ? { timeZone: input.timeZone } : {}),
        }
    ).format(date)
}
