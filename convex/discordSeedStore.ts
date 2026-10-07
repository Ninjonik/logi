import type {
    NewSeedRun,
    SeedMessagePort,
    SeedPlayerCountPort,
    SeedPorts,
    SeedServerReading,
    SeedServerRef,
    SeedStore,
    SeedStoreReader,
    StoredSeedPlan,
    StoredSeedRun,
} from "../src/application/discord-seed/ports"
import {
    hllLiveWithFreshness,
    readHllLivePayload,
} from "../src/domain/game-data/hll-live-payload"
import {
    isPanelPaused,
    normalizePanelKind,
} from "../src/domain/discord-publications/settings"
import {
    initialSeedPlanState,
    type SeedPlanState,
} from "../src/domain/discord-seed/plan"
import type { SeedServerTab } from "../src/application/discord-seed/read-dashboard"
import { resolveClanTimeZone } from "../src/domain/discord-seed/clock"
import { resolveSource, workspaceSources } from "./gameDataCatalog"
import { projectSnapshot } from "../src/domain/game-data/policy"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"

/**
 * Convex adapters of the seed ports. Every read is scoped by the clan's
 * Discord ID; a connection or run of another clan reads as missing.
 */

type Reader = Pick<QueryCtx, "db">
type Writer = Pick<MutationCtx, "db">

export function planFromDoc(doc: Doc<"discordSeedPlans">): StoredSeedPlan {
    return {
        id: String(doc._id),
        guildId: doc.guildId,
        connectionId: doc.connectionId,
        settings: doc.settings,
        state: {
            ...doc.state,
            activeRunId:
                doc.state.activeRunId === null
                    ? null
                    : String(doc.state.activeRunId),
        },
        revision: doc.revision,
    }
}

/** The stored fields of a run except its plan reference, listed explicitly. */
function runFields(run: Omit<NewSeedRun, "planId">) {
    return {
        guildId: run.guildId,
        connectionId: run.connectionId,
        channelId: run.channelId,
        requestKey: run.requestKey,
        serverName: run.serverName,
        status: run.status,
        trigger: run.trigger,
        startedAt: run.startedAt,
        deadlineAt: run.deadlineAt,
        endedAt: run.endedAt,
        liveFrom: run.liveFrom,
        endAction: run.endAction,
        ping: run.ping,
        players: run.players,
        callPostedAt: run.callPostedAt,
        pingedMembers: run.pingedMembers,
        endedBy: run.endedBy,
        failure: run.failure,
        joins: run.joins ?? null,
    }
}

export function runFromDoc(doc: Doc<"discordSeedRuns">): StoredSeedRun {
    return {
        ...runFields(doc),
        id: String(doc._id),
        planId: String(doc.planId),
    }
}

async function planDoc(ctx: Reader, server: SeedServerRef) {
    return await ctx.db
        .query("discordSeedPlans")
        .withIndex("guild_connection", (q) =>
            q
                .eq("guildId", server.guildId)
                .eq("connectionId", server.connectionId)
        )
        .first()
}

export function seedStoreReader(ctx: Reader): SeedStoreReader {
    return {
        async plansToEvaluate() {
            const enabled = await ctx.db
                .query("discordSeedPlans")
                .withIndex("enabled", (q) => q.eq("enabled", true))
                .collect()
            const plans = new Map(enabled.map((doc) => [String(doc._id), doc]))
            const seeding = await ctx.db
                .query("discordSeedRuns")
                .withIndex("status", (q) => q.eq("status", "seeding"))
                .collect()
            for (const run of seeding) {
                if (plans.has(String(run.planId))) continue
                const doc = await ctx.db.get(run.planId)
                if (doc) plans.set(String(doc._id), doc)
            }
            return [...plans.values()].map(planFromDoc)
        },
        async plan(server) {
            const doc = await planDoc(ctx, server)
            return doc ? planFromDoc(doc) : null
        },
        async run(id) {
            const runId = ctx.db.normalizeId("discordSeedRuns", id)
            const doc = runId ? await ctx.db.get(runId) : null
            return doc ? runFromDoc(doc) : null
        },
        async runByRequestKey(server, requestKey) {
            const doc = await ctx.db
                .query("discordSeedRuns")
                .withIndex("guild_connection_requestKey", (q) =>
                    q
                        .eq("guildId", server.guildId)
                        .eq("connectionId", server.connectionId)
                        .eq("requestKey", requestKey)
                )
                .first()
            return doc ? runFromDoc(doc) : null
        },
        async runsSince(server, since, limit) {
            const docs = await ctx.db
                .query("discordSeedRuns")
                .withIndex("guild_connection_startedAt", (q) =>
                    q
                        .eq("guildId", server.guildId)
                        .eq("connectionId", server.connectionId)
                        .gte("startedAt", since)
                )
                .order("desc")
                .take(limit)
            return docs.map(runFromDoc)
        },
        async lastRolePingAt(guildId, roleId) {
            const plans = await ctx.db
                .query("discordSeedPlans")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect()
            const times = plans
                .filter(
                    (plan) =>
                        plan.settings.seedRoleId === roleId &&
                        plan.state.lastPingAt !== null
                )
                .map((plan) => plan.state.lastPingAt as number)
            return times.length ? Math.max(...times) : null
        },
        async timeZone(guildId) {
            const config = await ctx.db
                .query("discordConfigs")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .first()
            return resolveClanTimeZone(config?.timezone)
        },
        async isPaused(server) {
            // "Pozastavit panel" (P5-B06) is the panel's own pause flag; rows
            // saved before it read their old "enabled" switch. Live score and
            // server status are one kind (L3-02), so `scoreboard` counts too.
            const panels = (
                await ctx.db
                    .query("discordPublicPanels")
                    .withIndex("guildId", (q) =>
                        q.eq("guildId", server.guildId)
                    )
                    .collect()
            ).filter(
                (panel) =>
                    normalizePanelKind(panel.kind) === "server" &&
                    panel.connectionId === server.connectionId &&
                    !panel.draft &&
                    !panel.removing
            )
            return (
                panels.length > 0 &&
                panels.every((panel) => isPanelPaused(panel))
            )
        },
    }
}

