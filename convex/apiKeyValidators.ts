import { v } from "convex/values"

export const apiKeyReadAccess = v.object({
    resources: v.array(
        v.union(
            v.literal("events"),
            v.literal("groups"),
            v.literal("rosters"),
            v.literal("assignments"),
            v.literal("stratmaps"),
            v.literal("matches")
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
