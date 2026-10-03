import { defineTable } from "convex/server"
import { v } from "convex/values"
export const leagueTrackingSettings = defineTable({
    guildId: v.string(),
    enabled: v.boolean(),
    teamCodes: v.array(v.string()),
    inputChannelId: v.union(v.string(), v.null()),
    outputChannelId: v.union(v.string(), v.null()),
    revision: v.number(),
    lastIndexAt: v.optional(v.number()),
    queueFull: v.optional(v.boolean()),
    intakeWindowAt: v.optional(v.number()),
    intakeCount: v.optional(v.number()),
})
    .index("guildId", ["guildId"])
    .index("enabled", ["enabled"])
export const leagueTrackedMatches = defineTable({
    guildId: v.string(),
    matchId: v.string(),
    firstSeenAt: v.number(),
    revision: v.number(),
    pinned: v.boolean(),
    automatic: v.boolean(),
    tracked: v.boolean(),
    announce: v.boolean(),
    ignored: v.boolean(),
    paused: v.boolean(),
    discordRefs: v.array(
        v.object({ messageId: v.string(), channelId: v.string() })
    ),
    eventId: v.optional(v.string()),
    state: v.union(
        v.literal("pending"),
        v.literal("tracked"),
        v.literal("unmatched"),
        v.literal("ignored"),
        v.literal("paused"),
        v.literal("archived")
    ),
    snapshotJson: v.optional(v.string()),
    error: v.optional(v.string()),
    lastAttemptAt: v.optional(v.number()),
    nextRefreshAt: v.number(),
    leaseUntil: v.number(),
    fence: v.number(),
})
    .index("identity", ["guildId", "matchId"])
    .index("guildId", ["guildId"])
    .index("published", ["guildId", "tracked"])
    .index("due", ["state", "nextRefreshAt"])
    .index("event", ["guildId", "eventId"])
export const leagueIndexCache = defineTable({
    key: v.string(),
    matchUrls: v.array(v.string()),
    fixtureUrls: v.array(v.string()),
    incomplete: v.boolean(),
    fetchedAt: v.optional(v.number()),
    lastAttemptAt: v.optional(v.number()),
    nextScanAt: v.number(),
    leaseUntil: v.number(),
    fence: v.number(),
    error: v.optional(v.string()),
}).index("key", ["key"])
export const leagueMessageRefs = defineTable({
    guildId: v.string(),
    messageId: v.string(),
    channelId: v.string(),
    matchIds: v.array(v.string()),
    version: v.optional(v.number()),
    deleted: v.optional(v.boolean()),
    expiresAt: v.optional(v.number()),
})
    .index("identity", ["guildId", "messageId"])
    .index("guildId", ["guildId"])
    .index("expiresAt", ["expiresAt"])
