import { defineTable } from "convex/server"
import { v } from "convex/values"

export const leagueAutoImportSettings = defineTable({
    guildId: v.string(),
    settingsJson: v.string(),
    credentialJson: v.string(),
    revision: v.number(),
    enabled: v.boolean(),
    nextPollAt: v.number(),
    leaseUntil: v.number(),
    fence: v.number(),
    lastSuccessAt: v.optional(v.number()),
    error: v.optional(v.string()),
})
    .index("guildId", ["guildId"])
    .index("due", ["enabled", "nextPollAt"])
export const leagueAutoImportFixtures = defineTable({
    guildId: v.string(),
    fixtureId: v.string(),
    eventId: v.optional(v.id("events")),
    settingsJson: v.optional(v.string()),
    cachePending: v.optional(v.boolean()),
    baselineJson: v.optional(v.string()),
    teamBaselineJson: v.optional(v.string()),
    templateJson: v.optional(v.string()),
    overrides: v.array(v.string()),
    issue: v.optional(v.string()),
    updatedAt: v.number(),
})
    .index("eventId", ["eventId"])
    .index("cachePending", ["cachePending"])
    .index("identity", ["guildId", "fixtureId"])
    .index("guildId", ["guildId"])
