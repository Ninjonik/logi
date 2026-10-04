import {
    activeDashboardSession,
    assertSessionGateway,
} from "./dashboardSessionStore"
import { canAdminServerContext } from "../src/infrastructure/convex/server-read-model"
import type { QueryCtx } from "./_generated/server"
import { getGuildByDiscordId } from "./identity"
import { v } from "convex/values"

export const dashboardActor = v.object({
    sid: v.string(),
    subject: v.string(),
    userRecordId: v.string(),
    superadmin: v.boolean(),
})
export type DashboardActor = {
    sid: string
    subject: string
    userRecordId: string
    /** Attested only by the authenticated web gateway's operator configuration. */
    superadmin: boolean
}

/** Evaluate durable login and workspace authority in the same transaction as the operation. */
export async function authorizeDashboardAdmin(
    ctx: Pick<QueryCtx, "db">,
    input: { secret: string; guildId: string; actor: DashboardActor }
) {
    assertSessionGateway(input.secret)
    if (!input.actor) throw new Error("Forbidden.")
    const active = await activeDashboardSession(
        ctx,
        input.actor.sid,
        input.actor.subject,
        input.actor.userRecordId
    )
    const server = await getGuildByDiscordId(ctx, input.guildId)
    if (!active || !server) throw new Error("Forbidden.")
    const access = await ctx.db
        .query("discordMemberAccess")
        .withIndex("guildId_userId", (q) =>
            q.eq("guildId", input.guildId).eq("userId", active.session.subject)
        )
        .unique()
    if (
        !input.actor.superadmin &&
        !canAdminServerContext({
            serverAdminIds: server.adminIds,
            dashboardAdminIds: server.dashboardAdminIds,
            adminAccessOverrides: server.adminAccessOverrides,
            userId: active.session.subject,
            discordAccess: access,
        })
    )
        throw new Error("Forbidden.")
    return { ...active, server }
}
