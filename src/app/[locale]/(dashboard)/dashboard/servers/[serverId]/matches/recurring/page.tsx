import Link from "next/link"

import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
import { isLocale } from "@/i18n/config"

export default async function RecurringMatchesPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    const { locale, serverId } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId)
    if (!context) return null
    const matches = context.events
        .filter((event) => event.kind === "match" && event.recurrence)
        .sort(
            (left, right) =>
                new Date(right.gameStart).getTime() -
                new Date(left.gameStart).getTime()
        )
    return (
        <main className="space-y-6">
            <PageHeader
                title={dictionary.event.recurringMatches}
                description={dictionary.event.recurringMatchesDescription}
                actions={
                    context.canAdmin ? (
                        <Button asChild className="rounded-xl">
                            <Link
                                href={`/${locale}/dashboard/servers/${serverId}/matches/create`}
                            >
                                {dictionary.common.createEvent}
                            </Link>
                        </Button>
                    ) : undefined
                }
            />
            <div className="space-y-3">
                {matches.map((match) => (
                    <Link
                        key={match.id}
                        href={`/${locale}/dashboard/servers/${serverId}/matches/${match.id}`}
                        className="border-border/60 hover:bg-muted/50 block rounded-2xl border p-4 transition"
                    >
                        <div className="font-medium">{match.name}</div>
                        <div className="text-muted-foreground mt-1 text-sm">
                            {formatDateTime(
                                match.gameStart,
                                context.discordConfig?.timezone
                            )}{" "}
                            ·{" "}
                            {match.recurrence?.frequency === "weekly"
                                ? dictionary.event.recurrenceWeekly
                                : match.recurrence?.frequency === "monthly_date"
                                  ? dictionary.event.recurrenceMonthlyDate
                                  : dictionary.event
                                        .recurrenceMonthlyNthWeekday}
                        </div>
                    </Link>
                ))}
                {!matches.length ? (
                    <p className="text-muted-foreground rounded-2xl border border-dashed p-8 text-center text-sm">
                        {dictionary.event.noRecurringMatches}
                    </p>
                ) : null}
            </div>
        </main>
    )
}
