import { defineTable } from "convex/server"
import { v } from "convex/values"

import { publicationState } from "./discordPublicationTable"

/**
 * Seed tables (Discord redesign P3/P5). Additive: one plan per game server,
 * every run kept as history, and the managed Discord messages of the feature.
 * Shapes mirror `src/domain/discord-seed`; the domain validates the values.
 */

const nullableNumber = v.union(v.number(), v.null())
const nullableString = v.union(v.string(), v.null())

export const seedPlanSettings = v.object({
    enabled: v.boolean(),
    liveFrom: v.number(),
    startBelow: v.number(),
    schedule: v.object({
        enabled: v.boolean(),
        slots: v.array(
            v.object({ days: v.array(v.number()), time: v.string() })
        ),
    }),
    auto: v.object({
        enabled: v.boolean(),
        below: v.number(),
        from: v.string(),
        to: v.string(),
    }),
    seedChannelId: nullableString,
    controlChannelId: nullableString,
    seedRoleId: nullableString,
    roleSelfService: v.boolean(),
    pingWindowMinutes: v.number(),
    cooldownMinutes: v.number(),
    maxDurationMinutes: v.number(),
    template: nullableString,
    endAction: v.union(v.literal("edit"), v.literal("delete")),
})

export const seedPlanState = v.object({
    phase: v.union(v.literal("live"), v.literal("not_live"), v.null()),
    lastStartedAt: nullableNumber,
    lastPingAt: nullableNumber,
    lastLiveAt: nullableNumber,
    lastAutoStartAt: nullableNumber,
    consumedOccurrence: nullableString,
    activeRunId: v.union(v.id("discordSeedRuns"), v.null()),
})

const seedActionSource = v.union(v.literal("web"), v.literal("discord"))
const seedActor = { id: v.string(), name: v.string() }

export const seedTrigger = v.union(
    v.object({
        kind: v.literal("manual"),
        actor: v.object(seedActor),
        via: seedActionSource,
        channelId: nullableString,
    }),
    v.object({
        kind: v.literal("schedule"),
        days: v.array(v.number()),
        time: v.string(),
        occurrence: v.string(),
    }),
    v.object({ kind: v.literal("auto"), below: v.number() })
)

export const seedPing = v.union(
    v.object({ kind: v.literal("role"), roleId: v.string() }),
    v.object({
        kind: v.literal("silent"),
        reason: v.literal("ping_window"),
        windowMinutes: v.number(),
        nextPingAt: v.number(),
    }),
    v.object({ kind: v.literal("silent"), reason: v.literal("no_role") })
)

export const seedFailure = v.union(
    v.literal("call_not_delivered"),
    v.literal("channel_unavailable"),
    v.literal("server_unavailable")
)

export const discordSeedPlans = defineTable({
    guildId: v.string(),
    /** `gameDataConnections` ID of the server, as the panels store it. */
    connectionId: v.string(),
    /** Mirrors `settings.enabled` for the tick's index. */
    enabled: v.boolean(),
    settings: seedPlanSettings,
    state: seedPlanState,
    revision: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    /** Discord ID of the admin who saved last. */
    updatedBy: v.string(),
})
    .index("guild_connection", ["guildId", "connectionId"])
    .index("guildId", ["guildId"])
    .index("enabled", ["enabled"])

export const discordSeedRuns = defineTable({
    guildId: v.string(),
    connectionId: v.string(),
    planId: v.id("discordSeedPlans"),
    channelId: v.string(),
    requestKey: nullableString,
    serverName: nullableString,
    status: v.union(
        v.literal("seeding"),
        v.literal("live"),
        v.literal("ended_timeout"),
        v.literal("ended_admin"),
        v.literal("failed")
    ),
    trigger: seedTrigger,
    startedAt: v.number(),
    deadlineAt: v.number(),
    endedAt: nullableNumber,
    liveFrom: v.number(),
    endAction: v.union(v.literal("edit"), v.literal("delete")),
    ping: seedPing,
    players: v.object({
        start: nullableNumber,
        latest: nullableNumber,
        peak: nullableNumber,
        end: nullableNumber,
        capacity: nullableNumber,
        map: nullableString,
        observedAt: nullableNumber,
    }),
    callPostedAt: nullableNumber,
    pingedMembers: nullableNumber,
    endedBy: v.union(
        v.object({ ...seedActor, via: seedActionSource }),
        v.null()
    ),
    failure: v.union(seedFailure, v.null()),
    updatedAt: v.number(),
})
    .index("guild_connection_startedAt", [
        "guildId",
        "connectionId",
        "startedAt",
    ])
    .index("guild_connection_requestKey", [
        "guildId",
        "connectionId",
        "requestKey",
    ])
    .index("guild_status", ["guildId", "status"])
    .index("status", ["status"])

/**
 * Managed seed messages: the call of each run (`key` = run ID), the control
 * message of each server (`key` = connection ID) and the pinned intro of each
 * seed channel (`key` = channel ID). `revision` grows with every request; the
 * bot claims a revision, delivers it with the managed-publication algorithm
 * and records it as delivered.
 */
export const discordSeedMessages = defineTable({
    guildId: v.string(),
    kind: v.union(v.literal("call"), v.literal("control"), v.literal("intro")),
    key: v.string(),
    revision: v.number(),
    deliveredRevision: v.number(),
    claimedRevision: v.number(),
    ...publicationState,
    fence: v.number(),
    leaseUntil: v.number(),
    retryAt: v.number(),
    lastSuccessAt: nullableNumber,
    error: nullableString,
    updatedAt: v.number(),
})
    .index("guild_kind_key", ["guildId", "kind", "key"])
    .index("guildId", ["guildId"])
