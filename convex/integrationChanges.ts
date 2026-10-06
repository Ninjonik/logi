import {
    CHANGE_RETENTION_MS,
    revisionOrder,
    SYNC_RESOURCES,
    type SyncResource,
} from "../src/domain/integrations/change"
import {
    query,
    internalMutation,
    type MutationCtx,
    type QueryCtx,
} from "./_generated/server"
import {
    authorizeMembership,
    membershipGuild,
    readMembershipRecord,
} from "./membership_shared"
import {
    PEOPLE_RESOURCES,
    type PeopleResource,
} from "../src/domain/api/people-summaries"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import { projectIntegrationRow } from "./integrationProjection"
import { integrationRecord } from "./integrationChangeLog"
import { readPeopleProjection } from "./peopleProjection"
import { readLeagueFixture } from "./leagueFixtureReads"
import { readHistoryRecord } from "./gameHistoryStore"
import { makeFunctionReference } from "convex/server"
import { isGameId } from "../src/domain/games/game"
import { peopleGeneration } from "./peopleChanges"
import { readTeamDto } from "./teamReads"
import { v } from "convex/values"

async function authorize(
    ctx: QueryCtx,
    args: { secret: string; keyHash: string; gameId: string },
    resources: string[]
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
        !isApiKeyReadAccess(key.readAccess) ||
        resources.length === 0 ||
        resources.length > SYNC_RESOURCES.length ||
        !resources.every(
            (resource) =>
                (SYNC_RESOURCES as readonly string[]).includes(resource) &&
                allowsApiKeyRead(key.readAccess, resource, args.gameId as never)
        )
    )
        return null
    return key
}
const subject = { secret: v.string(), keyHash: v.string(), gameId: v.string() }
export const readChanges = query({
    args: {
        ...subject,
        resources: v.array(v.string()),
        limit: v.number(),
        startNow: v.optional(v.boolean()),
        afterRevision: v.optional(v.string()),
        issuedAt: v.optional(v.number()),
        discordUserId: v.optional(v.string()),
        membershipScopeVersion: v.optional(v.string()),
        peopleScopeVersion: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const key = await authorize(ctx, args, args.resources)
        if (!key) return null
        let peopleScopeVersion: string | undefined
        if (
            args.resources.some((resource) =>
                (PEOPLE_RESOURCES as readonly string[]).includes(resource)
            )
        ) {
            peopleScopeVersion = await peopleGeneration(ctx)
            if (
                !args.startNow &&
                args.peopleScopeVersion !== peopleScopeVersion
            )
                return { resetRequired: true }
        }
        let membershipScopeVersion: string | undefined
        if (args.resources.includes("membership-summaries")) {
            if (!args.discordUserId) return null
            const grant = await authorizeMembership(ctx, {
                ...args,
                guildId: key.guildId,
            })
            if (!grant) return null
            const guild = await membershipGuild(ctx, key.guildId)
            membershipScopeVersion = `${grant.policy.version}:${guild?.epoch ?? "0"}`
            if (
                !args.startNow &&
                args.membershipScopeVersion !== membershipScopeVersion
            )
                return { resetRequired: true }
        }
        if (!Number.isInteger(args.limit) || args.limit < 1 || args.limit > 100)
            throw new Error("Invalid limit.")
        const head = await ctx.db
            .query("integrationHeads")
            .withIndex("guildId", (q) => q.eq("guildId", key.guildId))
            .unique()
        const revision = head?.revision ?? "0"
        if (args.startNow)
            return {
                items: [],
                revision,
                hasMore: false,
                resetRequired: false,
                ...(membershipScopeVersion ? { membershipScopeVersion } : {}),
                ...(peopleScopeVersion !== undefined
                    ? { peopleScopeVersion }
                    : {}),
            }
        const after = args.afterRevision
        if (
            after === undefined ||
            args.issuedAt === undefined ||
            args.issuedAt > Date.now() ||
            args.issuedAt <= Date.now() - CHANGE_RETENTION_MS ||
            revisionOrder(after) < revisionOrder(head?.floor ?? "0") ||
            revisionOrder(after) > revisionOrder(revision)
        )
            return { resetRequired: true }
        // Limit scanned rows, not returned rows: even an empty filtered page may have a continuation.
        const rows = await ctx.db
            .query("integrationChanges")
            .withIndex("guildId_revisionOrder", (q) =>
                q
                    .eq("guildId", key.guildId)
                    .gt("revisionOrder", revisionOrder(after))
            )
            .take(args.limit)
        if (rows.some((row) => row.expiresAt <= Date.now()))
            return { resetRequired: true }
        return {
            items: rows
                .filter(
                    (row) =>
                        row.gameId === args.gameId &&
                        args.resources.includes(row.resource) &&
                        (row.resource !== "membership-summaries" ||
                            row.id === args.discordUserId)
                )
                .map(
                    ({
                        guildId,
                        gameId,
                        resource,
                        id,
                        operation,
                        revision,
                    }) => ({
                        guildId,
                        gameId,
                        resource,
                        id,
                        operation,
                        revision,
                    })
                ),
            revision: rows.at(-1)?.revision ?? after,
            ...(membershipScopeVersion ? { membershipScopeVersion } : {}),
            ...(peopleScopeVersion !== undefined ? { peopleScopeVersion } : {}),
            hasMore: rows.length === args.limit,
            resetRequired: false,
        }
    },
})
export const readSyncRecord = query({
    args: { ...subject, resource: v.string(), id: v.string() },
    handler: async (ctx, args) => {
        const key = await authorize(ctx, args, [args.resource])
        if (!key) return null
        const resource = args.resource as SyncResource
        if (resource === "membership-summaries") {
            const grant = await authorizeMembership(ctx, {
                ...args,
                guildId: key.guildId,
            })
            if (!grant) return null
            const data = await readMembershipRecord(
                ctx,
                {
                    guildId: key.guildId,
                    gameId: args.gameId,
                    discordUserId: args.id,
                },
                grant,
                60_000
            )
            return {
                guildId: key.guildId,
                gameId: args.gameId,
                resource,
                id: args.id,
                revision: data.revision,
                operation: "upsert" as const,
                data,
            }
        }
        const identity = {
            guildId: key.guildId,
            gameId: args.gameId,
            resource,
            id: args.id,
        }
        const stamp = await integrationRecord(ctx, identity)
        if (stamp?.operation === "remove")
            return stamp.expiresAt! > Date.now()
                ? {
                      ...identity,
                      revision: stamp.revision,
                      operation: "remove" as const,
                      data: null,
                  }
                : null
        if (resource === "teams") {
            const data = await readTeamDto(ctx, args.gameId, args.id)
            return data
                ? {
                      ...identity,
                      revision: stamp?.revision ?? "0",
                      operation: "upsert" as const,
                      data,
                  }
                : null
        }
        if ((PEOPLE_RESOURCES as readonly string[]).includes(resource)) {
            const data = await readPeopleProjection(
                ctx,
                identity,
                resource as PeopleResource,
                args.id,
                Date.now()
            )
            return data
                ? {
                      ...identity,
                      revision: stamp?.revision ?? "0",
                      operation: "upsert" as const,
                      data,
                  }
                : null
        }
        if (resource === "server-game-history") {
            if (args.gameId !== "wardogs") return null
            const data = await readHistoryRecord(ctx, key.guildId, args.id)
            return data
                ? {
                      ...identity,
                      revision: stamp?.revision ?? "0",
                      operation: "upsert" as const,
                      data,
                  }
                : null
        }
        if (resource === "league-fixtures") {
            if (args.gameId !== "wardogs") return null
            const data = await readLeagueFixture(ctx, key.guildId, args.id)
            return data
                ? {
                      ...identity,
                      revision: stamp?.revision ?? "0",
                      operation: "upsert" as const,
                      data,
                  }
                : null
        }
        const table =
            resource === "server-snapshots" || resource === "integration-health"
                ? "gameDataConnections"
                : "events"
        const id = ctx.db.normalizeId(table, args.id)
        const row = id ? await ctx.db.get(id) : null
        if (!row || row.guildId !== key.guildId) return null
        const projection = projectIntegrationRow(table, row, Date.now()).find(
            (item) =>
                item.resource === resource && item.data.gameId === args.gameId
        )
        return projection
            ? {
                  ...identity,
                  revision: stamp?.revision ?? "0",
                  operation: "upsert" as const,
                  data: projection.data,
              }
            : null
    },
})

