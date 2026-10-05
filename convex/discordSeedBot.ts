import { v } from "convex/values"

import {
    introChannel,
    planFromDoc,
    runFromDoc,
    seedPlayerCounts,
    seedPorts,
    seedStoreReader,
} from "./discordSeedStore"
import {
    startResultView,
    stopResultView,
    type SeedActionResult,
} from "../src/application/discord-seed/action-result"
import {
    recordSeedCallPosted,
    reportSeedCallFailed,
} from "../src/application/discord-seed/delivery"
import {
    toSeedPanelState,
    type SeedPanelState,
} from "../src/application/discord-seed/panel-state"
import {
    seedServerStatus,
    type SeedServerStatus,
} from "../src/domain/discord-seed/thresholds"
import type {
    SeedServerReading,
    StoredSeedRun,
} from "../src/application/discord-seed/ports"
import { canAdminServerContext } from "../src/infrastructure/convex/server-read-model"
import { startSeedManually } from "../src/application/discord-seed/start-seed"
import type { SeedPlanSettings } from "../src/domain/discord-seed/plan"
import { stopSeed } from "../src/application/discord-seed/stop-seed"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { getGuildByDiscordId, getUserByDiscordId } from "./identity"
import { publicationState } from "./discordPublicationTable"
import { assertInternalSecret } from "./discord_shared"
import type { Doc } from "./_generated/dataModel"
import { seedFailure } from "./discordSeedTable"

/**
 * The bot's side of the seed: everything it needs to render the call, the
 * control message and the pinned intro, the managed-message lease, and the
 * Discord buttons. Every function checks the internal secret.
 */

const LEASE_MS = 120_000
const RETRY_MS = 30_000
const snowflake = /^\d{17,20}$/

type Reader = Pick<QueryCtx, "db">

export type SeedMessageRef = {
    id: string
    kind: Doc<"discordSeedMessages">["kind"]
    key: string
    revision: number
    deliveredRevision: number
    channelId: string | null
    messageId: string | null
}

const messageRef = (row: Doc<"discordSeedMessages">): SeedMessageRef => ({
    id: String(row._id),
    kind: row.kind,
    key: row.key,
    revision: row.revision,
    deliveredRevision: row.deliveredRevision,
    channelId: row.channelId,
    messageId: row.messageId,
})

async function messageRows(ctx: Reader, guildId: string) {
    return await ctx.db
        .query("discordSeedMessages")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
}

export type SeedDeliveryState = {
    servers: Array<{
        connectionId: string
        settings: SeedPlanSettings
        revision: number
        reading: SeedServerReading | null
        status: SeedServerStatus
        activeRun: StoredSeedRun | null
        control: SeedMessageRef | null
    }>
    /** Calls of running seeds (refreshed every 60 s) and of ended seeds with an undelivered final state. */
    calls: Array<{ run: StoredSeedRun; message: SeedMessageRef | null }>
    /** Seed channels and whether their pinned intro should exist. */
    intros: Array<{
        channelId: string
        show: boolean
        roleId: string | null
        message: SeedMessageRef | null
    }>
}

