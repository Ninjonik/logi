import { leagueSnapshotSchema, CACHE_MS } from "./contracts"
import { z } from "zod"
export const leagueFixtureSchema = z
    .object({
        id: z.string(),
        guildId: z.string(),
        gameId: z.literal("wardogs"),
        eventId: z.string().nullable(),
        revision: z.string(),
        state: z.enum([
            "pending",
            "tracked",
            "unmatched",
            "ignored",
            "paused",
            "archived",
        ]),
        snapshot: leagueSnapshotSchema,
        stale: z.boolean(),
        ageSeconds: z.number().int().nonnegative(),
        lastAttemptAt: z.iso.datetime().nullable(),
        error: z.string().nullable(),
    })
    .strict()
export type LeagueFixture = z.infer<typeof leagueFixtureSchema>
export function projectLeagueFixture(
    row: {
        matchId: string
        guildId: string
        eventId?: string
        revision: number
        state: string
        snapshotJson?: string
        tracked: boolean
        error?: string
        lastAttemptAt?: number
    },
    now: number
): LeagueFixture | null {
    if (!row.tracked || !row.snapshotJson) return null
    const snapshot = leagueSnapshotSchema.parse(JSON.parse(row.snapshotJson))
    const age = Math.max(0, now - Date.parse(snapshot.fetchedAt))
    return leagueFixtureSchema.parse({
        id: row.matchId,
        guildId: row.guildId,
        gameId: "wardogs",
        eventId: row.eventId ?? null,
        revision: String(row.revision),
        state: row.state,
        snapshot,
        stale: age >= CACHE_MS || Boolean(row.error),
        ageSeconds: Math.floor(age / 1000),
        lastAttemptAt: row.lastAttemptAt
            ? new Date(row.lastAttemptAt).toISOString()
            : null,
        error: row.error ?? null,
    })
}
