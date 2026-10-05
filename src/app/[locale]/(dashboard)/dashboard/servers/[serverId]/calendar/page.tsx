import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { CalendarView } from "@/components/app/calendar-view"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Calendar | Logi",
    description: "View scheduled community events.",
}

export default async function ServerCalendarPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(
        serverId,
        isGameId(game) ? game : "all"
    )
    if (!context) notFound()
    const { events, rosters, discordConfig, server, groups } = context

    return (
        <>
            <PageHeader
                title={dictionary.calendarPage.title}
                description={dictionary.calendarPage.description}
            />
            <div className="px-4 lg:px-6">
                <CalendarView
                    locale={safeLocale}
                    serverId={serverId}
                    events={events}
                    calendarItems={server.calendarItems ?? []}
                    groups={groups}
                    eventCategories={server.eventCategories ?? []}
                    rosters={rosters}
                    timezone={discordConfig?.timezone}
                    dictionary={dictionary}
                    signupLanguage={discordConfig?.defaultLanguage ?? "en"}
                    currentUserId={context.user.discordId}
                    canAdmin={context.canAdmin}
                />
            </div>
        </>
    )
}
