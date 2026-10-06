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
import { membershipObservationSchema } from "../membership/observation.schema"
import { clanResultSummarySchema } from "../api/result-summaries"
import { leagueFixtureSchema } from "../wardogs-league/fixture"
import { historyRecordSchema } from "../game-data/history"
import { teamDtoSchema } from "../teams/team"
import { SYNC_RESOURCES } from "./change"
import { GAME_IDS } from "../games/game"
import { z } from "zod"

/**
 * Wire schemas of the integration change feed. They live apart from
 * `change.ts` so the Convex mutation wrapper, which only needs revisions and
 * resource names, does not bundle Zod and every summary schema.
 */
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
            teamDtoSchema,
        ]),
    }),
])
