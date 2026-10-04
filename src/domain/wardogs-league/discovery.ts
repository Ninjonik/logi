import { matchUrl } from "./match-url"
import { z } from "zod"
export const SCAN_MS = 10 * 60_000
export const TRACK_MS = 5 * 60_000
/** Index scan and tracked-detail refresh cadences a workspace may choose, in minutes. */
export const SCAN_MINUTES = [10, 15, 30, 60] as const
export const REFRESH_MINUTES = [5, 10, 15, 30] as const
export const MAX_TRACKED = 500
export const ADMIN_TRACKING_RESERVE = 50
export const MAX_HUMAN_CANDIDATES = 50
export const INDEX_URLS = [
    "https://wardogsleague.net/matches?tab=fixtures",
    "https://wardogsleague.net/matches?tab=results",
] as const
export function indexUrl(input: string) {
    if (!(INDEX_URLS as readonly string[]).includes(input))
        throw new Error("Invalid League index URL.")
    return { id: new URL(input).searchParams.get("tab")!, url: input }
}
const channel = z
    .string()
    .regex(/^\d{17,20}$/)
    .nullable()
export const trackingSettingsSchema = z
    .object({
        enabled: z.boolean(),
        teamCodes: z
            .array(
                z
                    .string()
                    .min(1)
                    .max(40)
                    .regex(/^[\p{L}\p{N}|_-]+$/u)
            )
            .min(1)
            .max(20)
            .refine((v) => new Set(v).size === v.length),
        inputChannelId: channel,
        outputChannelId: channel,
        scanMinutes: z
            .union([z.literal(10), z.literal(15), z.literal(30), z.literal(60)])
            .default(10),
        refreshMinutes: z
            .union([z.literal(5), z.literal(10), z.literal(15), z.literal(30)])
            .default(5),
    })
    .strict()
export type TrackingSettings = z.infer<typeof trackingSettingsSchema>
export const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
    enabled: false,
    teamCodes: ["VLK"],
    inputChannelId: null,
    outputChannelId: null,
    scanMinutes: 10,
    refreshMinutes: 5,
}
type Cadence = { scanMinutes?: number; refreshMinutes?: number }
export function scanIntervalMs(settings?: Cadence | null) {
    return (settings?.scanMinutes ?? 10) * 60_000
}
export function refreshIntervalMs(settings?: Cadence | null) {
    return (settings?.refreshMinutes ?? 5) * 60_000
}
/** The shared index scan runs at the fastest cadence any enabled workspace asks for. */
export function sharedScanIntervalMs(
    settings: Array<Cadence & { enabled: boolean }>
) {
    const enabled = settings.filter((value) => value.enabled)
    return enabled.length
        ? Math.min(...enabled.map((value) => scanIntervalMs(value)))
        : SCAN_MS
}
/** A workspace takes a fresh shared index only once its own cadence has elapsed since
 * the index it processed last; a half-minute tolerance absorbs scheduler jitter. */
export function indexDueForWorkspace(
    settings: Cadence & { lastIndexAt?: number },
    indexFetchedAt: number
) {
    if (settings.lastIndexAt === undefined) return true
    if (settings.lastIndexAt === indexFetchedAt) return false
    return (
        indexFetchedAt - settings.lastIndexAt >=
        scanIntervalMs(settings) - 30_000
    )
}
export function matchesWatchedTeams(
    snapshot: { teams: Array<{ code: string; profileUrl: string }> | null },
    codes: string[]
) {
    return (
        snapshot.teams?.some(
            (t) =>
                codes.includes(t.code) &&
                t.profileUrl ===
                    `https://wardogsleague.net/teams/${encodeURIComponent(t.code)}`
        ) ?? false
    )
}
export function trackingDeadline(
    snapshot: { scheduledAt: string | null },
    firstSeenAt: number
) {
    return snapshot.scheduledAt
        ? Date.parse(snapshot.scheduledAt) + 7 * 86400_000
        : firstSeenAt + 14 * 86400_000
}
export function extractMatchUrls(content: string): string[] {
    const urls = new Set<string>()
    for (const token of content.slice(0, 4000).match(/https:\/\/[^\s<>]+/g) ??
        []) {
        try {
            urls.add(matchUrl(token.replace(/[.,!;)]+$/, "")).url)
        } catch {
            /* Unrelated URLs are not input. */
        }
        if (urls.size === 3) break
    }
    return [...urls]
}
