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
import { v } from "convex/values"

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

/** Rolling bounded reconciliation also backfills pre-feature reviewed result relationships. */
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
        if (
            args.run
                ? args.run !== state.reconciliationRun ||
                  (state.reconciliationLeaseUntil ?? 0) === 0
                : (state.reconciliationLeaseUntil ?? 0) > Date.now()
        )
            return { processed: 0, complete: false }
        const run = args.run ?? nextRevision(state.reconciliationRun ?? "0")
        const page = await ctx.db.query("events").paginate({
            cursor: state.reconciliationCursor ?? null,
            numItems: 25,
        })
        let changed = false
        for (const event of page.page)
            changed =
                (await rebuildPeopleResultLinks(ctx, event._id)) || changed
        if (changed) await invalidatePeopleGeneration(ctx)
        await ctx.db.patch(state._id, {
            reconciliationRun: run,
            reconciliationCursor: page.isDone ? null : page.continueCursor,
            reconciliationLeaseUntil: page.isDone ? 0 : Date.now() + 300000,
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
