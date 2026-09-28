import {
    assertMembershipSecret,
    authorizeMembership,
    ensureMembershipGuild,
    memberObservation,
    membershipGuild,
    readMembershipRecord,
    storeMemberObservation,
} from "./membership_shared"
import {
    syncDashboardAdminOverrides,
    upsertDiscordMemberCache,
} from "./discordMemberAccessStore"
import {
    mutation,
    query,
    internalMutation,
    type MutationCtx,
} from "./_generated/server"
import {
    isApiKeyReadAccess,
    allowsApiKeyRead,
} from "../src/domain/api/key-access"
import { applyObservation } from "../src/application/membership/read-membership"
import { nextRevision, revisionOrder } from "../src/domain/integrations/change"
import { isFreshObservation } from "../src/domain/membership/observation"
import { allocateIntegrationRevision } from "./integrationChangeLog"
import { isGameId } from "../src/domain/games/game"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

const subject = {
    secret: v.string(),
    keyHash: v.string(),
    guildId: v.string(),
    discordUserId: v.string(),
    gameId: v.string(),
    maxAgeMs: v.number(),
}
const state = v.union(
    v.literal("present"),
    v.literal("left"),
    v.literal("unknown")
)
const provider = v.object({
    state,
    roleIds: v.array(v.string()),
    observedAt: v.union(v.string(), v.null()),
    retryAfterMs: v.optional(v.number()),
})
const token = v.object({
    epoch: v.string(),
    revision: v.string(),
    fence: v.number(),
    policyVersion: v.string(),
    startedAt: v.string(),
})
function assertAge(maxAgeMs: number) {
    if (!Number.isInteger(maxAgeMs) || maxAgeMs < 1000 || maxAgeMs > 300_000)
        throw new Error("Invalid observation age.")
}

export const prepareLookup = mutation({
    args: subject,
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        assertAge(args.maxAgeMs)
        const grant = await authorizeMembership(ctx, args)
        if (!grant) return null
        const guild = await ensureMembershipGuild(ctx, args.guildId),
            now = Date.now()
        let raw = await memberObservation(ctx, args.guildId, args.discordUserId)
        if (isFreshObservation(raw, guild.epoch, args.maxAgeMs, now))
            return {
                kind: "cached",
                data: await readMembershipRecord(
                    ctx,
                    args,
                    grant,
                    args.maxAgeMs
                ),
            }
        const globalLimit = await ctx.db
            .query("membershipRefreshLimits")
            .withIndex("name", (q) => q.eq("name", "discord"))
            .unique()
        const count =
            now - guild.refreshWindowAt < 60_000 ? guild.refreshCount : 0
        if (
            (raw?.refreshUntil ?? 0) > now ||
            (raw?.nextRefreshAt ?? 0) > now ||
            (globalLimit?.until ?? 0) > now ||
            count >= 30
        )
            return {
                kind: "cached",
                data: await readMembershipRecord(
                    ctx,
                    args,
                    grant,
                    args.maxAgeMs,
                    true
                ),
            }
        if (!raw) {
            const id = await ctx.db.insert("memberObservations", {
                guildId: args.guildId,
                discordUserId: args.discordUserId,
                state: "unknown",
                roleIds: [],
                observedAt: null,
                receivedAt: new Date(now).toISOString(),
                epoch: guild.epoch,
                revision: "0",
                unavailable: true,
                refreshFence: 0,
                refreshUntil: 0,
                nextRefreshAt: 0,
            })
            raw = (await ctx.db.get(id))!
        }
        const fence = raw.refreshFence + 1,
            startedAt = new Date(now).toISOString()
        await ctx.db.patch(raw._id, {
            refreshFence: fence,
            refreshUntil: now + 15_000,
            nextRefreshAt: now + 30_000,
        })
        await ctx.db.patch(guild._id, {
            refreshCount: count + 1,
            refreshWindowAt: count === 0 ? now : guild.refreshWindowAt,
        })
        return {
            kind: "refresh",
            token: {
                epoch: guild.epoch,
                revision: raw.revision,
                fence,
                policyVersion: grant.policy.version,
                startedAt,
            },
        }
    },
})

