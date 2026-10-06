import { v } from "convex/values"

import {
    introChannel,
    planFromDoc,
    runFromDoc,
    seedPlayerCounts,
    seedPorts,
    seedServerPanel,
    seedServerSnapshot,
    seedStoreReader,
} from "./discordSeedStore"
import {
    parseSeedPublicationKey,
    seedPublicationKey,
    type SeedMessageKind,
} from "../src/domain/discord-seed/publication-keys"
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
import type { ServerSnapshot } from "../src/domain/game-data/contracts"
import type { SeedPlanSettings } from "../src/domain/discord-seed/plan"
import { stopSeed } from "../src/application/discord-seed/stop-seed"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { getGuildByDiscordId, getUserByDiscordId } from "./identity"
import { assertInternalSecret } from "./discord_shared"
import { panelServerInfos } from "./discordPanelStore"
import type { Doc } from "./_generated/dataModel"
import { seedFailure } from "./discordSeedTable"

/**
 * The bot's side of the seed (board P5): everything it needs to draw the
 * call, the control message per server and the pinned intro, the delivery
 * receipts, the "Zvát mě na seed" check and the control buttons. Every
 * function checks the internal secret; the buttons also need a Logi admin.
 */

const snowflake = /^\d{17,20}$/

type Reader = Pick<QueryCtx, "db">

/** A seed message's request revision and the revision the bot delivered. */
export type SeedOutboxRef = { revision: number; deliveredRevision: number }
/** Where the bot's managed publication of a seed message is now. */
export type SeedMessageRef = {
    channelId: string | null
    messageId: string | null
}

async function outboxRows(ctx: Reader, guildId: string) {
    return await ctx.db
        .query("discordSeedMessages")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
}

/** The managed publications of the seed, by `seed:<kind>:<key>`. */
async function seedPublications(ctx: Reader, guildId: string) {
    const rows = await ctx.db
        .query("discordPublications")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .collect()
    const refs = new Map<string, SeedMessageRef>()
    for (const row of rows)
        if (parseSeedPublicationKey(row.key))
            refs.set(row.key, {
                channelId: row.channelId,
                messageId: row.messageId,
            })
    return refs
}

const outboxRef = (
    row: Doc<"discordSeedMessages"> | undefined
): SeedOutboxRef | null =>
    row
        ? { revision: row.revision, deliveredRevision: row.deliveredRevision }
        : null

export type SeedDeliveryServer = {
    connectionId: string
    settings: SeedPlanSettings
    revision: number
    name: string | null
    gameId: "hell_let_loose" | "wardogs"
    reading: SeedServerReading | null
    /** The collected snapshot, for the map line and the map picture. */
    snapshot: ServerSnapshot | null
    status: SeedServerStatus
    activeRun: StoredSeedRun | null
    joinUrl: string | null
    panel: { channelId: string; paused: boolean; sent: boolean } | null
    control: { outbox: SeedOutboxRef | null; message: SeedMessageRef | null }
}

export type SeedDeliveryState = {
    servers: SeedDeliveryServer[]
    /** Calls of running seeds (redrawn every 60 s) and of ended seeds whose final state is not delivered yet. */
    calls: Array<{
        run: StoredSeedRun
        outbox: SeedOutboxRef | null
        message: SeedMessageRef | null
    }>
    /** Seed channels and whether their pinned intro should be there. */
    intros: Array<{
        channelId: string
        show: boolean
        roleId: string | null
        servers: Array<{ name: string; schedule: SeedPlanSettings["schedule"] }>
        outbox: SeedOutboxRef | null
        message: SeedMessageRef | null
    }>
}

