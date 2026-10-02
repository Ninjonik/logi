import {
    activeDashboardSession,
    assertSessionGateway,
} from "./dashboardSessionStore"
import { canAdminServerContext } from "../src/infrastructure/convex/server-read-model"
import type { MutationCtx } from "./_generated/server"
import type { Id } from "./_generated/dataModel"
import { getGuildDiscordId } from "./identity"

export type RosterDashboardActor = {
    sid: string
    subject: string
    userRecordId: string
    /** Attested only by the authenticated web gateway's operator configuration. */
    superadmin: boolean
}

/** Recheck the durable login and current workspace access in the writer transaction. */
export async function authorizeRosterManager(
    ctx: MutationCtx,
    input: {
        secret: string
        serverId: Id<"guilds">
        actor: RosterDashboardActor
        eventId: Id<"events">
    }
) {
    assertSessionGateway(input.secret)
    if (!input.actor) throw new Error("Forbidden.")
    const active = await activeDashboardSession(
        ctx,
        input.actor.sid,
        input.actor.subject,
        input.actor.userRecordId
    )
    const server = await ctx.db.get(input.serverId)
    if (!active || !server) throw new Error("Forbidden.")
    const guildId = getGuildDiscordId(server)
    const access = await ctx.db
        .query("discordMemberAccess")
        .withIndex("guildId_userId", (q) =>
            q.eq("guildId", guildId).eq("userId", active.session.subject)
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
    const event = await ctx.db.get(input.eventId)
    if (!event || event.guildId !== guildId) throw new Error("Event not found.")
    return { event, guildId }
}
