import {
    ConvexLeaguePortalRepository,
    leagueOwnership,
    leaguePortalView,
} from "../src/infrastructure/convex/league-portal-repository"
import {
    activeDashboardSession,
    assertSessionGateway,
} from "./dashboardSessionStore"
import { executeLeagueCommand } from "../src/application/leagues/portal.use-case"
import type { DashboardActor } from "./dashboardActor"
import type { QueryCtx } from "./_generated/server"
import { dashboardActor } from "./dashboardActor"
import { mutation } from "./integrationMutation"
import { query } from "./_generated/server"
import { v } from "convex/values"
const access = {
    secret: v.string(),
    actor: dashboardActor,
    guildIds: v.array(v.string()),
}
async function authorize(
    ctx: Pick<QueryCtx, "db">,
    args: { secret: string; actor: DashboardActor; guildIds: string[] }
) {
    assertSessionGateway(args.secret)
    const active = await activeDashboardSession(
        ctx,
        args.actor.sid,
        args.actor.subject,
        args.actor.userRecordId
    )
    if (!active) throw new Error("Unauthorized")
    return { ...args, user: active.user }
}
export const account = query({
    args: { ...access, competitionId: v.union(v.string(), v.null()) },
    handler: async (ctx, args) =>
        leaguePortalView(ctx, await authorize(ctx, args), args.competitionId),
})
export const execute = mutation({
    args: { ...access, input: v.any() },
    handler: async (ctx, args) => {
        const scope = await authorize(ctx, args)
        const ownership = await leagueOwnership(ctx, scope)
        return executeLeagueCommand(
            new ConvexLeaguePortalRepository(
                ctx,
                scope,
                ownership,
                new Date().toISOString()
            ),
            args.input
        )
    },
})
