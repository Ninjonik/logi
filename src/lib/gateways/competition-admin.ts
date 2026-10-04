import type {
    CompetitionAdminView,
    CompetitionListItem,
    FixtureEventCandidate,
} from "@/domain/competitions/admin-view"
import {
    COMPETITION_TEAM_SEARCH_LIMIT,
    competitionAdminHandlers,
} from "@/lib/api/competition-admin-route"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import type { DashboardActor } from "../../../convex/dashboardActor"
import { currentDashboardActor } from "./dashboard-actor"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import type { TeamRecord } from "@/domain/teams/team"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"

/** Convex access of the current global administrator. */
export type CompetitionAdminAccess = { secret: string; actor: DashboardActor }

/** Null unless the current dashboard session is attested as a global administrator. */
export async function competitionAdminAccess(): Promise<CompetitionAdminAccess | null> {
    const actor = await currentDashboardActor()
    return actor?.superadmin ? { secret: getInternalAuthSecret(), actor } : null
}

export async function listCompetitionsForAdmin(
    access: CompetitionAdminAccess
): Promise<CompetitionListItem[]> {
    return await fetchQuery(
        makeFunctionReference<
            "query",
            CompetitionAdminAccess,
            CompetitionListItem[]
        >("competitions:adminList"),
        access
    )
}

export async function getCompetitionForAdmin(
    access: CompetitionAdminAccess,
    competitionId: string
): Promise<CompetitionAdminView | null> {
    return await fetchQuery(
        makeFunctionReference<
            "query",
            CompetitionAdminAccess & { competitionId: string },
            CompetitionAdminView | null
        >("competitions:adminGet"),
        { ...access, competitionId }
    )
}

/** Active catalogue teams of the competition's game; null when the competition is gone. */
async function searchCompetitionTeams(
    access: CompetitionAdminAccess,
    competitionId: string,
    search: string | undefined
): Promise<{ items: TeamRecord[] } | null> {
    const view = await getCompetitionForAdmin(access, competitionId)
    if (!view) return null
    const gameId = view.competition.gameId
    if (gameId !== "hell_let_loose" && gameId !== "wardogs")
        return { items: [] }
    const page = await fetchQuery(
        makeFunctionReference<"query">("teams:adminList"),
        {
            ...access,
            gameId,
            archived: false,
            ...(search ? { search } : {}),
            cursor: null,
            limit: COMPETITION_TEAM_SEARCH_LIMIT,
        }
    )
    return { items: (page as { items: TeamRecord[] }).items }
}

async function linkCandidates(
    access: CompetitionAdminAccess,
    fixtureId: string
): Promise<FixtureEventCandidate[]> {
    return await fetchQuery(
        makeFunctionReference<
            "query",
            CompetitionAdminAccess & { fixtureId: string },
            FixtureEventCandidate[]
        >("competitions:linkCandidates"),
        { ...access, fixtureId }
    )
}

/** Route handlers wired to Convex and the public competition cache. */
export const competitionAdminRoutes = competitionAdminHandlers({
    access: competitionAdminAccess,
    list: listCompetitionsForAdmin,
    get: getCompetitionForAdmin,
    searchTeams: searchCompetitionTeams,
    linkCandidates,
    command: async (access, mutation, args) =>
        await fetchMutation(makeFunctionReference<"mutation">(mutation), {
            ...access,
            ...args,
        }),
    revalidate: (slugs) =>
        revalidateCacheEntries([
            ...slugs.map(appCacheTags.competition),
            appCacheTags.publicDiscovery(),
        ]),
})