export function seedStore(ctx: Writer, now: () => number): SeedStore {
    const runId = (id: string) => {
        const value = ctx.db.normalizeId("discordSeedRuns", id)
        if (!value) throw new Error("Invalid seed run.")
        return value
    }
    const planId = (id: string) => {
        const value = ctx.db.normalizeId("discordSeedPlans", id)
        if (!value) throw new Error("Invalid seed plan.")
        return value
    }
    const storedState = (state: SeedPlanState) => ({
        ...state,
        activeRunId:
            state.activeRunId === null ? null : runId(state.activeRunId),
    })
    return {
        ...seedStoreReader(ctx),
        async savePlanSettings(input) {
            const existing = await planDoc(ctx, input.server)
            const at = now()
            const fields = {
                enabled: input.settings.enabled,
                settings: input.settings,
                revision: input.revision,
                updatedAt: at,
                updatedBy: input.updatedBy,
            }
            let id: Id<"discordSeedPlans">
            if (existing) {
                id = existing._id
                await ctx.db.patch(id, fields)
            } else
                id = await ctx.db.insert("discordSeedPlans", {
                    ...fields,
                    guildId: input.server.guildId,
                    connectionId: input.server.connectionId,
                    state: storedState(initialSeedPlanState()),
                    createdAt: at,
                })
            const saved = await ctx.db.get(id)
            if (!saved) throw new Error("Seed plan was not saved.")
            return planFromDoc(saved)
        },
        async savePlanState(id, state) {
            await ctx.db.patch(planId(id), { state: storedState(state) })
        },
        async insertRun(run) {
            const id = await ctx.db.insert("discordSeedRuns", {
                ...runFields(run),
                planId: planId(run.planId),
                updatedAt: now(),
            })
            return String(id)
        },
        async saveRun(run) {
            await ctx.db.patch(runId(run.id), {
                ...runFields(run),
                updatedAt: now(),
            })
        },
    }
}

/**
 * The collected snapshot of a server the panels read, with the admin's
 * server alias; null for a connection of another clan or none at all.
 */
export async function seedServerSnapshot(
    ctx: Reader,
    server: SeedServerRef,
    now: number
) {
    const id = ctx.db.normalizeId("gameDataConnections", server.connectionId)
    const row = id ? await ctx.db.get(id) : null
    if (!row || row.guildId !== server.guildId) return null
    const snapshot = projectSnapshot({ ...row, id: String(row._id) }, now)
    const source = await resolveSource(ctx, row.guildId, row.sourceRef)
    return {
        snapshot,
        name: source?.row?.displayName ?? snapshot.displayName,
        gameId: row.gameId,
    }
}

/** The clan's configured game servers: the tabs of the P3 page and the API slice. */
export async function seedServers(
    ctx: Reader,
    guildId: string
): Promise<SeedServerTab[]> {
    const [rows, sources] = await Promise.all([
        ctx.db
            .query("gameDataConnections")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .collect(),
        workspaceSources(ctx, guildId),
    ])
    const aliases = new Map(
        sources.map((entry) => [
            entry.source.ref,
            entry.row?.displayName ?? null,
        ])
    )
    return rows
        .filter((row) => aliases.has(row.sourceRef))
        .map((row) => ({
            connectionId: String(row._id),
            gameId: row.gameId,
            name:
                aliases.get(row.sourceRef) ??
                row.observation?.displayName ??
                null,
        }))
}

/** The server's live panel ("Obnovit panel", "Pozastavit panel"), if it has one. */
export async function seedServerPanel(ctx: Reader, server: SeedServerRef) {
    const panel = (
        await ctx.db
            .query("discordPublicPanels")
            .withIndex("guildId", (q) => q.eq("guildId", server.guildId))
            .collect()
    ).find(
        (row) =>
            normalizePanelKind(row.kind) === "server" &&
            row.connectionId === server.connectionId &&
            !row.removing
    )
    return panel
        ? {
              channelId: panel.channelId,
              paused: isPanelPaused(panel),
              sent: !panel.draft,
          }
        : null
}