export const completeLookup = mutation({
    args: { ...subject, token, result: provider },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        assertAge(args.maxAgeMs)
        const grant = await authorizeMembership(ctx, args)
        if (!grant || grant.policy.version !== args.token.policyVersion)
            return null
        const guild = await membershipGuild(ctx, args.guildId),
            raw = await memberObservation(ctx, args.guildId, args.discordUserId)
        const applied = await applyObservation(args.result, args.token, {
            compareAndSet: async (result, expected) => {
                if (
                    !guild ||
                    !raw ||
                    guild.epoch !== expected.epoch ||
                    raw.revision !== expected.revision ||
                    raw.refreshFence !== expected.fence ||
                    raw.refreshUntil <= Date.now()
                )
                    return false
                if (result.roleIds.length > 250)
                    throw new Error("Invalid role observation.")
                const observedAt =
                    result.observedAt === null
                        ? NaN
                        : Date.parse(result.observedAt)
                if (
                    result.state !== "unknown" &&
                    (!Number.isFinite(observedAt) ||
                        observedAt > Date.now() ||
                        observedAt < Date.parse(expected.startedAt) - 10_000)
                )
                    result = { state: "unknown", roleIds: [], observedAt: null }
                if (result.state === "unknown") {
                    // Preserve the departure/last provider evidence. A failed transport
                    // changes availability, never the time at which Discord was observed.
                    await storeMemberObservation(
                        ctx,
                        args.guildId,
                        args.discordUserId,
                        {
                            state: raw.state,
                            roleIds: raw.roleIds,
                            observedAt: raw.observedAt,
                        }
                    )
                    const retry = Number.isFinite(result.retryAfterMs)
                        ? Math.max(
                              0,
                              Math.min(86_400_000, result.retryAfterMs!)
                          )
                        : 0
                    await ctx.db.patch(raw._id, {
                        unavailable: true,
                        nextRefreshAt: Date.now() + Math.max(30_000, retry),
                    })
                    if (retry) {
                        const previous = await ctx.db
                            .query("membershipRefreshLimits")
                            .withIndex("name", (q) => q.eq("name", "discord"))
                            .unique()
                        const until = Math.max(
                            previous?.until ?? 0,
                            Date.now() + retry
                        )
                        if (previous)
                            await ctx.db.patch(previous._id, { until })
                        else
                            await ctx.db.insert("membershipRefreshLimits", {
                                name: "discord",
                                until,
                            })
                    }
                } else {
                    const nextRefreshAt = raw.nextRefreshAt
                    await storeMemberObservation(
                        ctx,
                        args.guildId,
                        args.discordUserId,
                        result
                    )
                    await ctx.db.patch(raw._id, { nextRefreshAt })
                }
                return true
            },
        })
        return readMembershipRecord(
            ctx,
            args,
            grant,
            args.maxAgeMs,
            applied === "superseded" && guild?.epoch !== args.token.epoch
        )
    },
})

export const ensureGuild = mutation({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        return (await ensureMembershipGuild(ctx, args.guildId)).epoch
    },
})
export const invalidateGuild = mutation({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const guild = await ensureMembershipGuild(ctx, args.guildId),
            epoch = nextRevision(guild.epoch)
        await ctx.db.patch(guild._id, {
            epoch,
            epochRevision: await allocateIntegrationRevision(ctx, args.guildId),
        })
        return epoch
    },
})
export async function applyGatewayObservation(
    ctx: MutationCtx,
    args: {
        guildId: string
        discordUserId: string
        epoch: string
        state: "present" | "left"
        roleIds: string[]
        observedAt: string
    }
) {
    const guild = await ensureMembershipGuild(ctx, args.guildId),
        previous = await memberObservation(
            ctx,
            args.guildId,
            args.discordUserId
        )
    if (
        guild.epoch !== args.epoch ||
        (previous?.observedAt &&
            Date.parse(previous.observedAt) > Date.parse(args.observedAt))
    )
        return false
    if (
        args.roleIds.length > 250 ||
        !Number.isFinite(Date.parse(args.observedAt)) ||
        Date.parse(args.observedAt) > Date.now()
    )
        throw new Error("Invalid observation.")
    await storeMemberObservation(ctx, args.guildId, args.discordUserId, args)
    return true
}
export const applyGateway = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        discordUserId: v.string(),
        epoch: v.string(),
        state: v.union(v.literal("present"), v.literal("left")),
        roleIds: v.array(v.string()),
        observedAt: v.string(),
    },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        return applyGatewayObservation(ctx, args)
    },
})

