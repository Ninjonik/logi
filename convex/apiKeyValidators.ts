import { v } from "convex/values"

export const apiKeyReadAccess = v.object({
    resources: v.array(
        v.union(
            v.literal("warcon-data"),
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
            v.literal("result-summaries")
        )
    ),
    gameIds: v.array(
        v.union(
            v.literal("hell_let_loose"),
            v.literal("hell_let_loose_vietnam"),
            v.literal("wardogs")
        )
    ),
})
