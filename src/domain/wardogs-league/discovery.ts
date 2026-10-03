import { matchUrl } from "./match-url"
import { z } from "zod"
export const SCAN_MS = 10 * 60_000
export const TRACK_MS = 5 * 60_000
export const MAX_TRACKED = 500
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
    })
    .strict()
export type TrackingSettings = z.infer<typeof trackingSettingsSchema>
export const DEFAULT_TRACKING_SETTINGS: TrackingSettings = {
    enabled: false,
    teamCodes: ["VLK"],
    inputChannelId: null,
    outputChannelId: null,
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
