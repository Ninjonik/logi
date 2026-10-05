import { connection } from "next/server"
import type { Metadata } from "next"

import {
    ClanListUnavailable,
    RecurringMatchesView,
} from "@/components/app/match-list-view"
import { getClanFixtureLabels } from "@/lib/read-models/competition-labels"
import { getClanResultReviews } from "@/lib/read-models/result-reviews"
import { buildRecurringMatchRows } from "@/lib/match-list-rows"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Recurring matches",
    description: "Match series that repeat on a schedule.",
}

export default async function RecurringMatchesPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    await connection()
    const { locale: rawLocale, serverId } = await params
    const locale = isLocale(rawLocale) ? rawLocale : "en"
    const dictionary = getDictionary(locale)
    const context = await getServerContext(serverId)
    if (!context)
        return <ClanListUnavailable locale={locale} dictionary={dictionary} />
    const { canAdmin, discordConfig, server } = context
    const series = context.events.some((event) => event.recurrence)
    const [reviews, competitions] = await Promise.all([
        series && canAdmin ? getClanResultReviews(server.discordId) : undefined,
        series && context.events.some((event) => event.competitionFixtureId)
            ? getClanFixtureLabels(server.discordId)
            : undefined,
    ])
    const rows = buildRecurringMatchRows({
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
    return (
        <RecurringMatchesView
            rows={rows}
            canAdmin={canAdmin}
            base={`/${locale}/dashboard/servers/${serverId}`}
            dictionary={dictionary}
        />
    )
}
