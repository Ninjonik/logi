import type { LeagueResult } from "@/application/leagues/portal.use-case"
import type { LeaguePortalView } from "@/domain/leagues/portal"
import { getVisibleGuildsForLoggedInUser } from "@/lib/auth"
import { canAdminWorkspace } from "@/lib/workspace-admin"
import { currentDashboardActor } from "./dashboard-actor"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import "server-only"
export async function leaguePortalAccess() {
    const actor = await currentDashboardActor()
    if (!actor) return null
    const guilds = await getVisibleGuildsForLoggedInUser()
    return {
        secret: getInternalAuthSecret(),
        actor,
        guildIds: guilds
            .filter(
                (guild) =>
                    actor.superadmin || canAdminWorkspace(guild, actor.subject)
            )
            .map((guild) => guild.discordId),
    }
}
export async function readLeagueAccount(competitionId: string | null) {
    const access = await leaguePortalAccess()
    if (!access) return null
    return fetchQuery(
        makeFunctionReference<
            "query",
            typeof access & { competitionId: string | null },
            LeaguePortalView
        >("leaguePortal:account"),
        { ...access, competitionId }
    )
}
export async function writeLeagueAccount(input: unknown) {
    const access = await leaguePortalAccess()
    if (!access) return null
    return fetchMutation(
        makeFunctionReference<
            "mutation",
            typeof access & { input: unknown },
            LeagueResult
        >("leaguePortal:execute"),
        { ...access, input }
    )
}
