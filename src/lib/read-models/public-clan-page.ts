import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import {
    competitionPlacements,
    selectUpcomingPublicMatches,
    type CompetitionPlacement,
    type PublicClanResult,
    type PublicUpcomingMatch,
} from "@/domain/workspaces/public-clan-page"
import type { PublicCompetition } from "@/domain/competitions/competition"
import { getPublicCompetition } from "@/lib/read-models/competitions"
import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import { logRouteError } from "@/lib/server-route-errors"
import type { GameId } from "@/domain/games/game"
import { getInternalAuthSecret } from "@/lib/env"
import { requestTime } from "@/lib/request-time"

const getDetailsReference = makeFunctionReference<"query">("clanPublicPage:get")
const competitionClanLinksReference = makeFunctionReference<"query">(
    "clanPublicPage:competitionClanLinks"
)

type ClanPageRead = {
    inviteUrl: string | null
    games: GameId[]
    upcoming: PublicUpcomingMatch[]
    results: PublicClanResult[]
    teamIds: string[]
    competitionSlugs: string[]
}

/** What the public clan page shows next to `getPublicClan` (design J2). */
export type PublicClanPageDetails = {
    inviteUrl: string | null
    games: GameId[]
    upcoming: PublicUpcomingMatch[]
    results: PublicClanResult[]
    placements: CompetitionPlacement[]
}

const UPCOMING_SHOWN = 5
const RESULTS_SHOWN = 5

/**
 * Invite, announced upcoming matches, recent results and competition
 * placements of a public clan. `null` when the clan is not public, or when
 * the Convex deployment does not have this read yet (the page then shows the
 * profile without these parts).
 */
export async function getPublicClanPageDetails(
    guildId: string,
    now = requestTime()
): Promise<PublicClanPageDetails | null> {
    let read: ClanPageRead | null
    try {
        read = await cachedRead(
            ["public-clan-page", guildId],
            [appCacheTags.publicClan(guildId), appCacheTags.publicDiscovery()],
            async () =>
                (await fetchQuery(getDetailsReference, {
                    secret: getInternalAuthSecret(),
                    guildId,
                    now: new Date().toISOString(),
                })) as ClanPageRead | null,
            300
        )
    } catch (error) {
        logRouteError("publicClanPage.get", error)
        return null
    }
    if (!read) return null
    const competitions = (
        await Promise.all(read.competitionSlugs.map(getPublicCompetition))
    ).filter((competition): competition is PublicCompetition =>
        Boolean(competition)
    )
    return {
        inviteUrl: read.inviteUrl,
        games: read.games,
        // The read is cached; a match that has started since drops out here.
        upcoming: selectUpcomingPublicMatches(
            read.upcoming,
            now,
            UPCOMING_SHOWN
        ),
        results: read.results.slice(0, RESULTS_SHOWN),
        placements: competitionPlacements(competitions, new Set(read.teamIds)),
    }
}

/**
 * What the page can show when the J2 read is unavailable: the recorded
 * matches of the clan profile, without a side, so without a score.
 */
export function profileOnlyDetails(clan: {
    recentMatches: Array<{
        eventId: string
        name: string
        gameEnd: string
        mapName: string
        outcome?: string
    }>
}): PublicClanPageDetails {
    const outcomes = ["victory", "defeat", "draw"] as const
    return {
        inviteUrl: null,
        games: [],
        upcoming: [],
        placements: [],
        results: clan.recentMatches.slice(0, RESULTS_SHOWN).map((match) => ({
            eventId: match.eventId,
            gameId: "hell_let_loose",
            name: match.name,
            endedAt: match.gameEnd,
            mapName: match.mapName || null,
            outcome:
                outcomes.find((outcome) => outcome === match.outcome) ?? null,
            clanScore: null,
            opponentScore: null,
            opponent: null,
        })),
    }
}

/** Public clan page (Discord server ID) of each competition team that has one. */
export async function getCompetitionClanLinks(
    slug: string
): Promise<Record<string, string>> {
    try {
        return await cachedRead(
            ["competition-clan-links", slug],
            [appCacheTags.competition(slug), appCacheTags.publicDiscovery()],
            async () =>
                (await fetchQuery(competitionClanLinksReference, {
                    secret: getInternalAuthSecret(),
                    slug,
                })) as Record<string, string>,
            300
        )
    } catch (error) {
        logRouteError("publicClanPage.competitionClanLinks", error)
        return {}
    }
}
