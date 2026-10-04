import {
    isSsoCallback,
    isDiscordSubject,
    isSsoHash,
    isSsoNonce,
    isPkceChallenge,
    normalizeSsoScope,
    SSO_CODE_TTL_MS,
    ssoProfile,
} from "../src/domain/identity/sso-policy"
import {
    activeDashboardSession,
    assertSessionGateway,
} from "./dashboardSessionStore"
import { canAdminServerContext } from "../src/infrastructure/convex/server-read-model"
import { redeemSsoCode } from "../src/application/identity/redeem-sso-code"
import { getGuildById, getGuildDiscordId } from "./identity"
import type { MutationCtx } from "./_generated/server"
import { mutation, query } from "./_generated/server"
import { resolveSsoActor } from "./ssoTokenStore"
import type { Id } from "./_generated/dataModel"
import { v } from "convex/values"

function assertProvider(secret: string) {
    assertSessionGateway(secret)
    if (process.env.LOGI_SSO_ENABLED !== "true")
        throw new Error("Provider unavailable.")
}
const validCallback = (value: string) =>
    isSsoCallback(value, process.env.LOGI_SSO_ALLOW_LOOPBACK_HTTP === "true")

async function assertGuildAdmin(
    ctx: MutationCtx,
    guildId: string,
    userId: string
) {
    const guild = await getGuildById(ctx, guildId)
    if (!guild?.discordId || !isDiscordSubject(guild.discordId))
        throw new Error("Forbidden.")
    const discordAccess = await ctx.db
        .query("discordMemberAccess")
        .withIndex("guildId_userId", (q) =>
            q.eq("guildId", getGuildDiscordId(guild)).eq("userId", userId)
        )
        .unique()
    if (
        !canAdminServerContext({
            serverAdminIds: guild.adminIds,
            dashboardAdminIds: guild.dashboardAdminIds,
            adminAccessOverrides: guild.adminAccessOverrides,
            userId,
            discordAccess,
        })
    )
        throw new Error("Forbidden.")
}

