import { GraduationCap, Plus } from "lucide-react"
import { connection } from "next/server"
import type { Metadata } from "next"
import Link from "next/link"

import {
    ClanListUnavailable,
    MatchListView,
} from "@/components/app/match-list-view"
import type { MatchListTab } from "@/components/app/match-list"
import { GAME_LABELS, isGameId } from "@/domain/games/game"
import { buildMatchListRows } from "@/lib/match-list-rows"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Trainings",
    description: "Training events and registration.",
}

function listTab(value: unknown): MatchListTab | undefined {
    return value === "upcoming" || value === "played" || value === "drafts"
        ? value
        : undefined
}

export default async function TrainingsPage({
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
    const createHref = `/${locale}/dashboard/servers/${serverId}/trainings/create${gameId ? `?game=${gameId}` : ""}`
    const { rows, drafts } = buildMatchListRows({
        events: context.events.filter((event) => event.kind === "training"),
        rosters: [],
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
        <MatchListView
            title={text.trainingsTitle}
            description={text.trainingsDescription}
            primaryAction={
                canAdmin
                    ? { href: createHref, label: text.newTraining, icon: Plus }
                    : undefined
            }
            rows={rows}
            drafts={drafts}
            // Trainings have no roster or result, so they never wait for a manager here.
            queue={[]}
            games={games}
            kinds={["training"]}
            canAdmin={canAdmin}
            // Trainings are rarely saved as drafts; the tab shows when one exists.
            draftsTab="whenAny"
            initialGame={gameId}
            initialTab={listTab(resolvedSearchParams?.tab)}
            empty={{
                icon: GraduationCap,
                title: text.emptyTrainingsTitle,
                description: canAdmin
                    ? text.emptyTrainingsAdmin
                    : text.emptyTrainingsMember,
                actions: canAdmin ? (
                    <Button asChild className="rounded-lg">
                        <Link href={createHref}>{text.newTraining}</Link>
                    </Button>
                ) : undefined,
            }}
            dictionary={dictionary}
        />
    )
}
