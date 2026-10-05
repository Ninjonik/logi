import { Repeat } from "lucide-react"
import Link from "next/link"

import { describeRecurrence } from "@/lib/match-list-format"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { GameBadge } from "@/components/app/game-badge"
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
    const timezone = context.discordConfig?.timezone
    const matches = context.events
        .filter((event) => event.kind === "match" && event.recurrence)
        .sort(
            (left, right) =>
                new Date(right.gameStart).getTime() -
                new Date(left.gameStart).getTime()
        )
    const createHref = `/${locale}/dashboard/servers/${serverId}/matches/create`
    return (
        <>
            <PageHeader
                title={dictionary.event.recurringMatches}
                description={dictionary.event.recurringMatchesDescription}
                actions={
                    context.canAdmin ? (
                        <Button asChild className="rounded-xl">
                            <Link href={createHref}>
                                {dictionary.event.createMatchAction}
                            </Link>
                        </Button>
                    ) : undefined
                }
            />
            <div className="space-y-3 px-4 pb-8 lg:px-6">
                {matches.length ? (
                    <>
                        {context.canAdmin ? (
                            <p className="text-muted-foreground text-sm">
                                {dictionary.matchList.recurringStopHint}
                            </p>
                        ) : null}
                        <ul className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-2xl border">
                            {matches.map((match) => {
                                const href = `/${locale}/dashboard/servers/${serverId}/matches/${match.id}`
                                return (
                                    <li
                                        key={match.id}
                                        className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
                                    >
                                        <div className="min-w-0 flex-1">
                                            <Link
                                                href={href}
                                                className="font-medium underline-offset-4 hover:underline"
                                            >
                                                {match.name}
                                            </Link>
                                            <div className="text-muted-foreground mt-0.5 text-sm">
                                                {match.recurrence
                                                    ? describeRecurrence(
                                                          match.recurrence,
                                                          dictionary,
                                                          locale
                                                      )
                                                    : null}{" "}
                                                ·{" "}
                                                {formatDateTime(
                                                    match.gameStart,
                                                    timezone
                                                )}
                                            </div>
                                        </div>
                                        <GameBadge
                                            gameId={match.gameId}
                                            dictionary={dictionary}
                                        />
                                        {context.canAdmin ? (
                                            <Button
                                                asChild
                                                variant="outline"
                                                size="sm"
                                                className="rounded-xl"
                                            >
                                                <Link
                                                    href={`${href}#recurrence`}
                                                >
                                                    {
                                                        dictionary.matchList
                                                            .editSeries
                                                    }
                                                </Link>
                                            </Button>
                                        ) : null}
                                    </li>
                                )
                            })}
                        </ul>
                    </>
                ) : (
                    <EmptyState
                        icon={Repeat}
                        title={dictionary.event.noRecurringMatches}
                        description={
                            context.canAdmin
                                ? dictionary.matchList.recurringEmptyAdmin
                                : undefined
                        }
                        actions={
                            context.canAdmin ? (
                                <Button asChild className="rounded-xl">
                                    <Link href={createHref}>
                                        {dictionary.event.createMatchAction}
                                    </Link>
                                </Button>
                            ) : undefined
                        }
                    />
                )}
            </div>
        </>
    )
}
