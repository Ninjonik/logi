"use client"

import { CalendarDays } from "lucide-react"
import Link from "next/link"

import type {
    CalendarItem,
    EventCategory,
    EventRecord,
    Group,
    Roster,
} from "@/types/domain"
import {
    buildCalendarDisplayEntries,
    type CalendarDisplayEntry,
} from "@/lib/calendar-entries"
import {
    getCalendarEntryTiles,
    InfoTile,
} from "@/components/app/calendar-entry-tiles"
import { CalendarItemCreateDialog } from "@/components/app/calendar-item-create-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { MonthCalendarView } from "@/components/app/month-calendar-view"
import { EmptyState } from "@/components/app/empty-state"
import { EmojiValue } from "@/components/app/emoji-value"
import type { Dictionary } from "@/i18n/dictionaries"
import { toIntlLocale } from "@/lib/intl-locale"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { formatDateTime } from "@/lib/format"
import type { Locale } from "@/i18n/config"

export function CalendarView({
    locale,
    serverId,
    events,
    calendarItems = [],
    groups,
    eventCategories = [],
    rosters,
    timezone,
    dictionary,
    signupLanguage,
    currentUserId,
    canAdmin,
}: {
    locale: Locale
    serverId: string
    events: EventRecord[]
    calendarItems?: CalendarItem[]
    groups: Group[]
    eventCategories?: EventCategory[]
    rosters: Roster[]
    timezone?: string
    dictionary: Dictionary
    signupLanguage: "en" | "cs" | "de"
    currentUserId?: string
    canAdmin?: boolean
}) {
    const now = new Date()
    const displayEntries = buildCalendarDisplayEntries({
        events,
        eventCategories,
        calendarItems,
        rangeStart: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
        rangeEnd: new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000),
    })
    const highlightedEntries = displayEntries
        .filter((entry) => new Date(entry.endAt).getTime() >= now.getTime())
        .slice(0, 3)
    const intlLocale = toIntlLocale(locale)
    const formatInstant = (value: string) =>
        formatDateTime(value, timezone, intlLocale)

    return (
        <div className="space-y-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                {timezone ? (
                    <p className="text-muted-foreground text-sm">
                        {dictionary.calendarPage.timezoneHint.replace(
                            "{timezone}",
                            timezone
                        )}
                    </p>
                ) : (
                    <span />
                )}
                {canAdmin ? (
                    <CalendarItemCreateDialog
                        serverId={serverId}
                        dictionary={dictionary}
                        timezone={timezone}
                    />
                ) : null}
            </div>
            <MonthCalendarView
                locale={locale}
                serverId={serverId}
                entries={displayEntries}
                groups={groups}
                timezone={timezone}
                dictionary={dictionary}
                signupLanguage={signupLanguage}
                currentUserId={currentUserId}
                canAdmin={canAdmin}
            />
            <section className="space-y-3" aria-labelledby="calendar-next-up">
                <h2
                    id="calendar-next-up"
                    className="text-muted-foreground text-xs font-semibold tracking-[0.04em] uppercase"
                >
                    {dictionary.calendarPage.nextUp}
                </h2>
                {highlightedEntries.length ? (
                    <div className="grid gap-4 xl:grid-cols-3">
                        {highlightedEntries.map((entry) => (
                            <HighlightedEntryCard
                                key={entry.id}
                                entry={entry}
                                locale={locale}
                                serverId={serverId}
                                roster={
                                    entry.kind === "event"
                                        ? rosters.find(
                                              (item) =>
                                                  item.eventId ===
                                                  entry.event.id
                                          )
                                        : undefined
                                }
                                dictionary={dictionary}
                                formatInstant={formatInstant}
                            />
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={CalendarDays}
                        title={dictionary.calendarPage.emptyTitle}
                        description={dictionary.calendarPage.emptyDescription}
                    />
                )}
            </section>
        </div>
    )
}

function HighlightedEntryCard({
    entry,
    locale,
    serverId,
    roster,
    dictionary,
    formatInstant,
}: {
    entry: CalendarDisplayEntry
    locale: Locale
    serverId: string
    roster?: Roster
    dictionary: Dictionary
    formatInstant: (value: string) => string
}) {
    const detailPath =
        entry.kind === "event"
            ? `/${locale}/dashboard/servers/${serverId}/${entry.event.kind === "training" ? "trainings" : "matches"}/${entry.event.id}`
            : null

    return (
        <Card
            className="border-border/60 rounded-2xl"
            style={{
                boxShadow: `inset 4px 0 0 ${entry.color}`,
            }}
        >
            <CardHeader>
                {entry.label ? (
                    <Badge
                        variant="outline"
                        className="mb-2 rounded-full"
                        style={{
                            borderColor: `${entry.color}66`,
                            color: entry.color,
                            backgroundColor: `${entry.color}14`,
                        }}
                    >
                        <EmojiValue value={entry.emoji} />
                        <span>{entry.label}</span>
                    </Badge>
                ) : null}
                <CardTitle className="text-xl break-words">
                    {entry.title}
                </CardTitle>
                {entry.description ? (
                    <p className="text-muted-foreground text-sm break-words">
                        {entry.description}
                    </p>
                ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid gap-3">
                    {getCalendarEntryTiles(
                        entry,
                        dictionary,
                        formatInstant
                    ).map((tile) => (
                        <InfoTile
                            key={tile.key}
                            label={tile.label}
                            value={tile.value}
                        />
                    ))}
                </div>
                <div className="flex flex-wrap gap-3">
                    {detailPath ? (
                        <Button asChild className="rounded-xl">
                            <Link href={detailPath}>
                                {dictionary.common.viewDetails}
                            </Link>
                        </Button>
                    ) : null}
                    {entry.kind === "event" &&
                    entry.event.kind === "match" &&
                    roster?.published ? (
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <Link
                                href={`/${locale}/dashboard/servers/${serverId}/rosters/${roster.id}`}
                            >
                                {dictionary.calendarCards.showRoster}
                            </Link>
                        </Button>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    )
}
