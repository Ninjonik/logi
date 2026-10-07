import {
    projectMember,
    projectRoster,
    projectPlayerFacts,
    readPeopleProjection,
} from "./peopleProjection"
import {
    PEOPLE_RESOURCES,
    type PeopleResource,
    type PeopleSummary,
} from "../src/domain/api/people-summaries"
import {
    peopleGeneration,
    rebuildPeopleResultLinks,
    invalidatePeopleGeneration,
} from "./peopleChanges"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { query, internalMutation, type QueryCtx } from "./_generated/server"
import { isGameId, resolveGameScope } from "../src/domain/games/game"
import { nextRevision } from "../src/domain/integrations/change"
import { makeFunctionReference } from "convex/server"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"

const DAY_MS = 24 * 60 * 60 * 1000
const RECONCILIATION_PAGE_SIZE = 25
const RECONCILIATION_LEASE_MS = 300000

/**
 * What a reconciliation run walks: `null` for every event, otherwise the
 * `updatedAt` watermark the incremental walk starts from. A resumed run (a
 * scheduled continuation, or the cron after a lease expired mid-run) keeps
 * its mode so that its cursor stays valid; a legacy run without the flag
 * was a full walk. A fresh run walks everything until a complete run has
 * set the watermark and once a day after the last complete full walk.
 */
function reconciliationWindow(
    state: Doc<"peopleIntegrationState">,
    resumed: boolean,
    now: number
): string | null {
    if (resumed)
        return state.reconciliationFull === false
            ? (state.reconciliationSince ?? null)
            : null
    const since = state.reconciliationSince
    const lastFullWalk = state.reconciliationFullWalkAt
    if (!since || !lastFullWalk || !(now - Date.parse(lastFullWalk) < DAY_MS))
        return null
    return since
}

async function authorize(
    ctx: QueryCtx,
    args: { secret: string; keyHash: string; resource: string; gameId: string }
) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        args.secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
    const key = await ctx.db
        .query("apiKeys")
        .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
        .unique()
    if (
        !key ||
        key.revokedAt ||
        !isGameId(args.gameId) ||
        !(PEOPLE_RESOURCES as readonly string[]).includes(args.resource) ||
        !isApiKeyReadAccess(key.readAccess) ||
        !allowsApiKeyRead(key.readAccess, args.resource, args.gameId)
    )
        return null
    return key
}
const scope = {
    secret: v.string(),
    keyHash: v.string(),
    gameId: v.string(),
    resource: v.string(),
}
export const get = query({
    args: { ...scope, id: v.string() },
    handler: async (ctx, args) => {
        const key = await authorize(ctx, args)
        return key
            ? readPeopleProjection(
                  ctx,
                  { guildId: key.guildId, gameId: args.gameId },
                  args.resource as PeopleResource,
                  args.id,
                  Date.now()
              )
            : null
    },
})
export const list = query({
    args: {
        ...scope,
        cursor: v.union(v.string(), v.null()),
        limit: v.number(),
        peopleScopeVersion: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const key = await authorize(ctx, args)
        if (!key) return null
        if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 10)
            throw new Error("Invalid limit.")
        const generation = await peopleGeneration(ctx)
        if (args.cursor !== null && args.peopleScopeVersion !== generation)
            return { resetRequired: true as const }
        const scope = { guildId: key.guildId, gameId: args.gameId }
        const limit = args.resource === "member-summaries" ? args.limit : 1
        const pageOptions = { cursor: args.cursor, numItems: limit }
        const items: PeopleSummary[] = []
        let nextCursor: string | null
        if (args.resource === "member-summaries") {
            const page = await ctx.db
                .query("userAssignments")
                .withIndex("serverId", (q) => q.eq("serverId", key.guildId))
                .paginate(pageOptions)
            for (const row of page.page)
                if (resolveGameScope(row.gameId) === args.gameId)
                    items.push(await projectMember(ctx, row))
            nextCursor = page.isDone ? null : page.continueCursor
        } else if (args.resource === "roster-summaries") {
            // Scope through the parent event, including legacy rosters without a cached guildId.
            const page = await ctx.db
                .query("events")
                .withIndex("guildId", (q) => q.eq("guildId", key.guildId))
                .paginate(pageOptions)
            for (const event of page.page) {
                if (resolveGameScope(event.gameId) !== args.gameId) continue
                const row = await ctx.db
                    .query("rosters")
                    .withIndex("eventId", (q) => q.eq("eventId", event._id))
                    .unique()
                const data = row ? await projectRoster(ctx, row, scope) : null
                if (data) items.push(data)
            }
            nextCursor = page.isDone ? null : page.continueCursor
        } else if (
            args.gameId === "hell_let_loose" ||
            args.gameId === "wardogs"
        ) {
            const gameId = args.gameId
            const page = await ctx.db
                .query("gameSessions")
                .withIndex("guildId_gameId", (q) =>
                    q.eq("guildId", key.guildId).eq("gameId", gameId)
                )
                .paginate(pageOptions)
            for (const row of page.page) {
                const data = await projectPlayerFacts(ctx, row, Date.now())
                if (data) items.push(data)
            }
            nextCursor = page.isDone ? null : page.continueCursor
        } else nextCursor = null // No collected player metrics for Vietnam yet.
        return {
            items,
            nextCursor,
            limit,
            peopleScopeVersion: generation,
            resetRequired: false as const,
        }
    },
})

