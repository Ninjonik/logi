import { CalendarPlus, Plus, RefreshCw } from "lucide-react"
import { connection } from "next/server"
import type { Metadata } from "next"
import Link from "next/link"

import {
    ClanListUnavailable,
    MatchListView,
} from "@/components/app/match-list-view"
import { getClanFixtureLabels } from "@/lib/read-models/competition-labels"
import { getClanResultReviews } from "@/lib/read-models/result-reviews"
import type { MatchListTab } from "@/components/app/match-list"
import { GAME_LABELS, isGameId } from "@/domain/games/game"
import { buildMatchListRows } from "@/lib/match-list-rows"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Matches",
    description: "Matches, trainings, results and registration.",
}

function listTab(value: unknown): MatchListTab | undefined {
    return value === "upcoming" || value === "played" || value === "drafts"
        ? value
        : undefined
}

export default async function MatchesPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    await connection()
    const { locale: rawLocale, serverId } = await params
    const locale = isLocale(rawLocale) ? rawLocale : "en"
    const resolvedSearchParams = await searchParams
    const dictionary = getDictionary(locale)
    const game = resolvedSearchParams?.game
    const gameId = typeof game === "string" && isGameId(game) ? game : undefined
    const context = await getServerContext(serverId, "all")
    if (!context)
        return <ClanListUnavailable locale={locale} dictionary={dictionary} />
    const { canAdmin, discordConfig, server } = context
    const text = dictionary.matchList
    const base = `/${locale}/dashboard/servers/${serverId}`
    const createHref = `${base}/matches/create${gameId ? `?game=${gameId}` : ""}`
    // Result review state is read fresh, and only for the clan's managers.
    const [reviews, competitions] = await Promise.all([
        canAdmin ? getClanResultReviews(server.discordId) : undefined,
        context.events.some((event) => event.competitionFixtureId)
            ? getClanFixtureLabels(server.discordId)
            : undefined,
    ])
    const { rows, drafts, queue } = buildMatchListRows({
        events: context.events,
        rosters: context.rosters,
        categories: server.eventCategories,
        canAdmin,
        locale,
        serverId,
        timeZone: discordConfig?.timezone ?? "UTC",
        dictionary,
        now: new Date(),
        reviews,
        competitions,
    })
    const games = (server.enabledGames ?? []).map((id) => ({
        id,
        label: GAME_LABELS[id],
    }))

    return (
        <MatchListView
            title={text.title}
            description={text.description}
            secondaryAction={
                canAdmin
                    ? {
                          href: `${base}/matches/recurring`,
                          label: text.recurring,
                          icon: RefreshCw,
                      }
                    : undefined
            }
            primaryAction={
                canAdmin
                    ? { href: createHref, label: text.newMatch, icon: Plus }
                    : undefined
            }
            rows={rows}
            drafts={drafts}
            queue={queue}
            games={games}
            kinds={["match", "training"]}
            canAdmin={canAdmin}
            initialGame={gameId}
            initialTab={listTab(resolvedSearchParams?.tab)}
            empty={{
                icon: CalendarPlus,
                title: text.emptyTitle,
                description: canAdmin ? text.emptyAdmin : text.emptyMember,
                actions: canAdmin ? (
                    <>
                        <Button asChild className="rounded-lg">
                            <Link href={createHref}>{text.newMatch}</Link>
                        </Button>
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-lg"
                        >
                            <Link href={`${base}/settings/match-templates`}>
                                {text.editTemplates}
                            </Link>
                        </Button>
                    </>
                ) : undefined,
            }}
            dictionary={dictionary}
        />
    )
}