export const beginReconciliation = mutation({
    args: { secret: v.string(), guildId: v.string(), epoch: v.string() },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const guild = await ensureMembershipGuild(ctx, args.guildId)
        if (guild.epoch !== args.epoch) return null
        const observedAt = new Date().toISOString()
        const id = await ctx.db.insert("membershipSyncRuns", {
            guildId: args.guildId,
            epoch: guild.epoch,
            startedRevision: guild.revision,
            observedAt,
            seenCount: 0,
            nextBatch: 0,
            status: "collecting",
            cursor: null,
            expiresAt: Date.now() + 10 * 60_000,
        })
        return { id: String(id), observedAt }
    },
})
async function reconciliation(ctx: MutationCtx, id: Id<"membershipSyncRuns">) {
    const run = await ctx.db.get(id)
    if (!run || run.expiresAt <= Date.now() || run.status === "superseded")
        throw new Error("Reconciliation expired.")
    const guild = await membershipGuild(ctx, run.guildId)
    if (!guild || guild.epoch !== run.epoch)
        throw new Error("Reconciliation superseded.")
    return run
}
export const applyReconciliationBatch = mutation({
    args: {
        secret: v.string(),
        runId: v.id("membershipSyncRuns"),
        batch: v.number(),
        expectedCount: v.number(),
        members: v.array(
            v.object({
                discordUserId: v.string(),
                roleIds: v.array(v.string()),
                isAdmin: v.optional(v.boolean()),
                hasDashboardAccess: v.optional(v.boolean()),
            })
        ),
    },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const run = await reconciliation(ctx, args.runId)
        if (args.batch < run.nextBatch) return { duplicate: true }
        if (
            run.status !== "collecting" ||
            args.batch !== run.nextBatch ||
            !Number.isSafeInteger(args.expectedCount) ||
            args.expectedCount < 0 ||
            args.expectedCount > 100_000 ||
            args.members.length > 100 ||
            (run.expectedCount !== undefined &&
                run.expectedCount !== args.expectedCount)
        )
            throw new Error("Invalid reconciliation batch.")
        let count = run.seenCount
        const appliedMembers: Array<{ userId: string; roleIds: string[] }> = []
        for (const member of args.members) {
            if (member.roleIds.length > 250)
                throw new Error("Invalid role observation.")
            const seen = await ctx.db
                .query("membershipSyncSubjects")
                .withIndex("runId_discordUserId", (q) =>
                    q
                        .eq("runId", args.runId)
                        .eq("discordUserId", member.discordUserId)
                )
                .unique()
            if (seen) throw new Error("Duplicate reconciliation subject.")
            await ctx.db.insert("membershipSyncSubjects", {
                runId: args.runId,
                discordUserId: member.discordUserId,
            })
            count++
            const current = await memberObservation(
                ctx,
                run.guildId,
                member.discordUserId
            )
            if (
                !current ||
                revisionOrder(current.revision) <=
                    revisionOrder(run.startedRevision)
            ) {
                await storeMemberObservation(
                    ctx,
                    run.guildId,
                    member.discordUserId,
                    {
                        state: "present",
                        roleIds: member.roleIds,
                        observedAt: run.observedAt,
                    },
                    args.runId
                )
                if (
                    member.isAdmin !== undefined &&
                    member.hasDashboardAccess !== undefined
                ) {
                    const access = {
                        userId: member.discordUserId,
                        roleIds: member.roleIds,
                        isAdmin: member.isAdmin,
                        hasDashboardAccess: member.hasDashboardAccess,
                    }
                    await upsertDiscordMemberCache(ctx, run.guildId, access)
                    appliedMembers.push(access)
                }
            }
        }
        if (count > args.expectedCount)
            throw new Error("Invalid reconciliation count.")
        await syncDashboardAdminOverrides(ctx, run.guildId, appliedMembers)
        await ctx.db.patch(run._id, {
            seenCount: count,
            nextBatch: run.nextBatch + 1,
            expectedCount: args.expectedCount,
        })
        return { duplicate: false }
    },
})
export const finishReconciliation = mutation({
    args: { secret: v.string(), runId: v.id("membershipSyncRuns") },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const run = await reconciliation(ctx, args.runId)
        if (
            run.expectedCount === undefined ||
            run.seenCount !== run.expectedCount
        )
            throw new Error("A complete member fetch is required.")
        if (run.status === "complete") return { isDone: true }
        if (run.status === "cache-sweeping") {
            // Existing installations can have access rows without observations.
            // Keyset pagination remains stable as departed access rows are deleted.
            const rows = await ctx.db
                .query("discordMemberAccess")
                .withIndex("guildId_userId", (q) =>
                    q.eq("guildId", run.guildId).gt("userId", run.cursor ?? "")
                )
                .take(100)
            for (const row of rows) {
                // Legacy bot writes lack a revision; protect writes at or after
                // the snapshot boundary, including equal millisecond timestamps.
                if (Date.parse(row.updatedAt) >= Date.parse(run.observedAt))
                    continue
                const current = await memberObservation(
                    ctx,
                    run.guildId,
                    row.userId
                )
                if (
                    current &&
                    revisionOrder(current.revision) >
                        revisionOrder(run.startedRevision)
                )
                    continue
                const seen = await ctx.db
                    .query("membershipSyncSubjects")
                    .withIndex("runId_discordUserId", (q) =>
                        q.eq("runId", run._id).eq("discordUserId", row.userId)
                    )
                    .unique()
                if (!seen)
                    await storeMemberObservation(
                        ctx,
                        run.guildId,
                        row.userId,
                        {
                            state: "left",
                            roleIds: [],
                            observedAt: run.observedAt,
                        },
                        run._id
                    )
            }
            const isDone = rows.length < 100
            await ctx.db.patch(run._id, {
                status: isDone ? "complete" : "cache-sweeping",
                cursor: isDone ? null : rows[rows.length - 1].userId,
            })
            return { isDone }
        }
        const page = await ctx.db
            .query("memberObservations")
            .withIndex("guildId", (q) => q.eq("guildId", run.guildId))
            .paginate({ cursor: run.cursor, numItems: 100 })
        for (const row of page.page) {
            if (
                row.seenRunId === run._id ||
                revisionOrder(row.revision) > revisionOrder(run.startedRevision)
            )
                continue
            const seen = await ctx.db
                .query("membershipSyncSubjects")
                .withIndex("runId_discordUserId", (q) =>
                    q
                        .eq("runId", run._id)
                        .eq("discordUserId", row.discordUserId)
                )
                .unique()
            if (!seen)
                await storeMemberObservation(
                    ctx,
                    run.guildId,
                    row.discordUserId,
                    { state: "left", roleIds: [], observedAt: run.observedAt },
                    run._id
                )
        }
        await ctx.db.patch(run._id, {
            status: page.isDone ? "cache-sweeping" : "sweeping",
            cursor: page.isDone ? null : page.continueCursor,
        })
        return { isDone: false }
    },
})