/** A live read this old no longer names who is on the server. */
const ROSTER_MAX_AGE_MS = 3 * 60 * 1000

/** The collected snapshot the panels read, with the admin's server alias. */
export function seedPlayerCounts(
    ctx: Reader,
    now: () => number
): SeedPlayerCountPort {
    return {
        /**
         * The named players of the latest fresh HLL live read (the read the
         * server panel keeps in `hllLiveCache`), for distinct seeders
         * (P5-B04). Null without one: Logi then counts the growth.
         */
        async roster(server) {
            const id = ctx.db.normalizeId(
                "gameDataConnections",
                server.connectionId
            )
            const row = id ? await ctx.db.get(id) : null
            if (
                !row ||
                row.guildId !== server.guildId ||
                row.gameId !== "hell_let_loose" ||
                row.provider !== "hll_crcon"
            )
                return null
            const cache = await ctx.db
                .query("hllLiveCache")
                .withIndex("connectionId", (q) => q.eq("connectionId", row._id))
                .unique()
            if (cache?.generation !== row.generation || !cache.dataJson)
                return null
            // Stored by `hllLiveReads:finish` after validation; the row
            // carries the latest read's times.
            const stored = readHllLivePayload(cache.dataJson)
            if (!stored) return null
            const data = hllLiveWithFreshness(stored, cache)
            const at = Date.parse(data.playersAt ?? "")
            if (
                data.playersFreshness !== "fresh" ||
                !Number.isFinite(at) ||
                now() - at > ROSTER_MAX_AGE_MS
            )
                return null
            return {
                ids: data.players.flatMap((player) =>
                    player.playerId ? [player.playerId] : []
                ),
                observedAt: at,
            }
        },
        async read(server): Promise<SeedServerReading | null> {
            const found = await seedServerSnapshot(ctx, server, now())
            if (!found) return null
            const { snapshot } = found
            return {
                name: found.name,
                gameId: found.gameId,
                players: snapshot.players,
                capacity: snapshot.capacity,
                map: snapshot.map,
                online:
                    snapshot.state === "online"
                        ? true
                        : snapshot.state === "offline"
                          ? false
                          : null,
                observedAt: snapshot.observedAt
                    ? Date.parse(snapshot.observedAt)
                    : null,
                fresh: snapshot.freshness === "fresh",
            }
        },
    }
}

/**
 * Records each request as a growing revision of the matching seed message,
 * so the bot's delivery redraws it at once (see `discordSeedMessages`).
 */
export function seedMessageOutbox(
    ctx: Writer,
    now: () => number
): SeedMessagePort {
    async function bump(
        guildId: string,
        kind: Doc<"discordSeedMessages">["kind"],
        key: string
    ) {
        const row = await ctx.db
            .query("discordSeedMessages")
            .withIndex("guild_kind_key", (q) =>
                q.eq("guildId", guildId).eq("kind", kind).eq("key", key)
            )
            .first()
        const at = now()
        if (row)
            await ctx.db.patch(row._id, {
                revision: row.revision + 1,
                updatedAt: at,
            })
        else
            await ctx.db.insert("discordSeedMessages", {
                guildId,
                kind,
                key,
                revision: 1,
                deliveredRevision: 0,
                updatedAt: at,
            })
    }
    async function messageRows(guildId: string, kind: "control" | "intro") {
        return (
            await ctx.db
                .query("discordSeedMessages")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect()
        ).filter((row) => row.kind === kind)
    }
    return {
        async callChanged(run) {
            await bump(run.guildId, "call", run.id)
        },
        async controlChanged(server) {
            const plan = await planDoc(ctx, server)
            const existing = (
                await messageRows(server.guildId, "control")
            ).some((row) => row.key === server.connectionId)
            if (plan?.settings.controlChannelId || existing)
                await bump(server.guildId, "control", server.connectionId)
        },
        async introChanged(guildId) {
            const plans = await ctx.db
                .query("discordSeedPlans")
                .withIndex("guildId", (q) => q.eq("guildId", guildId))
                .collect()
            const channels = new Set(
                (await messageRows(guildId, "intro")).map((row) => row.key)
            )
            for (const plan of plans) {
                const channelId = introChannel(plan)
                if (channelId) channels.add(channelId)
            }
            for (const channelId of channels)
                await bump(guildId, "intro", channelId)
        },
    }
}

/** A seed channel shows the pinned intro when players toggle the role there. */
export function introChannel(plan: Pick<Doc<"discordSeedPlans">, "settings">) {
    const { seedChannelId, seedRoleId, roleSelfService } = plan.settings
    return seedChannelId && seedRoleId && roleSelfService ? seedChannelId : null
}

export function seedReadPorts(ctx: Reader) {
    const now = () => Date.now()
    return {
        store: seedStoreReader(ctx),
        players: seedPlayerCounts(ctx, now),
        clock: { now: () => new Date(now()) },
    }
}

export function seedPorts(ctx: Writer): SeedPorts {
    const now = () => Date.now()
    return {
        store: seedStore(ctx, now),
        players: seedPlayerCounts(ctx, now),
        clock: { now: () => new Date(now()) },
        messages: seedMessageOutbox(ctx, now),
    }
}
