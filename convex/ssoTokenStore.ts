import {
    isDiscordSubject,
    isSsoHash,
    normalizeSsoScope,
} from "../src/domain/identity/sso-policy"
import { activeDashboardSession } from "./dashboardSessionStore"
import type { QueryCtx } from "./_generated/server"
import { getGuildById } from "./identity"

/** Recheck inside the final transaction for any operation acting as an SSO user. */
export async function resolveSsoActor(
    ctx: Pick<QueryCtx, "db">,
    tokenHash: string
) {
    if (process.env.LOGI_SSO_ENABLED !== "true" || !isSsoHash(tokenHash))
        return null
    const token = await ctx.db
        .query("ssoAccessTokens")
        .withIndex("tokenHash", (q) => q.eq("tokenHash", tokenHash))
        .unique()
    if (
        !token?.sessionId ||
        !token.userRecordId ||
        !token.applicationRecordId ||
        !token.scope ||
        normalizeSsoScope(token.scope) !== token.scope ||
        token.revokedAt !== undefined ||
        Date.now() >= token.expiresAt
    )
        return null
    const current = await activeDashboardSession(
        ctx,
        token.sessionId,
        token.userId,
        String(token.userRecordId)
    )
    const app = await ctx.db.get(token.applicationRecordId)
    if (
        !current ||
        !app ||
        app.clientId !== token.clientId ||
        app.clientSecretHash !== token.clientSecretHash
    )
        return null
    const guild = await getGuildById(ctx, app.guildId)
    if (!guild?.discordId || !isDiscordSubject(guild.discordId)) return null
    return {
        tokenId: String(token._id),
        applicationRecordId: app._id,
        clientId: app.clientId,
        guildId: guild.discordId,
        guildRecordId: guild._id,
        subject: current.session.subject,
        sid: current.session.sid,
        userRecordId: current.user._id,
        user: { name: current.user.name, avatar: current.user.avatar },
    }
}
