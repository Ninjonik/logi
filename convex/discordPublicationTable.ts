import { defineTable } from "convex/server"
import { v } from "convex/values"
export const publicationState = {
    channelId: v.union(v.string(), v.null()),
    messageId: v.union(v.string(), v.null()),
    pending: v.union(
        v.object({ channelId: v.string(), marker: v.string() }),
        v.null()
    ),
    hash: v.union(v.string(), v.null()),
}
export const panelSettings = {
    kind: v.union(
        v.literal("server"),
        v.literal("scoreboard"),
        v.literal("results")
    ),
    connectionId: v.string(),
    channelId: v.string(),
    enabled: v.boolean(),
    showPlayers: v.boolean(),
    artwork: v.boolean(),
    refreshSeconds: v.number(),
}
export const discordPublicPanels = defineTable({
    guildId: v.string(),
    gameId: v.string(),
    ...panelSettings,
    revision: v.number(),
    createdAt: v.number(),
}).index("guildId", ["guildId"])
export const discordPublications = defineTable({
    guildId: v.string(),
    key: v.string(),
    revision: v.number(),
    ...publicationState,
    fence: v.number(),
    leaseUntil: v.number(),
    retryAt: v.number(),
    lastSuccessAt: v.union(v.number(), v.null()),
    error: v.union(v.string(), v.null()),
})
    .index("guild_key", ["guildId", "key"])
    .index("guildId", ["guildId"])
