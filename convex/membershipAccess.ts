import {
    allowsApiKeyRead,
    isApiKeyReadAccess,
} from "../src/domain/api/key-access"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import { isGameId } from "../src/domain/games/game"
import type { Doc } from "./_generated/dataModel"

/**
 * Membership access helpers that validate nothing: the internal secret,
 * the guild and observation rows and the API key policy. Apart from
 * `membership_shared.ts` so the role operations and other callers do not
 * bundle the observation schema.
 */
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