/** Everything the bot's seed worker renders for one clan. */
export const deliveryState = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args): Promise<SeedDeliveryState> => {
        assertInternalSecret(args.secret)
        const now = Date.now()
        const reader = seedStoreReader(ctx)
        const players = seedPlayerCounts(ctx, () => now)
        const plans = await ctx.db
            .query("discordSeedPlans")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
        const rows = await messageRows(ctx, args.guildId)
        const find = (kind: SeedMessageRef["kind"], key: string) => {
            const row = rows.find(
                (entry) => entry.kind === kind && entry.key === key
            )
            return row ? messageRef(row) : null
        }
        const servers: SeedDeliveryState["servers"] = []
        for (const doc of plans) {
            const plan = planFromDoc(doc)
            const reading = await players.read(plan)
            const activeRun = plan.state.activeRunId
                ? await reader.run(plan.state.activeRunId)
                : null
            servers.push({
                connectionId: plan.connectionId,
                settings: plan.settings,
                revision: plan.revision,
                reading,
                status: seedServerStatus(
                    {
                        phase: plan.state.phase,
                        players: reading?.players ?? null,
                        online: reading?.online ?? null,
                        fresh: reading?.fresh ?? false,
                    },
                    plan.settings
                ),
                activeRun: activeRun?.status === "seeding" ? activeRun : null,
                control: find("control", plan.connectionId),
            })
        }
        const calls: SeedDeliveryState["calls"] = []
        const seeding = await ctx.db
            .query("discordSeedRuns")
            .withIndex("guild_status", (q) =>
                q.eq("guildId", args.guildId).eq("status", "seeding")
            )
            .collect()
        for (const run of seeding)
            calls.push({
                run: runFromDoc(run),
                message: find("call", String(run._id)),
            })
        for (const row of rows) {
            if (row.kind !== "call" || row.revision <= row.deliveredRevision)
                continue
            if (calls.some((call) => call.run.id === row.key)) continue
            const run = await reader.run(row.key)
            if (run && run.guildId === args.guildId)
                calls.push({ run, message: messageRef(row) })
        }
        const wanted = new Map<string, string | null>()
        for (const doc of plans) {
            const channelId = introChannel(doc)
            if (channelId) wanted.set(channelId, doc.settings.seedRoleId)
        }
        const introKeys = new Set([
            ...wanted.keys(),
            ...rows.filter((row) => row.kind === "intro").map((row) => row.key),
        ])
        return {
            servers,
            calls,
            intros: [...introKeys].map((channelId) => ({
                channelId,
                show: wanted.has(channelId),
                roleId: wanted.get(channelId) ?? null,
                message: find("intro", channelId),
            })),
        }
    },
})

const messageKind = v.union(
    v.literal("call"),
    v.literal("control"),
    v.literal("intro")
)

/**
 * Takes the lease of one managed seed message for the revision the bot
 * rendered. A newer request, a running lease or a retry wait answers null.
 */
export const claimMessage = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        kind: messageKind,
        key: v.string(),
        revision: v.number(),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (args.key.length > 100 || !Number.isInteger(args.revision))
            throw new Error("Invalid seed message.")
        const row = await ctx.db
            .query("discordSeedMessages")
            .withIndex("guild_kind_key", (q) =>
                q
                    .eq("guildId", args.guildId)
                    .eq("kind", args.kind)
                    .eq("key", args.key)
            )
            .first()
        const now = Date.now()
        if (
            !row ||
            row.leaseUntil > now ||
            row.retryAt > now ||
            row.revision > args.revision
        )
            return null
        const fence = row.fence + 1
        await ctx.db.patch(row._id, {
            fence,
            leaseUntil: now + LEASE_MS,
            claimedRevision: args.revision,
        })
        return {
            id: String(row._id),
            fence,
            channelId: row.channelId,
            messageId: row.messageId,
            pending: row.pending,
            hash: row.hash,
        }
    },
})

export const saveMessage = mutation({
    args: {
        secret: v.string(),
        id: v.id("discordSeedMessages"),
        fence: v.number(),
        ...publicationState,
    },
    handler: async (ctx, { secret, id, fence, ...state }) => {
        assertInternalSecret(secret)
        const row = await ctx.db.get(id)
        if (!row || row.fence !== fence || row.leaseUntil <= Date.now())
            throw new Error("Seed message lease expired.")
        await ctx.db.patch(id, { ...state, updatedAt: Date.now() })
    },
})

export const finishMessage = mutation({
    args: {
        secret: v.string(),
        id: v.id("discordSeedMessages"),
        fence: v.number(),
        error: v.optional(v.string()),
        retryAfterMs: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const row = await ctx.db.get(args.id)
        if (!row || row.fence !== args.fence) return
        const now = Date.now()
        await ctx.db.patch(
            args.id,
            args.error
                ? {
                      leaseUntil: 0,
                      error: args.error.slice(0, 240),
                      retryAt:
                          now +
                          Math.min(
                              3_600_000,
                              Math.max(RETRY_MS, args.retryAfterMs ?? 0)
                          ),
                      updatedAt: now,
                  }
                : {
                      leaseUntil: 0,
                      error: null,
                      retryAt: 0,
                      lastSuccessAt: now,
                      deliveredRevision: Math.max(
                          row.deliveredRevision,
                          row.claimedRevision
                      ),
                      updatedAt: now,
                  }
        )
    },
})

