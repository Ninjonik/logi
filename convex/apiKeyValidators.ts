import { v } from "convex/values"

export const apiKeyReadAccess = v.object({
    resources: v.array(
        v.union(
            v.literal("member-summaries"),
            v.literal("roster-summaries"),
            v.literal("player-stat-summaries"),
            v.literal("league-matches"),
            v.literal("league-fixtures"),
            v.literal("warcon-data"),
            v.literal("hll-live"),
            v.literal("server-game-history"),
            v.literal("membership-summaries"),
            v.literal("server-snapshots"),
            v.literal("integration-health"),
            v.literal("events"),
            v.literal("groups"),
            v.literal("rosters"),
            v.literal("assignments"),
            v.literal("stratmaps"),
            v.literal("matches"),
            v.literal("event-summaries"),
            v.literal("match-summaries"),
            v.literal("result-summaries"),
            v.literal("teams")
        )
    ),
    gameIds: v.array(v.string()),
})
