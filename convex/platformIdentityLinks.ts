import {
    cancelPlatformChallenges,
    currentChallenge,
    platformLinkUser,
    publicPlatformLink,
    revokePlatformIdentity,
} from "./platformIdentityStore"
import {
    assertLinkChallenge,
    LINK_TTL_MS,
    steamCallbackUrl,
    verifiedPlatformLinkSchema,
} from "../src/domain/identity/platform-link"
import { activeDashboardSession } from "./dashboardSessionStore"
import { assertMembershipSecret } from "./membershipAccess"
import { mutation } from "./integrationMutation"
import { getUserStableId } from "./identity"
import { query } from "./_generated/server"
import { v } from "convex/values"

const actor = { secret: v.string(), discordUserId: v.string() }
const session = { ...actor, sessionHash: v.string() }
const challengeArgs = {
    ...session,
    challengeId: v.id("platformLinkChallenges"),
}
export const begin = mutation({
    args: {
        ...session,
        sid: v.string(),
        tokenHash: v.string(),
        returnOrigin: v.string(),
        locale: v.union(v.literal("en"), v.literal("cs"), v.literal("de")),
        expiresAt: v.number(),
    },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        steamCallbackUrl(args.returnOrigin, "check")
        const user = await platformLinkUser(ctx, args.discordUserId)
        if (
            !(await activeDashboardSession(
                ctx,
                args.sid,
                args.discordUserId,
                String(user._id)
            ))
        )
            throw new Error("Session changed.")
        const now = Date.now()
        if (
            !/^[a-f0-9]{64}$/.test(args.tokenHash) ||
            !/^[a-f0-9]{64}$/.test(args.sessionHash) ||
            args.expiresAt <= now ||
            args.expiresAt > now + LINK_TTL_MS
        )
            throw new Error("Invalid challenge.")
        const history = await ctx.db
            .query("platformLinkChallenges")
            .withIndex("userRecordId_createdAt", (q) =>
                q.eq("userRecordId", user._id)
            )
            .order("desc")
            .collect()
        if (history.some((row) => row.createdAt > now - 30_000))
            throw new Error("Please wait before starting another Steam link.")
        await cancelPlatformChallenges(ctx, user._id)
        for (const row of history.slice(9)) await ctx.db.delete(row._id)
        if (
            await ctx.db
                .query("platformLinkChallenges")
                .withIndex("tokenHash", (q) =>
                    q.eq("tokenHash", args.tokenHash)
                )
                .unique()
        )
            throw new Error("Challenge conflict.")
        await ctx.db.insert("platformLinkChallenges", {
            tokenHash: args.tokenHash,
            sessionHash: args.sessionHash,
            sid: args.sid,
            discordUserId: args.discordUserId,
            returnOrigin: args.returnOrigin,
            locale: args.locale,
            userRecordId: user._id,
            createdAt: now,
            expiresAt: Math.min(args.expiresAt, now + LINK_TTL_MS),
            status: "pending",
        })
        const expired = await ctx.db
            .query("platformLinkNonces")
            .withIndex("expiresAt", (q) => q.lt("expiresAt", now))
            .take(20)
        for (const nonce of expired) await ctx.db.delete(nonce._id)
    },
})
export const claim = mutation({
    args: { ...session, tokenHash: v.string() },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const challenge = await ctx.db
            .query("platformLinkChallenges")
            .withIndex("tokenHash", (q) => q.eq("tokenHash", args.tokenHash))
            .unique()
        if (!challenge) throw new Error("Steam challenge unavailable.")
        assertLinkChallenge(challenge, args, Date.now(), "pending")
        const user = await platformLinkUser(ctx, args.discordUserId)
        if (user._id !== challenge.userRecordId)
            throw new Error("Linked account changed.")
        await ctx.db.patch(challenge._id, { status: "verifying" })
        return {
            id: challenge._id,
            discordUserId: challenge.discordUserId,
            sessionHash: challenge.sessionHash,
            returnOrigin: challenge.returnOrigin,
            locale: challenge.locale,
            expiresAt: challenge.expiresAt,
            status: "verifying" as const,
        }
    },
})
export const complete = mutation({
    args: { ...challengeArgs, platformId: v.string(), nonceHash: v.string() },
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const { user } = await currentChallenge(ctx, args.challengeId, args)
        if (!/^[a-f0-9]{64}$/.test(args.nonceHash))
            throw new Error("Invalid nonce.")
        const now = Date.now()
        const data = verifiedPlatformLinkSchema.parse({
            platform: "steam",
            platformId: args.platformId,
            logiUserId: getUserStableId(user),
            method: "steam_openid",
            verifiedAt: now,
            revokedAt: null,
        })
        // The indexed read and insert are in one Convex serializable transaction.
        const owner = await ctx.db
            .query("platformIdentityLinks")
            .withIndex("platform_platformId_active", (q) =>
                q
                    .eq("platform", "steam")
                    .eq("platformId", args.platformId)
                    .eq("active", true)
            )
            .unique()
        if (owner) throw new Error("Steam account already linked.")
        const history = await ctx.db
            .query("platformIdentityLinks")
            .withIndex("userRecordId_verifiedAt", (q) =>
                q.eq("userRecordId", user._id)
            )
            .order("desc")
            .collect()
        if (history.some((row) => row.active))
            throw new Error("Unlink the current Steam account first.")
        if (
            await ctx.db
                .query("platformLinkNonces")
                .withIndex("nonceHash", (q) =>
                    q.eq("nonceHash", args.nonceHash)
                )
                .unique()
        )
            throw new Error("Steam assertion replayed.")
        await ctx.db.insert("platformLinkNonces", {
            nonceHash: args.nonceHash,
            expiresAt: now + 86_400_000,
        })
        for (const row of history.slice(19)) await ctx.db.delete(row._id)
        await ctx.db.insert("platformIdentityLinks", {
            ...data,
            userRecordId: user._id,
            discordUserId: args.discordUserId,
            active: true,
        })
        await ctx.db.patch(args.challengeId, { status: "consumed" })
        return data
    },
})
export const fail = mutation({
    args: challengeArgs,
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const challenge = await ctx.db.get(args.challengeId)
        if (
            challenge?.status === "verifying" &&
            challenge.discordUserId === args.discordUserId &&
            challenge.sessionHash === args.sessionHash
        )
            await ctx.db.patch(challenge._id, { status: "failed" })
    },
})
export const unlink = mutation({
    args: actor,
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const user = await platformLinkUser(ctx, args.discordUserId)
        await revokePlatformIdentity(ctx, user._id)
    },
})
export const cancelSession = mutation({
    args: session,
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const user = await platformLinkUser(ctx, args.discordUserId)
        await cancelPlatformChallenges(ctx, user._id, args.sessionHash)
    },
})
export const list = query({
    args: actor,
    handler: async (ctx, args) => {
        assertMembershipSecret(args.secret)
        const user = await platformLinkUser(ctx, args.discordUserId)
        const links = await ctx.db
            .query("platformIdentityLinks")
            .withIndex("userRecordId_verifiedAt", (q) =>
                q.eq("userRecordId", user._id)
            )
            .order("desc")
            .take(20)
        return links.map(publicPlatformLink)
    },
})