/** The call is in Discord; records the pinged member count for the history. */
export const recordCallPosted = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        runId: v.string(),
        pingedMembers: v.union(v.number(), v.null()),
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        const result = await recordSeedCallPosted(seedPorts(ctx), {
            guildId: args.guildId,
            runId: args.runId,
            pingedMembers:
                args.pingedMembers === null
                    ? null
                    : Math.max(0, Math.trunc(args.pingedMembers)),
        })
        return result.kind
    },
})

/** The call cannot be posted (missing channel or permission): the run fails. */
export const reportCallFailed = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        runId: v.string(),
        reason: seedFailure,
    },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        return (await reportSeedCallFailed(seedPorts(ctx), args)).kind
    },
})

/**
 * Whether a Discord member is a Logi admin of the clan, from the synchronised
 * access record (the same rule as the dashboard). The bot checks the clicking
 * member's current roles as well, on every click (P5-29).
 */
async function isClanAdmin(ctx: Reader, guildId: string, userId: string) {
    if (!snowflake.test(userId)) return false
    const server = await getGuildByDiscordId(ctx, guildId)
    if (!server) return false
    const access = await ctx.db
        .query("discordMemberAccess")
        .withIndex("guildId_userId", (q) =>
            q.eq("guildId", guildId).eq("userId", userId)
        )
        .unique()
    return canAdminServerContext({
        serverAdminIds: server.adminIds,
        dashboardAdminIds: server.dashboardAdminIds,
        adminAccessOverrides: server.adminAccessOverrides,
        userId,
        discordAccess: access,
    })
}

async function discordActor(ctx: Reader, userId: string, displayName: string) {
    const user = await getUserByDiscordId(ctx, userId)
    const name = (user?.name || displayName).trim().slice(0, 100)
    // The history shows names only; the bot always sends the member's display name.
    if (!name) throw new Error("Invalid actor.")
    return { id: userId, name }
}

const buttonArgs = {
    secret: v.string(),
    guildId: v.string(),
    connectionId: v.string(),
    discordUserId: v.string(),
    displayName: v.string(),
    /** The control message's channel. */
    channelId: v.string(),
}

/** "Spustit seed" on the "Ovládání serveru" message (P5-26, P5-30, P5-31). */
export const startFromDiscord = mutation({
    args: { ...buttonArgs, interactionId: v.string() },
    handler: async (ctx, args): Promise<SeedActionResult> => {
        assertInternalSecret(args.secret)
        if (!snowflake.test(args.interactionId))
            throw new Error("Invalid interaction.")
        if (!(await isClanAdmin(ctx, args.guildId, args.discordUserId)))
            return { status: "forbidden" }
        return startResultView(
            await startSeedManually(seedPorts(ctx), {
                server: {
                    guildId: args.guildId,
                    connectionId: args.connectionId,
                },
                actor: await discordActor(
                    ctx,
                    args.discordUserId,
                    args.displayName
                ),
                via: "discord",
                channelId: args.channelId,
                requestKey: `discord:${args.interactionId}`,
            })
        )
    },
})

/** "Ukončit seed" on the "Ovládání serveru" message (P5-28). */
export const stopFromDiscord = mutation({
    args: buttonArgs,
    handler: async (ctx, args): Promise<SeedActionResult> => {
        assertInternalSecret(args.secret)
        if (!(await isClanAdmin(ctx, args.guildId, args.discordUserId)))
            return { status: "forbidden" }
        return stopResultView(
            await stopSeed(seedPorts(ctx), {
                server: {
                    guildId: args.guildId,
                    connectionId: args.connectionId,
                },
                actor: await discordActor(
                    ctx,
                    args.discordUserId,
                    args.displayName
                ),
                via: "discord",
            })
        )
    },
})

/**
 * Running seeds of a clan for the server panels' seed mode (P5-15..19): the
 * panels workstream reads seed state here and never changes it.
 */
export const panelStates = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args): Promise<SeedPanelState[]> => {
        assertInternalSecret(args.secret)
        const rows = await messageRows(ctx, args.guildId)
        const seeding = await ctx.db
            .query("discordSeedRuns")
            .withIndex("guild_status", (q) =>
                q.eq("guildId", args.guildId).eq("status", "seeding")
            )
            .collect()
        return seeding.flatMap((doc) => {
            const call = rows.find(
                (row) => row.kind === "call" && row.key === String(doc._id)
            )
            const state = toSeedPanelState(
                runFromDoc(doc),
                call?.messageId ?? null
            )
            return state ? [state] : []
        })
    },
})
