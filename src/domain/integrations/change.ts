export const SYNC_RESOURCES = [
    "server-game-history",
    "league-fixtures",
    "member-summaries",
    "roster-summaries",
    "player-stat-summaries",
    "membership-summaries",
    "event-summaries",
    "match-summaries",
    "result-summaries",
    "server-snapshots",
    "integration-health",
] as const
export type SyncResource = (typeof SYNC_RESOURCES)[number]
export type IntegrationChange = {
    revision: string
    guildId: string
    gameId: string
    resource: SyncResource
    id: string
    operation: "upsert" | "remove"
}
export const CHANGE_RETENTION_MS = 7 * 24 * 60 * 60 * 1000
export const integrationChangeSchema = z
    .object({
        revision: z.string().regex(/^(0|[1-9][0-9]{0,127})$/),
        guildId: z.string(),
        gameId: z.enum(GAME_IDS),
        resource: z.enum(SYNC_RESOURCES),
        id: z.string(),
        operation: z.enum(["upsert", "remove"]),
    })
    .strict()
export const syncRecordSchema = z.union([
    integrationChangeSchema.extend({
        operation: z.literal("remove"),
        data: z.null(),
    }),
    integrationChangeSchema.extend({
        operation: z.literal("upsert"),
        data: z.union([
            historyRecordSchema,
            leagueFixtureSchema,
            clanMemberSummarySchema,
            clanRosterSummarySchema,
            clanPlayerStatSummarySchema,
            clanEventSummarySchema,
            clanMatchSummarySchema,
            clanResultSummarySchema,
            serverSnapshotSchema,
            integrationHealthSchema,
            membershipObservationSchema,
        ]),
    }),
])

export function revisionOrder(revision: string): string {
    if (!/^(0|[1-9][0-9]{0,127})$/.test(revision))
        throw new Error("Invalid revision.")
    return revision.padStart(128, "0")
}
export function nextRevision(revision: string): string {
    revisionOrder(revision)
    const next = (BigInt(revision) + BigInt(1)).toString()
    revisionOrder(next)
    return next
}
import {
    clanMemberSummarySchema,
    clanRosterSummarySchema,
    clanPlayerStatSummarySchema,
} from "../api/people-summaries"
import {
    clanEventSummarySchema,
    clanMatchSummarySchema,
} from "../api/event-summaries"
import {
    serverSnapshotSchema,
    integrationHealthSchema,
} from "../game-data/contracts"
import { membershipObservationSchema } from "../membership/observation"
import { clanResultSummarySchema } from "../api/result-summaries"
import { leagueFixtureSchema } from "../wardogs-league/fixture"
import { historyRecordSchema } from "../game-data/history"
import { GAME_IDS } from "../games/game"
import { z } from "zod"