/** Everything the bot's seed worker draws for one clan. */
export const deliveryState = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args): Promise<SeedDeliveryState> => {
        assertInternalSecret(args.secret)
        const now = Date.now()
        const reader = seedStoreReader(ctx)
        const players = seedPlayerCounts(ctx, () => now)
        const plans = (
            await ctx.db
                .query("discordSeedPlans")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect()
        ).map(planFromDoc)
        const [rows, publications, joinInfos] = await Promise.all([
            outboxRows(ctx, args.guildId),
            seedPublications(ctx, args.guildId),
            panelServerInfos(ctx, args.guildId),
        ])
        const outbox = (kind: SeedMessageKind, key: string) =>
            outboxRef(rows.find((row) => row.kind === kind && row.key === key))
        const message = (kind: SeedMessageKind, key: string) =>
            publications.get(seedPublicationKey(kind, key)) ?? null

        const servers: SeedDeliveryServer[] = []
        for (const plan of plans) {
            const found = await seedServerSnapshot(ctx, plan, now)
            if (!found) continue
            const reading = await players.read(plan)
            const activeRun = plan.state.activeRunId
                ? await reader.run(plan.state.activeRunId)
                : null
            servers.push({
                connectionId: plan.connectionId,
                settings: plan.settings,
                revision: plan.revision,
                name: found.name,
                gameId: found.gameId,
                reading,
                snapshot: found.snapshot,
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
                joinUrl:
                    joinInfos.find(
                        (info) => info.connectionId === plan.connectionId
                    )?.joinUrl ?? null,
                panel: await seedServerPanel(ctx, plan),
                control: {
                    outbox: outbox("control", plan.connectionId),
                    message: message("control", plan.connectionId),
                },
            })
        }

        const calls: SeedDeliveryState["calls"] = []
        const seeding = await ctx.db
            .query("discordSeedRuns")
            .withIndex("guild_status", (q) =>
                q.eq("guildId", args.guildId).eq("status", "seeding")
            )
            .collect()
        for (const doc of seeding) {
            const run = runFromDoc(doc)
            calls.push({
                run,
                outbox: outbox("call", run.id),
                message: message("call", run.id),
            })
        }
        for (const row of rows) {
            if (row.kind !== "call" || row.revision <= row.deliveredRevision)
                continue
            if (calls.some((call) => call.run.id === row.key)) continue
            const run = await reader.run(row.key)
            if (run && run.guildId === args.guildId)
                calls.push({
                    run,
                    outbox: outboxRef(row),
                    message: message("call", run.id),
                })
        }

        const wanted = new Map<
            string,
            {
                roleId: string | null
                servers: SeedDeliveryState["intros"][number]["servers"]
            }
        >()
        for (const plan of plans) {
            const channelId = introChannel(plan)
            if (!channelId) continue
            const entry = wanted.get(channelId) ?? {
                roleId: plan.settings.seedRoleId,
                servers: [],
            }
            const server = servers.find(
                (item) => item.connectionId === plan.connectionId
            )
            if (plan.settings.enabled && server?.name)
                entry.servers.push({
                    name: server.name,
                    schedule: plan.settings.schedule,
                })
            wanted.set(channelId, entry)
        }
        const channels = new Set([
            ...wanted.keys(),
            ...rows.filter((row) => row.kind === "intro").map((row) => row.key),
        ])
        return {
            servers,
            calls,
            intros: [...channels].map((channelId) => ({
                channelId,
                show: wanted.has(channelId),
                roleId: wanted.get(channelId)?.roleId ?? null,
                servers: wanted.get(channelId)?.servers ?? [],
                outbox: outbox("intro", channelId),
                message: message("intro", channelId),
            })),
        }
    },
})

/**
 * The bot delivered (or tried to deliver) one seed message at `revision`; a
 * delivered revision stops the retries of an ended call.
 */
export const recordDelivery = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        kind: v.union(
            v.literal("call"),
            v.literal("control"),
            v.literal("intro")
        ),
        key: v.string(),
        revision: v.number(),
        error: v.optional(v.string()),
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
        if (!row) return false
        const now = Date.now()
        await ctx.db.patch(
            row._id,
            args.error
                ? { error: args.error.slice(0, 240), updatedAt: now }
                : {
                      deliveredRevision: Math.max(
                          row.deliveredRevision,
                          Math.min(args.revision, row.revision)
                      ),
                      lastSuccessAt: now,
                      error: null,
                      updatedAt: now,
                  }
        )
        return true
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
 * Whether a plan of the clan lets players toggle this role themselves
 * ("Zvát mě na seed", P5-B03), and the seed channel for the reply.
 */
export const roleOffer = query({
    args: { secret: v.string(), guildId: v.string(), roleId: v.string() },
    handler: async (ctx, args) => {
        assertInternalSecret(args.secret)
        if (!snowflake.test(args.roleId))
            return { offered: false, seedChannelId: null }
        const plan = (
            await ctx.db
                .query("discordSeedPlans")
                .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
                .collect()
        ).find(
            (row) =>
                row.settings.seedRoleId === args.roleId &&
                row.settings.roleSelfService
        )
        return {
            offered: Boolean(plan),
            seedChannelId: plan?.settings.seedChannelId ?? null,
        }
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
        const publications = await seedPublications(ctx, args.guildId)
        const seeding = await ctx.db
            .query("discordSeedRuns")
            .withIndex("guild_status", (q) =>
                q.eq("guildId", args.guildId).eq("status", "seeding")
            )
            .collect()
        return seeding.flatMap((doc) => {
            const call = publications.get(
                seedPublicationKey("call", String(doc._id))
            )
            const state = toSeedPanelState(
                runFromDoc(doc),
                call?.messageId ?? null
            )
            return state ? [state] : []
        })
    },
})