/** Raises each guild's retention floor to the newest of the given revisions, one head write per guild. */
async function raiseFloors(
    ctx: MutationCtx,
    rows: Array<{ guildId: string; revision: string }>
) {
    const newest = new Map<string, string>()
    for (const row of rows) {
        const current = newest.get(row.guildId)
        if (
            current === undefined ||
            revisionOrder(row.revision) > revisionOrder(current)
        )
            newest.set(row.guildId, row.revision)
    }
    for (const [guildId, revision] of newest) {
        const head = await ctx.db
            .query("integrationHeads")
            .withIndex("guildId", (q) => q.eq("guildId", guildId))
            .unique()
        if (head && revisionOrder(revision) > revisionOrder(head.floor))
            await ctx.db.patch(head._id, { floor: revision })
    }
}
const PRUNE_BATCH = 250
export const prune = internalMutation({
    args: {},
    handler: async (ctx) => {
        const expired = await ctx.db
            .query("integrationChanges")
            .withIndex("expiresAt", (q) => q.lte("expiresAt", Date.now()))
            .take(PRUNE_BATCH)
        // Every append patches the guild head too; one head write per guild
        // and batch keeps this cron from conflicting with the writers.
        await raiseFloors(ctx, expired)
        for (const row of expired) await ctx.db.delete(row._id)
        const tombstones = await ctx.db
            .query("integrationRecords")
            .withIndex("expiresAt", (q) =>
                q.gt("expiresAt", 0).lte("expiresAt", Date.now())
            )
            .take(PRUNE_BATCH)
        for (const row of tombstones) await ctx.db.delete(row._id)
        if (expired.length === PRUNE_BATCH || tombstones.length === PRUNE_BATCH)
            await ctx.scheduler.runAfter(
                0,
                makeFunctionReference<"mutation">("integrationChanges:prune"),
                {}
            )
    },
})
const RESET_BATCH = 500
/**
 * Operator recovery for a flooded change log: raises every guild's floor to
 * its head, so each website consumer bootstraps again instead of missing
 * changes, then empties the log in batches of {@link RESET_BATCH} rows,
 * rescheduling itself until it is empty. Run with
 * `npx convex run integrationChanges:resetFeed`.
 */
export const resetFeed = internalMutation({
    args: { floorsRaised: v.optional(v.boolean()) },
    handler: async (ctx, args) => {
        if (!args.floorsRaised) {
            const heads = await ctx.db.query("integrationHeads").collect()
            for (const head of heads)
                if (revisionOrder(head.revision) > revisionOrder(head.floor))
                    await ctx.db.patch(head._id, { floor: head.revision })
        }
        const rows = await ctx.db
            .query("integrationChanges")
            .withIndex("expiresAt", (q) => q.gte("expiresAt", 0))
            .take(RESET_BATCH)
        for (const row of rows) await ctx.db.delete(row._id)
        if (rows.length === RESET_BATCH)
            await ctx.scheduler.runAfter(
                0,
                makeFunctionReference<"mutation">(
                    "integrationChanges:resetFeed"
                ),
                { floorsRaised: true }
            )
        return { removed: rows.length, done: rows.length < RESET_BATCH }
    },
})
