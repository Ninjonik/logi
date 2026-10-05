import { CalendarPlus, Plus, Repeat } from "lucide-react"
import { connection } from "next/server"
import type { Metadata } from "next"
import Link from "next/link"

import { GAME_LABELS, isGameId } from "@/domain/games/game"
import { buildMatchListRows } from "@/lib/match-list-rows"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { MatchList } from "@/components/app/match-list"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Matches | Logi",
    description: "Matches, trainings, results and registration.",
}

export default async function MatchesPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    await connection()
    const { locale, serverId } = await params
    const resolvedSearchParams = await searchParams
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const game = resolvedSearchParams?.game
    const gameId = typeof game === "string" && isGameId(game) ? game : undefined
    const context = await getServerContext(serverId, "all")
    if (!context) return null
    const { canAdmin, discordConfig, server } = context
    const text = dictionary.matchList
    const base = `/${locale}/dashboard/servers/${serverId}`
    const createHref = `${base}/matches/create${gameId ? `?game=${gameId}` : ""}`
    const { rows, queue } = buildMatchListRows({
        events: context.events,
        rosters: context.rosters,
        categories: server.eventCategories,
        canAdmin,
        locale,
        serverId,
        timeZone: discordConfig?.timezone ?? "UTC",
        dictionary,
        now: new Date(),
    })
    const games = (server.enabledGames ?? []).map((id) => ({
        id,
        label: GAME_LABELS[id],
    }))

    return (
        <div className="space-y-6 pb-8">
            <PageHeader
                title={text.title}
                description={text.description}
                actions={
                    canAdmin ? (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-xl"
                            >
                                <Link href={`${base}/matches/recurring`}>
                                    <Repeat
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {text.recurring}
                                </Link>
                            </Button>
                            <Button asChild className="rounded-xl">
                                <Link href={createHref}>
                                    <Plus
                                        className="size-4"
                                        aria-hidden="true"
                                    />
                                    {text.newMatch}
                                </Link>
                            </Button>
                        </div>
                    ) : undefined
                }
            />
            <div className="px-4 lg:px-6">
                {rows.length ? (
                    <MatchList
                        rows={rows}
                        queue={queue}
                        games={games}
                        initialGame={gameId}
                        initialTab={
                            resolvedSearchParams?.tab === "played"
                                ? "played"
                                : "upcoming"
                        }
                        dictionary={dictionary}
                    />
                ) : (
                    <EmptyState
                        icon={CalendarPlus}
                        title={text.emptyTitle}
                        description={
                            canAdmin ? text.emptyAdmin : text.emptyMember
                        }
                        actions={
                            canAdmin ? (
                                <>
                                    <Button asChild className="rounded-xl">
                                        <Link href={createHref}>
                                            {text.newMatch}
                                        </Link>
                                    </Button>
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="rounded-xl"
                                    >
                                        <Link
                                            href={`${base}/settings/match-templates`}
                                        >
                                            {text.editTemplates}
                                        </Link>
                                    </Button>
                                </>
                            ) : undefined
                        }
                    />
                )}
            </div>
        </div>
    )
}