export const listForGuild = query({
    args: { secret: v.string(), guildId: v.string() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const apps = await ctx.db
            .query("ssoApplications")
            .withIndex("guildId", (q) => q.eq("guildId", args.guildId))
            .collect()
        return apps.map((app) => ({
            id: String(app._id),
            clientId: app.clientId,
            guildId: app.guildId,
            name: app.name,
            websiteUrl: app.websiteUrl,
            redirectUris: app.redirectUris,
            createdAt: app.createdAt,
        }))
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
        assertProvider(args.secret)
        await assertGuildAdmin(ctx, args.guildId, args.userId)
        if (
            !/^logi_[A-Za-z0-9_-]{24}$/.test(args.clientId) ||
            !isSsoHash(args.clientSecretHash) ||
            !args.name.trim() ||
            args.name.length > 100 ||
            !validCallback(args.websiteUrl) ||
            args.redirectUris.length < 1 ||
            args.redirectUris.length > 10 ||
            !args.redirectUris.every(validCallback) ||
            args.backchannelLogoutUri
        )
            throw new Error("Invalid application configuration.")
        if (
            await ctx.db
                .query("ssoApplications")
                .withIndex("clientId", (q) => q.eq("clientId", args.clientId))
                .unique()
        )
            throw new Error("Client exists.")
        const now = new Date().toISOString()
        return await ctx.db.insert("ssoApplications", {
            guildId: args.guildId,
            clientId: args.clientId,
            clientSecretHash: args.clientSecretHash,
            name: args.name.trim(),
            websiteUrl: args.websiteUrl,
            redirectUris: [...new Set(args.redirectUris)],
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
        assertSessionGateway(args.secret)
        await assertGuildAdmin(ctx, args.guildId, args.userId)
        const app = await ctx.db
            .query("ssoApplications")
            .withIndex("clientId", (q) => q.eq("clientId", args.clientId))
            .unique()
        if (!app || app.guildId !== args.guildId) throw new Error("Not found.")
        await ctx.db.delete(app._id)
    },
})
export const getPublicClient = query({
    args: { secret: v.string(), clientId: v.string() },
    handler: async (ctx, args) => {
        assertProvider(args.secret)
        const app = await ctx.db
            .query("ssoApplications")
            .withIndex("clientId", (q) => q.eq("clientId", args.clientId))
            .unique()
        if (!app) return null
        const guild = await getGuildById(ctx, app.guildId)
        if (!guild?.discordId || !isDiscordSubject(guild.discordId)) return null
        const config = await ctx.db
            .query("discordConfigs")
            .withIndex("guildId", (q) => q.eq("guildId", app.guildId))
            .unique()
        return {
            clientId: app.clientId,
            guildId: guild.discordId,
            name: app.name,
            redirectUris: app.redirectUris.filter(validCallback),
            defaultLanguage: config?.defaultLanguage ?? "en",
        }
    },
})
export const createCode = mutation({
    args: {
        secret: v.string(),
        clientId: v.string(),
        redirectUri: v.string(),
        sid: v.string(),
        subject: v.string(),
        userRecordId: v.string(),
        codeHash: v.string(),
        codeChallenge: v.string(),
        nonce: v.string(),
        scope: v.string(),
    },
    handler: async (ctx, args) => {
        assertProvider(args.secret)
        if (
            !validCallback(args.redirectUri) ||
            !isSsoHash(args.codeHash) ||
            !isPkceChallenge(args.codeChallenge) ||
            !isSsoNonce(args.nonce) ||
            normalizeSsoScope(args.scope) !== args.scope
        )
            throw new Error("Invalid request.")
        const current = await activeDashboardSession(
            ctx,
            args.sid,
            args.subject,
            args.userRecordId
        )
        const app = await ctx.db
            .query("ssoApplications")
            .withIndex("clientId", (q) => q.eq("clientId", args.clientId))
            .unique()
        if (!current || !app || !app.redirectUris.includes(args.redirectUri))
            throw new Error("Invalid request.")
        const guild = await getGuildById(ctx, app.guildId)
        if (!guild?.discordId || !isDiscordSubject(guild.discordId))
            throw new Error("Invalid request.")
        if (
            await ctx.db
                .query("ssoAuthorizationCodes")
                .withIndex("codeHash", (q) => q.eq("codeHash", args.codeHash))
                .unique()
        )
            throw new Error("Code exists.")
        await ctx.db.insert("ssoAuthorizationCodes", {
            clientId: app.clientId,
            applicationRecordId: app._id,
            clientSecretHash: app.clientSecretHash,
            redirectUri: args.redirectUri,
            sessionId: current.session.sid,
            userRecordId: current.user._id,
            userId: current.session.subject,
            codeHash: args.codeHash,
            codeChallenge: args.codeChallenge,
            codeChallengeMethod: "S256",
            nonce: args.nonce,
            scope: args.scope,
            expiresAt: Math.min(
                Date.now() + SSO_CODE_TTL_MS,
                current.session.expiresAt
            ),
        })
    },
})
export const redeemCode = mutation({
    args: {
        secret: v.string(),
        clientId: v.string(),
        clientSecretHash: v.string(),
        codeHash: v.string(),
        redirectUri: v.string(),
        verifier: v.string(),
        tokenHash: v.string(),
    },
    handler: async (ctx, args) => {
        assertProvider(args.secret)
        if (
            ![args.clientSecretHash, args.codeHash, args.tokenHash].every(
                isSsoHash
            ) ||
            !validCallback(args.redirectUri)
        )
            return null
        return redeemSsoCode(
            {
                now: Date.now,
                load: async () => {
                    const app = await ctx.db
                        .query("ssoApplications")
                        .withIndex("clientId", (q) =>
                            q.eq("clientId", args.clientId)
                        )
                        .unique()
                    const code = await ctx.db
                        .query("ssoAuthorizationCodes")
                        .withIndex("codeHash", (q) =>
                            q.eq("codeHash", args.codeHash)
                        )
                        .unique()
                    if (!app || !code?.sessionId || !code.userRecordId)
                        return null
                    const guild = await getGuildById(ctx, app.guildId)
                    if (!guild?.discordId || !isDiscordSubject(guild.discordId))
                        return null
                    const current = await activeDashboardSession(
                        ctx,
                        code.sessionId,
                        code.userId,
                        String(code.userRecordId)
                    )
                    if (!current) return null
                    return {
                        applicationRecordId: String(app._id),
                        clientId: app.clientId,
                        clientSecretHash: app.clientSecretHash,
                        guildId: guild.discordId,
                        redirectUris: app.redirectUris,
                        code: { ...code, recordId: String(code._id) },
                        session: {
                            ...current.session,
                            userRecordId: String(current.session.userRecordId),
                        },
                        user: current.user,
                    }
                },
                challenge: async (verifier) => {
                    const digest = await crypto.subtle.digest(
                        "SHA-256",
                        new TextEncoder().encode(verifier)
                    )
                    return btoa(String.fromCharCode(...new Uint8Array(digest)))
                        .replace(/\+/g, "-")
                        .replace(/\//g, "_")
                        .replace(/=+$/, "")
                },
                consumeAndIssue: async (grant, input, now, expiresAt) => {
                    if (
                        await ctx.db
                            .query("ssoAccessTokens")
                            .withIndex("tokenHash", (q) =>
                                q.eq("tokenHash", input.tokenHash)
                            )
                            .unique()
                    )
                        throw new Error("Token exists.")
                    await ctx.db.patch(
                        grant.code.recordId as Id<"ssoAuthorizationCodes">,
                        { usedAt: now }
                    )
                    await ctx.db.insert("ssoAccessTokens", {
                        tokenHash: input.tokenHash,
                        clientId: input.clientId,
                        applicationRecordId:
                            grant.applicationRecordId as Id<"ssoApplications">,
                        clientSecretHash: grant.clientSecretHash,
                        userId: grant.session.subject,
                        userRecordId: grant.session.userRecordId as Id<"users">,
                        sessionId: grant.session.sid,
                        scope: grant.code.scope!,
                        expiresAt,
                    })
                },
            },
            args
        )
    },
})
export const getProfile = query({
    args: { secret: v.string(), tokenHash: v.string() },
    handler: async (ctx, args) => {
        assertProvider(args.secret)
        const actor = await resolveSsoActor(ctx, args.tokenHash)
        return actor
            ? ssoProfile({
                  subject: actor.subject,
                  sid: actor.sid,
                  name: actor.user.name,
                  avatar: actor.user.avatar,
                  guildId: actor.guildId,
              })
            : null
    },
})
