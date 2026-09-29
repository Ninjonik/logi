import {
    assertLinkChallenge,
    type LinkActorSession,
    type VerifiedPlatformLink,
} from "../src/domain/identity/platform-link"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Doc, Id } from "./_generated/dataModel"

export async function platformLinkUser(
    ctx: Pick<QueryCtx, "db">,
    discordUserId: string
) {
    const user = await ctx.db
        .query("users")
        .withIndex("discordId", (q) => q.eq("discordId", discordUserId))
        .unique()
    if (!user || user.discordId !== discordUserId)
        throw new Error("Linked account required.")
    return user
}
export function publicPlatformLink(
    link: Doc<"platformIdentityLinks">
): VerifiedPlatformLink {
    return {
        platform: link.platform,
        platformId: link.platformId,
        logiUserId: link.logiUserId,
        method: link.method,
        verifiedAt: link.verifiedAt,
        revokedAt: link.revokedAt,
    }
}
export async function currentChallenge(
    ctx: Pick<QueryCtx, "db">,
    id: Id<"platformLinkChallenges">,
    actor: LinkActorSession
) {
    const challenge = await ctx.db.get(id)
    if (!challenge) throw new Error("Steam challenge unavailable.")
    assertLinkChallenge(challenge, actor, Date.now(), "verifying")
    const user = await platformLinkUser(ctx, actor.discordUserId)
    if (user._id !== challenge.userRecordId)
        throw new Error("Linked account changed.")
    return { challenge, user }
}
export async function cancelPlatformChallenges(
    ctx: MutationCtx,
    userRecordId: Id<"users">,
    sessionHash?: string
) {
    const challenges = await ctx.db
        .query("platformLinkChallenges")
        .withIndex("userRecordId_createdAt", (q) =>
            q.eq("userRecordId", userRecordId)
        )
        .collect()
    for (const challenge of challenges)
        if (
            (!sessionHash || challenge.sessionHash === sessionHash) &&
            ["pending", "verifying"].includes(challenge.status)
        )
            await ctx.db.patch(challenge._id, { status: "cancelled" })
}
/** Administrative identity changes invalidate proof; they never transfer it. */
export async function revokePlatformIdentity(
    ctx: MutationCtx,
    userRecordId: Id<"users">
) {
    await cancelPlatformChallenges(ctx, userRecordId)
    const links = await ctx.db
        .query("platformIdentityLinks")
        .withIndex("userRecordId_verifiedAt", (q) =>
            q.eq("userRecordId", userRecordId)
        )
        .collect()
    for (const link of links)
        if (link.active)
            await ctx.db.patch(link._id, {
                active: false,
                revokedAt: Date.now(),
            })
}
export async function findActivePlatformLink(
    ctx: Pick<QueryCtx, "db">,
    platformId: string
) {
    const link = await ctx.db
        .query("platformIdentityLinks")
        .withIndex("platform_platformId_active", (q) =>
            q
                .eq("platform", "steam")
                .eq("platformId", platformId)
                .eq("active", true)
        )
        .unique()
    if (!link) return null
    const user = await ctx.db.get(link.userRecordId)
    return user?.discordId === link.discordUserId ? link : null
}