/**
 * Rolling bounded reconciliation: the safety net for
 * `rebuildPeopleResultLinks`, which `withPeopleChanges` already runs inline
 * whenever an event's reviewed result changes. A run walks the events whose
 * `updatedAt` is at or after the start of the previous complete run
 * (`reconciliationSince`, through the `updatedAt` index); once a day it walks
 * every event instead, which also backfills pre-feature rows and legacy rows
 * without `updatedAt`. A run pages 25 events a second under a lease and
 * resumes from its cursor in the same mode after an interruption; the cron
 * (every 15 minutes) starts a run only when no lease is held.
 */
export const reconcileResultLinks = internalMutation({
    args: { run: v.optional(v.string()) },
    handler: async (ctx, args) => {
        let state = await ctx.db
            .query("peopleIntegrationState")
            .withIndex("key", (q) => q.eq("key", "global"))
            .unique()
        if (!state) {
            const id = await ctx.db.insert("peopleIntegrationState", {
                key: "global",
                generation: "0",
            })
            state = await ctx.db.get(id)
        }
        if (!state) throw new Error("People reconciliation state unavailable.")
        const now = Date.now()
        if (
            args.run
                ? args.run !== state.reconciliationRun ||
                  (state.reconciliationLeaseUntil ?? 0) === 0
                : (state.reconciliationLeaseUntil ?? 0) > now
        )
            return { processed: 0, complete: false }
        const run = args.run ?? nextRevision(state.reconciliationRun ?? "0")
        const resumed =
            args.run !== undefined || state.reconciliationCursor != null
        const startedAt =
            (resumed && state.reconciliationStartedAt) ||
            new Date(now).toISOString()
        const since = reconciliationWindow(state, resumed, now)
        const events = ctx.db.query("events")
        const page = await (
            since === null
                ? events
                : events.withIndex("updatedAt", (q) =>
                      q.gte("updatedAt", since)
                  )
        ).paginate({
            cursor: state.reconciliationCursor ?? null,
            numItems: RECONCILIATION_PAGE_SIZE,
        })
        let changed = false
        for (const event of page.page)
            changed =
                (await rebuildPeopleResultLinks(ctx, event._id)) || changed
        if (changed) await invalidatePeopleGeneration(ctx)
        await ctx.db.patch(state._id, {
            reconciliationRun: run,
            reconciliationCursor: page.isDone ? null : page.continueCursor,
            reconciliationLeaseUntil: page.isDone
                ? 0
                : now + RECONCILIATION_LEASE_MS,
            reconciliationStartedAt: startedAt,
            reconciliationFull: since === null,
            // The next incremental run covers everything updated during
            // this one: a row updated after the cursor passed it moves ahead
            // of the cursor, and `since` starts at this run's start.
            ...(page.isDone ? { reconciliationSince: startedAt } : {}),
            ...(page.isDone && since === null
                ? { reconciliationFullWalkAt: startedAt }
                : {}),
        })
        if (!page.isDone)
            await ctx.scheduler.runAfter(
                1000,
                makeFunctionReference<"mutation">(
                    "peopleSummaries:reconcileResultLinks"
                ),
                { run }
            )
        return { processed: page.page.length, complete: page.isDone }
    },
})
