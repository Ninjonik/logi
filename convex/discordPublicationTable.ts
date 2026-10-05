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
/** Panel style A/B/C; absent or null follows the clan default (additive). */
const panelStyle = v.optional(
    v.union(v.literal("a"), v.literal("b"), v.literal("c"), v.null())
)
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
    style: panelStyle,
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
    style: panelStyle,
})
const panelFeatureSettings = {
    // `scoreboard` is stored by panels saved before L3-02 and reads as `server`.
    kind: v.union(
        v.literal("server"),
        v.literal("scoreboard"),
        v.literal("results"),
        v.literal("servers"),
        v.literal("league"),
        v.literal("calendar"),
        v.literal("competition")
    ),
    // Optional for panels without one server (results by game, combined,
    // calendar, competition, WD League); every live server panel has one.
    connectionId: v.optional(v.string()),
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
/** What a live server panel shows besides its layout (P2-11..20); absent = defaults. */
export const panelContent = v.object({
    nextMap: v.optional(v.boolean()),
    queue: v.optional(v.boolean()),
    address: v.optional(v.boolean()),
    joinButton: v.optional(v.boolean()),
    password: v.optional(v.boolean()),
    seedProgress: v.optional(v.boolean()),
    footerTiming: v.optional(v.boolean()),
})
export const panelLeagueOptions = v.object({
    table: v.boolean(),
    fixtures: v.boolean(),
    recentResults: v.boolean(),
    fixtureCount: v.number(),
})
export const panelAction = v.union(
    v.literal("publish"),
    v.literal("refresh"),
    v.literal("pause"),
    v.literal("resume"),
    v.literal("retry"),
    v.literal("delete"),
    v.literal("remove")
)
/** Fields of "Panely v Discordu" (W1); all optional so older rows stay valid. */
export const panelManagement = {
    connectionIds: v.optional(v.array(v.string())),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    content: v.optional(panelContent),
    league: v.optional(panelLeagueOptions),
    calendarCategories: v.optional(v.array(v.string())),
    competitionId: v.optional(v.string()),
    /** The real pause flag (P5-B06); absent reads the old `enabled` switch. */
    paused: v.optional(v.boolean()),
    pausedAt: v.optional(v.union(v.number(), v.null())),
    pausedBy: v.optional(v.union(v.string(), v.null())),
    /** Saved but not sent ("Neodesláno"); absent on panels that posted on save. */
    draft: v.optional(v.boolean()),
    /** The bot removes the panel's messages, then the row. */
    removing: v.optional(v.boolean()),
    savedAt: v.optional(v.number()),
    savedBy: v.optional(v.string()),
    /** The latest admin request the bot answers on its next pass. */
    requestedAt: v.optional(v.number()),
    requestKind: v.optional(panelAction),
}
export const discordPublicPanels = defineTable({
    guildId: v.string(),
    gameId: v.string(),
    ...panelSettings,
    ...panelManagement,
    revision: v.number(),
    createdAt: v.number(),
}).index("guildId", ["guildId"])
const nullableNumber = v.union(v.number(), v.null())
/** What the bot last did with a panel (P1-B01..B03, P2-31..33). */
export const discordPanelStatus = defineTable({
    guildId: v.string(),
    panelId: v.string(),
    claimedAt: nullableNumber,
    attemptAt: nullableNumber,
    successAt: nullableNumber,
    nextAt: nullableNumber,
    dataAt: nullableNumber,
    handledRequestAt: nullableNumber,
    error: v.union(
        v.object({
            code: v.string(),
            at: v.number(),
            permissions: v.optional(v.array(v.string())),
            category: v.optional(v.string()),
        }),
        v.null()
    ),
    warnings: v.array(v.string()),
    messages: v.number(),
    sentAt: nullableNumber,
    /** When the admins were told the channel turned public (P4-30). */
    passwordNotifiedAt: v.optional(nullableNumber),
})
    .index("panelId", ["panelId"])
    .index("guildId", ["guildId"])
/**
 * Per game server: the join link slug, the address or join code shown on
 * panels and the join page, and the password encrypted with the operator
 * keyring (AES-256-GCM, never in plaintext).
 */
export const discordPanelServers = defineTable({
    guildId: v.string(),
    connectionId: v.string(),
    slug: v.string(),
    address: v.union(v.string(), v.null()),
    joinCode: v.union(v.string(), v.null()),
    password: v.union(
        v.object({
            format: v.literal(1),
            keyId: v.string(),
            nonce: v.string(),
            ciphertext: v.string(),
            tag: v.string(),
        }),
        v.null()
    ),
    passwordUpdatedAt: nullableNumber,
    updatedAt: v.number(),
})
    .index("guild_connection", ["guildId", "connectionId"])
    .index("slug", ["slug"])
/** The bot's heartbeat: `bot` for the process, `guild:<id>` per served workspace. */
export const discordBotHeartbeats = defineTable({
    key: v.string(),
    version: v.string(),
    protocol: v.number(),
    startedAt: v.number(),
    seenAt: v.number(),
}).index("key", ["key"])
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
