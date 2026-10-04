import {
    isDiscordSubject,
    isSsoOpaqueValue,
} from "../src/domain/identity/sso-policy"
import type { MutationCtx, QueryCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"

export function assertSessionGateway(secret: string) {
    if (
        !process.env.INTERNAL_AUTH_SECRET ||
        secret !== process.env.INTERNAL_AUTH_SECRET
    )
        throw new Error("Unauthorized.")
}

export async function activeDashboardSession(
    ctx: Pick<QueryCtx, "db">,
    sid: string,
    subject?: string,
    userRecordId?: string
) {
    if (!isSsoOpaqueValue(sid)) return null
    const session = await ctx.db
        .query("dashboardSessions")
        .withIndex("sid", (q) => q.eq("sid", sid))
        .unique()
    if (
        !session ||
        session.revokedAt !== undefined ||
        Date.now() >= session.expiresAt ||
        (subject !== undefined && session.subject !== subject) ||
        (userRecordId !== undefined &&
            String(session.userRecordId) !== userRecordId)
    )
        return null
    const user = await ctx.db.get(session.userRecordId)
    if (
        !user ||
        !isDiscordSubject(session.subject) ||
        user.discordId !== session.subject ||
        (user.sessionVersion ?? 0) !== session.userSessionVersion
    )
        return null
    // An account collision requires repair, never an imported-ID fallback.
    const exact = await ctx.db
        .query("users")
        .withIndex("discordId", (q) => q.eq("discordId", session.subject))
        .unique()
    return exact?._id === user._id ? { session, user } : null
}

export async function invalidateUserSessions(
    ctx: MutationCtx,
    userRecordId: Id<"users">
) {
    const user = await ctx.db.get(userRecordId)
    if (user)
        await ctx.db.patch(userRecordId, {
            sessionVersion: (user.sessionVersion ?? 0) + 1,
        })
}
