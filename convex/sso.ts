import { getGuildById, getUserByDiscordId } from "./identity"
import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { v } from "convex/values"

const INTERNAL_AUTH_SECRET =
    process.env.INTERNAL_AUTH_SECRET ?? "dev-internal-auth-secret"

function assertSecret(secret: string) {
    if (secret !== INTERNAL_AUTH_SECRET) throw new Error("Unauthorized.")
}

async function assertGuildAdmin(
    ctx: MutationCtx,
    guildId: string,
    userId: string
) {
    const guild = await getGuildById(ctx, guildId)
    if (
        !guild ||
        (!guild.adminIds.includes(userId) &&
            !(guild.dashboardAdminIds ?? []).includes(userId))
    ) {
        throw new Error("Forbidden.")
    }
    return guild
}

export const listForGuild = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const apps = await ctx.db
            .query("ssoApplications")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
        return apps.map(
            ({ clientSecretHash: _clientSecretHash, ...app }) => app
        )
    },
})

export const create = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        clientId: v.string(),
        clientSecretHash: v.string(),
        name: v.string(),
        websiteUrl: v.string(),
        redirectUris: v.array(v.string()),
        backchannelLogoutUri: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        await assertGuildAdmin(ctx, args.guildId, args.userId)
        const now = new Date().toISOString()
        return await ctx.db.insert("ssoApplications", {
            guildId: args.guildId,
            clientId: args.clientId,
            clientSecretHash: args.clientSecretHash,
            name: args.name,
            websiteUrl: args.websiteUrl,
            redirectUris: args.redirectUris,
            backchannelLogoutUri: args.backchannelLogoutUri,
            createdAt: now,
            updatedAt: now,
        })
    },
})

export const remove = mutation({
    args: {
        secret: v.string(),
        guildId: v.string(),
        userId: v.string(),
        clientId: v.string(),
    },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        await assertGuildAdmin(ctx, args.guildId, args.userId)
        const application = await ctx.db
            .query("ssoApplications")
            .withIndex("clientId", (q) => q.eq("clientId", args.clientId))
            .unique()
        if (!application || application.guildId !== args.guildId)
            throw new Error("Not found.")
        await ctx.db.delete(application._id)
    },
})

export const getPublicClient = query({
    args: { clientId: v.string() },
    handler: async (ctx, args) => {
        const app = await ctx.db
            .query("ssoApplications")
            .withIndex("clientId", (q) => q.eq("clientId", args.clientId))
            .unique()
        if (!app) return null
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", app.guildId))
            .unique()
        return {
            clientId: app.clientId,
            guildId: app.guildId,
            name: app.name,
            redirectUris: app.redirectUris,
            defaultLanguage: config?.defaultLanguage ?? "en",
        }
    },
})

export const createCode = mutation({
    args: {
        clientId: v.string(),
        redirectUri: v.string(),
        userId: v.string(),
        codeHash: v.string(),
        codeChallenge: v.string(),
        codeChallengeMethod: v.string(),
        expiresAt: v.number(),
    },
    handler: async (ctx, args) => {
        const app = await ctx.db
            .query("ssoApplications")
            .withIndex("clientId", (q) => q.eq("clientId", args.clientId))
            .unique()
        if (!app || !app.redirectUris.includes(args.redirectUri))
            throw new Error("Invalid client.")
        await ctx.db.insert("ssoAuthorizationCodes", args)
    },
})

export const redeemCode = mutation({
    args: {
        clientId: v.string(),
        clientSecretHash: v.string(),
        codeHash: v.string(),
        redirectUri: v.string(),
        now: v.number(),
    },
    handler: async (ctx, args) => {
        const app = await ctx.db
            .query("ssoApplications")
            .withIndex("clientId", (q) => q.eq("clientId", args.clientId))
            .unique()
        if (!app || app.clientSecretHash !== args.clientSecretHash) return null
        const code = await ctx.db
            .query("ssoAuthorizationCodes")
            .withIndex("codeHash", (q) => q.eq("codeHash", args.codeHash))
            .unique()
        if (
            !code ||
            code.clientId !== args.clientId ||
            code.redirectUri !== args.redirectUri ||
            code.usedAt ||
            code.expiresAt < args.now
        )
            return null
        await ctx.db.patch(code._id, { usedAt: args.now })
        return {
            userId: code.userId,
            codeChallenge: code.codeChallenge,
            codeChallengeMethod: code.codeChallengeMethod,
            guildId: app.guildId,
        }
    },
})

export const createAccessToken = mutation({
    args: {
        tokenHash: v.string(),
        clientId: v.string(),
        userId: v.string(),
        expiresAt: v.number(),
    },
    handler: async (ctx, args) => {
        await ctx.db.insert("ssoAccessTokens", args)
    },
})

export const getProfile = query({
    args: { tokenHash: v.string(), now: v.number() },
    handler: async (ctx, args) => {
        const token = await ctx.db
            .query("ssoAccessTokens")
            .withIndex("tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
            .unique()
        if (!token || token.revokedAt || token.expiresAt < args.now) return null
        const [app, user] = await Promise.all([
            ctx.db
                .query("ssoApplications")
                .withIndex("clientId", (q) => q.eq("clientId", token.clientId))
                .unique(),
            getUserByDiscordId(ctx, token.userId),
        ])
        if (!app || !user) return null
        const guild = await getGuildById(ctx, app.guildId)
        const isMember = Boolean(
            guild &&
            (guild.memberIds.includes(token.userId) ||
                guild.adminIds.includes(token.userId) ||
                guild.mercenaryIds.includes(token.userId))
        )
        return {
            user: {
                ...user,
                id: user.id ?? user.discordId ?? String(user._id),
                discordId: user.discordId ?? user.id ?? "",
            },
            membership: isMember ? ("member" as const) : ("guest" as const),
            guildId: app.guildId,
            clientId: token.clientId,
        }
    },
})

export const revokeForUser = mutation({
    args: { secret: v.string(), userId: v.string(), now: v.number() },
    handler: async (ctx, args) => {
        assertSecret(args.secret)
        const tokens = await ctx.db.query("ssoAccessTokens").collect()
        await Promise.all(
            tokens
                .filter(
                    (token) => token.userId === args.userId && !token.revokedAt
                )
                .map((token) =>
                    ctx.db.patch(token._id, { revokedAt: args.now })
                )
        )
    },
})
