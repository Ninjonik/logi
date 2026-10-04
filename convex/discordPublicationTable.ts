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
const panelFactionEmoji = v.object({
    allies: v.optional(v.string()),
    axis: v.optional(v.string()),
    valkyra: v.optional(v.string()),
    manticore: v.optional(v.string()),
    lonestar: v.optional(v.string()),
})
/** Client appearance input; the domain schema fills defaults and rejects malformed values. */
export const panelPresentationInput = v.object({
    layout: v.optional(
        v.object({
            showMap: v.optional(v.boolean()),
            showScoreboard: v.optional(v.boolean()),
            showPlayerCount: v.optional(v.boolean()),
            compact: v.optional(v.boolean()),
        })
    ),
    accentColor: v.optional(v.union(v.string(), v.null())),
    bannerAssetId: v.optional(v.union(v.string(), v.null())),
    factionEmoji: v.optional(panelFactionEmoji),
})
/** Stored appearance is complete; `bannerUrl` comes from the verified asset, never the client. */
export const panelPresentation = v.object({
    layout: v.object({
        showMap: v.boolean(),
        showScoreboard: v.boolean(),
        showPlayerCount: v.boolean(),
        compact: v.boolean(),
    }),
    accentColor: v.union(v.string(), v.null()),
    bannerAssetId: v.union(v.string(), v.null()),
    bannerUrl: v.union(v.string(), v.null()),
    factionEmoji: panelFactionEmoji,
})
const panelFeatureSettings = {
    kind: v.union(
        v.literal("server"),
        v.literal("scoreboard"),
        v.literal("results")
    ),
    connectionId: v.string(),
    channelId: v.string(),
    enabled: v.boolean(),
    showPlayers: v.boolean(),
    showLeaders: v.optional(v.boolean()),
    reportCategoryId: v.optional(v.string()),
    artwork: v.boolean(),
    refreshSeconds: v.number(),
}
export const panelSettingsInput = {
    ...panelFeatureSettings,
    presentation: v.optional(panelPresentationInput),
}
/** Legacy rows have no presentation and keep their previous rendering. */
export const panelSettings = {
    ...panelFeatureSettings,
    presentation: v.optional(panelPresentation),
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
