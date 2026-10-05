import { defineTable } from "convex/server"
import { v } from "convex/values"
const fixturePhase = v.union(
    v.literal("upcoming"),
    v.literal("live"),
    v.literal("completed"),
    v.literal("cancelled")
)
/**
 * Every League match of the public index, shared by all workspaces (WD
 * League panels). Guild data such as highlighted teams is applied on read.
 */
export const leagueFixtures = defineTable({
    matchId: v.string(),
    firstSeenAt: v.number(),
    tab: v.union(v.literal("fixtures"), v.literal("results"), v.null()),
    /** Listed by the latest index scan. */
    listed: v.boolean(),
    phase: fixturePhase,
    scheduledAt: v.optional(v.number()),
    fixtureNumber: v.optional(v.number()),
    snapshotJson: v.optional(v.string()),
    hasResult: v.boolean(),
    resultSeenAt: v.optional(v.number()),
    /** Results parser that read the stored page; a new parser re-reads it once. */
    resultsParser: v.optional(v.string()),
    changes: v.array(v.string()),
    changedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    nextRefreshAt: v.number(),
    leaseUntil: v.number(),
    fence: v.number(),
    revision: v.number(),
})
    .index("matchId", ["matchId"])
    .index("phase_nextRefreshAt", ["phase", "nextRefreshAt"])
    .index("phase_scheduledAt", ["phase", "scheduledAt"])
    .index("phase_hasResult", ["phase", "hasResult"])
/** League placements the table and recent results are computed from. */
export const leagueResults = defineTable({
    matchId: v.string(),
    sourceUrl: v.string(),
    fixtureNumber: v.union(v.number(), v.null()),
    type: v.union(v.string(), v.null()),
    occurredAt: v.number(),
    season: v.string(),
    pointsRule: v.array(v.number()),
    pointsRuleSource: v.union(v.literal("published"), v.literal("default")),
    confirmed: v.boolean(),
    placements: v.array(
        v.object({
            place: v.number(),
            teamCode: v.string(),
            teamName: v.union(v.string(), v.null()),
            faction: v.union(v.string(), v.null()),
        })
    ),
    revision: v.number(),
})
    .index("matchId", ["matchId"])
    .index("season_occurredAt", ["season", "occurredAt"])
    .index("occurredAt", ["occurredAt"])
/** Singleton bookkeeping of the League-wide collection. */
export const leagueCollectionState = defineTable({
    key: v.string(),
    admittedIndexAt: v.optional(v.number()),
    /** Index links that did not fit the store at the last admission. */
    skipped: v.optional(v.number()),
    fixturesRevision: v.number(),
    resultsRevision: v.number(),
}).index("key", ["key"])
