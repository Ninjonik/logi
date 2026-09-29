import {
    projectMembership,
    type ProviderObservation,
} from "../src/domain/membership/observation"
import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import {
    appendIntegrationChange,
    integrationRecord,
} from "./integrationChangeLog"
import { nextRevision, revisionOrder } from "../src/domain/integrations/change"
import { isGameId, GAME_IDS, type GameId } from "../src/domain/games/game"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc } from "./_generated/dataModel"

export function assertMembershipSecret(secret: string) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
}
export const membershipGuild = (ctx: Pick<QueryCtx, "db">, guildId: string) =>
    ctx.db
        .query("membershipGuilds")
        .withIndex("guildId", (q) => q.eq("guildId", guildId))
        .unique()
export const memberObservation = (
    ctx: Pick<QueryCtx, "db">,
    guildId: string,
    discordUserId: string
) =>
    ctx.db
        .query("memberObservations")
        .withIndex("guildId_discordUserId", (q) =>
            q.eq("guildId", guildId).eq("discordUserId", discordUserId)
        )
        .unique()
export async function ensureMembershipGuild(ctx: MutationCtx, guildId: string) {
    const existing = await membershipGuild(ctx, guildId)
    if (existing) return existing
    const id = await ctx.db.insert("membershipGuilds", {
        guildId,
        epoch: "1",
        revision: "0",
        epochRevision: "0",
        refreshWindowAt: 0,
        refreshCount: 0,
    })
    return (await ctx.db.get(id))!
}
export async function membershipPolicy(
    ctx: Pick<QueryCtx, "db">,
    key: Doc<"apiKeys">,
    gameId: string
) {
    if (
        key.revokedAt ||
        !isGameId(gameId) ||
        !isApiKeyReadAccess(key.readAccess) ||
        !allowsApiKeyRead(key.readAccess, "membership-summaries", gameId)
    )
        return null
    const policy = await ctx.db
        .query("membershipIntegrationPolicies")
        .withIndex("apiKeyId", (q) => q.eq("apiKeyId", key._id))
        .unique()
    const game = policy?.games.find((game) => game.gameId === gameId)
    if (!policy?.enabled || policy.guildId !== key.guildId || !game) return null
    return { policy, roleIds: game.roleIds }
}
export async function authorizeMembership(
    ctx: Pick<QueryCtx, "db">,
    args: { keyHash: string; guildId: string; gameId: string }
) {
    const key = await ctx.db
        .query("apiKeys")
        .withIndex("keyHash", (q) => q.eq("keyHash", args.keyHash))
        .unique()
    if (!key || key.guildId !== args.guildId) return null
    const grant = await membershipPolicy(ctx, key, args.gameId)
    return grant ? { key, ...grant } : null
}

export async function readMembershipRecord(
    ctx: Pick<QueryCtx, "db">,
    args: { guildId: string; gameId: string; discordUserId: string },
    grant: NonNullable<Awaited<ReturnType<typeof authorizeMembership>>>,
    maxAgeMs: number,
    forceUnavailable = false
) {
    const guild = await membershipGuild(ctx, args.guildId),
        raw = await memberObservation(ctx, args.guildId, args.discordUserId)
    const assignments = await ctx.db
        .query("userAssignments")
        .withIndex("serverId_userId", (q) =>
            q.eq("serverId", args.guildId).eq("userId", args.discordUserId)
        )
        .collect()
    const assignment = assignments.find(
        (row) => (row.gameId ?? "hell_let_loose") === args.gameId
    )
    const stamp = await integrationRecord(ctx, {
        guildId: args.guildId,
        gameId: args.gameId,
        resource: "membership-summaries",
        id: args.discordUserId,
    })
    const revision = [
        stamp?.revision ?? "0",
        grant.policy.version,
        guild?.epochRevision ?? "0",
    ]
        .sort((a, b) => revisionOrder(a).localeCompare(revisionOrder(b)))
        .at(-1)!
    return projectMembership(
        {
            guildId: args.guildId,
            discordUserId: args.discordUserId,
            gameId: args.gameId as GameId,
        },
        raw && forceUnavailable ? { ...raw, unavailable: true } : raw,
        {
            epoch: guild?.epoch ?? "0",
            revision,
            allowedRoleIds: grant.roleIds,
            assignment: assignment
                ? { type: assignment.type, status: assignment.status }
                : null,
            maxAgeMs,
            now: Date.now(),
        }
    )
}

export async function storeMemberObservation(
    ctx: MutationCtx,
    guildId: string,
    discordUserId: string,
    value: ProviderObservation,
    seenRunId?: Doc<"membershipSyncRuns">["_id"]
) {
    const guild = await ensureMembershipGuild(ctx, guildId),
        previous = await memberObservation(ctx, guildId, discordUserId)
    const revision = nextRevision(guild.revision)
    const patch = {
        state: value.state,
        roleIds:
            value.state === "present" ? [...new Set(value.roleIds)].sort() : [],
        observedAt: value.observedAt,
        receivedAt: new Date().toISOString(),
        epoch: guild.epoch,
        revision,
        unavailable: value.state === "unknown",
        refreshFence: previous?.refreshFence ?? 0,
        refreshUntil: 0,
        nextRefreshAt: 0,
        seenRunId,
        departureRevision:
            value.state === "left" ? revision : previous?.departureRevision,
    }
    if (previous) await ctx.db.patch(previous._id, patch)
    else
        await ctx.db.insert("memberObservations", {
            guildId,
            discordUserId,
            ...patch,
        })
    if (value.state === "left") {
        const access = await ctx.db
            .query("discordMemberAccess")
            .withIndex("guildId_userId", (q) =>
                q.eq("guildId", guildId).eq("userId", discordUserId)
            )
            .unique()
        if (access) await ctx.db.delete(access._id)
    }
    await ctx.db.patch(guild._id, { revision })
    // Every supported game's projection can observe presence independently of its assignment.
    for (const gameId of GAME_IDS)
        await appendIntegrationChange(ctx, {
            guildId,
            gameId,
            resource: "membership-summaries",
            id: discordUserId,
            operation: "upsert",
        })
}