export const listPolicies = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const keys = await ctx.db
            .query("apiKeys")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
        const policies = await ctx.db
            .query("membershipIntegrationPolicies")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
        return keys
            .filter(
                (key) =>
                    !key.revokedAt &&
                    isApiKeyReadAccess(key.readAccess) &&
                    key.readAccess.resources.includes("membership-summaries")
            )
            .map((key) => ({
                apiKeyId: String(key._id),
                name: key.name,
                gameIds: key.readAccess!.gameIds,
                policy: policies.find((policy) => policy.apiKeyId === key._id)
                    ? {
                          enabled: policies.find(
                              (policy) => policy.apiKeyId === key._id
                          )!.enabled,
                          games: policies.find(
                              (policy) => policy.apiKeyId === key._id
                          )!.games,
                          version: policies.find(
                              (policy) => policy.apiKeyId === key._id
                          )!.version,
                      }
                    : null,
            }))
    },
})
export const configurePolicy = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        apiKeyId: v.id("apiKeys"),
        enabled: v.boolean(),
        games: v.array(
            v.object({ gameId: v.string(), roleIds: v.array(v.string()) })
        ),
    },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const key = await ctx.db.get(args.apiKeyId)
        if (
            !key ||
            key.revokedAt ||
            key.guildId !== args.guildId ||
            !isApiKeyReadAccess(key.readAccess) ||
            args.games.length < 1 ||
            args.games.length > 3 ||
            new Set(args.games.map((game) => game.gameId)).size !==
                args.games.length ||
            args.games.some(
                (game) =>
                    !isGameId(game.gameId) ||
                    !allowsApiKeyRead(
                        key.readAccess,
                        "membership-summaries",
                        game.gameId as never
                    ) ||
                    game.roleIds.length > 100 ||
                    new Set(game.roleIds).size !== game.roleIds.length ||
                    game.roleIds.some((id) => !/^\d{17,20}$/.test(id))
            )
        )
            throw new Error("Invalid membership policy.")
        const previous = await ctx.db
            .query("membershipIntegrationPolicies")
            .withIndex("apiKeyId", (q) => q.eq("apiKeyId", key._id))
            .unique()
        const value = {
            apiKeyId: key._id,
            guildId: args.guildId,
            enabled: args.enabled,
            games: args.games,
            version: await allocateIntegrationRevision(ctx, args.guildId),
            updatedAt: new Date().toISOString(),
        }
        if (previous) await ctx.db.patch(previous._id, value)
        else await ctx.db.insert("membershipIntegrationPolicies", value)
        return { ok: true }
    },
})
export const pruneReconciliations = internalMutation({
    args: {},
    handler: async (ctx) => {
        const runs = await ctx.db
            .query("membershipSyncRuns")
            .withIndex("expiresAt", (q) => q.lte("expiresAt", Date.now()))
            .take(5)
        for (const run of runs) {
            const subjects = await ctx.db
                .query("membershipSyncSubjects")
                .withIndex("runId", (q) => q.eq("runId", run._id))
                .take(200)
            for (const row of subjects) await ctx.db.delete(row._id)
            if (subjects.length < 200) await ctx.db.delete(run._id)
        }
    },
})
