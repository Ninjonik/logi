import {
    activeDashboardSession,
    assertSessionGateway,
} from "./dashboardSessionStore"
import { authorizeDashboardAdmin, type DashboardActor } from "./dashboardActor"
import type { QueryCtx } from "./_generated/server"

/** Team ownership is independent of clan access; linked clan administrators can manage the profile too. */
export async function authorizeTeamProfile(
    ctx: Pick<QueryCtx, "db">,
    input: { secret: string; actor: DashboardActor; teamId: string }
) {
    assertSessionGateway(input.secret)
    const active = await activeDashboardSession(
        ctx,
        input.actor.sid,
        input.actor.subject,
        input.actor.userRecordId
    )
    if (!active) throw new Error("Forbidden.")
    const id = ctx.db.normalizeId("teamDirectory", input.teamId)
    const team = id ? await ctx.db.get(id) : null
    if (!team || team.archivedAt || team.mergedIntoTeamId)
        throw new Error("Forbidden.")
    const profile = await ctx.db
        .query("leagueTeamProfiles")
        .withIndex("teamId", (q) => q.eq("teamId", team._id))
        .unique()
    if (profile?.ownerUserId === active.user._id)
        return { subject: active.session.subject }
    if (!team.linkedGuildId) throw new Error("Forbidden.")
    await authorizeDashboardAdmin(ctx, {
        ...input,
        guildId: team.linkedGuildId,
    })
    return { subject: active.session.subject }
}
