import { z } from "zod"

/** Retention windows a workspace may choose for retained server games; null keeps history indefinitely. */
export const HISTORY_RETENTION_DAYS = [90, 180, 365, 730] as const
export type HistoryRetentionDays = (typeof HISTORY_RETENTION_DAYS)[number]

export const historyRetentionSettingsSchema = z.strictObject({
    retentionDays: z
        .union([z.literal(90), z.literal(180), z.literal(365), z.literal(730)])
        .nullable(),
})
export type HistoryRetentionSettings = z.infer<
    typeof historyRetentionSettingsSchema
>

const DAY_MS = 86_400_000

/** ISO instant before which a retained game has expired, or null when history is kept indefinitely. */
export function historyRetentionCutoff(
    settings: { retentionDays: number | null } | null | undefined,
    now: number
): string | null {
    if (!settings || settings.retentionDays === null) return null
    return new Date(now - settings.retentionDays * DAY_MS).toISOString()
}

/** Retained games store `endedAt` as a UTC ISO instant, so a lexical compare is a time compare. */
export function historyGameExpired(endedAt: string, cutoff: string) {
    return endedAt < cutoff
}
