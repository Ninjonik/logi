import type { Metadata } from "next"

import { DEFAULT_GAME_ID, GAME_LABELS, isGameId } from "@/domain/games/game"
import { matchTeamGame } from "@/lib/teams/match-team-selection"
import { TeamDirectory } from "@/components/app/team-directory"
import { ConfigNotice } from "@/components/app/config-notice"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { TEAM_GAMES } from "@/domain/teams/team"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Teams | Logi",
    description: "Manage the workspace team directory.",
}

export default async function ServerTeamsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string | string[] }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId, "all")
    if (!context?.canAdmin) return null

    const selected = typeof game === "string" && isGameId(game) ? game : null
    // The all-games view lists each supported game separately; HLL: Vietnam has no directory.
    const games = selected ? [matchTeamGame(selected)] : TEAM_GAMES
    const enabledGames = context.server.enabledGames ?? [DEFAULT_GAME_ID]

    return (
        <>
            <PageHeader
                title={dictionary.teams.title}
                description={dictionary.teams.description}
            />
            <div className="space-y-6 px-4 lg:px-6">
                {selected && !matchTeamGame(selected) ? (
                    <ConfigNotice tone="info" title={GAME_LABELS[selected]}>
                        {dictionary.teams.notAvailableForGame}
                    </ConfigNotice>
                ) : (
                    <TeamDirectory
                        serverId={serverId}
                        dictionary={dictionary}
                        settingsHref={`/${locale}/dashboard/servers/${serverId}/settings`}
                        sections={games.flatMap((gameId) =>
                            gameId
                                ? [
                                      {
                                          gameId,
                                          canAdd: enabledGames.includes(gameId),
                                      },
                                  ]
                                : []
                        )}
                    />
                )}
            </div>
        </>
    )
}
