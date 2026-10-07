"use client"

import {
    addMonths,
    eachDayOfInterval,
    endOfMonth,
    endOfWeek,
    isSameMonth,
    startOfMonth,
    startOfWeek,
    subMonths,
} from "date-fns"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useMemo, useState } from "react"

import {
    getGridDayKey,
    getMonthLabel,
    getWeekdayLabels,
} from "@/domain/calendar/calendar-display"
import { CalendarEntryDialog } from "@/components/app/calendar-entry-dialog"
import type { CalendarDisplayEntry } from "@/lib/calendar-entries"
import { EmojiValue } from "@/components/app/emoji-value"
import { Card, CardContent } from "@/components/ui/card"
import { formatDateKey, formatTime } from "@/lib/format"
import type { Dictionary } from "@/i18n/dictionaries"
import { toIntlLocale } from "@/lib/intl-locale"
import { Button } from "@/components/ui/button"
import type { Group } from "@/types/domain"
import type { Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"

function dayKeyOf(day: Date) {
    return getGridDayKey({
        year: day.getFullYear(),
        monthIndex: day.getMonth(),
        date: day.getDate(),
    })
}

export function MonthCalendarView({
    locale,
    serverId,
    entries,
    groups,
    timezone,
    dictionary,
    signupLanguage,
    currentUserId,
    canAdmin,
}: {
    locale: Locale
    serverId: string
    entries: CalendarDisplayEntry[]
    groups: Group[]
    timezone?: string
    dictionary: Dictionary
    signupLanguage: "en" | "cs" | "de"
    currentUserId?: string
    canAdmin?: boolean
}) {
    const [currentMonth, setCurrentMonth] = useState(() =>
        startOfMonth(new Date())
    )
    const intlLocale = toIntlLocale(locale)
    const weekdays = useMemo(() => getWeekdayLabels(intlLocale), [intlLocale])
    const todayKey = formatDateKey(new Date().toISOString(), timezone)

    const monthDays = useMemo(() => {
        const start = startOfWeek(startOfMonth(currentMonth), {
            weekStartsOn: 1,
        })
        const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 })
        return eachDayOfInterval({ start, end })
    }, [currentMonth])

    // Entries are grouped by their day in the clan time zone; grid cells are
    // plain calendar dates, so both sides compare as yyyy-mm-dd keys.
    const entriesByDate = useMemo(() => {
        const grouped = new Map<string, CalendarDisplayEntry[]>()
        for (const entry of entries) {
            const key = formatDateKey(entry.startAt, timezone)
            grouped.set(key, [...(grouped.get(key) ?? []), entry])
        }
        return grouped
    }, [entries, timezone])

    const agendaDays = monthDays.filter(
        (day) =>
            isSameMonth(day, currentMonth) &&
            (entriesByDate.get(dayKeyOf(day))?.length ?? 0) > 0
    )
    const agendaDayFormatter = new Intl.DateTimeFormat(intlLocale, {
        weekday: "short",
        day: "numeric",
        month: "numeric",
    })

    function renderEntry(entry: CalendarDisplayEntry) {
        return (
            <CalendarEntryDialog
                key={entry.id}
                locale={locale}
                serverId={serverId}
                entry={entry}
                groups={groups}
                timezone={timezone}
                dictionary={dictionary}
                signupLanguage={signupLanguage}
                currentUserId={currentUserId}
                canAdmin={canAdmin}
                trigger={
                    <button
                        type="button"
                        className="bg-card hover:bg-primary/5 focus-visible:ring-ring block w-full min-w-0 rounded-xl border px-2.5 py-2 text-left transition focus-visible:ring-2 focus-visible:outline-none"
                        style={{
                            borderColor: `${entry.color}66`,
                            boxShadow: `inset 3px 0 0 ${entry.color}`,
                        }}
                    >
                        <div className="truncate text-xs font-semibold">
                            <span className="inline-flex max-w-full items-center gap-1.5">
                                <EmojiValue value={entry.emoji} />
                                <span className="truncate">{entry.title}</span>
                            </span>
                        </div>
                        <div className="text-muted-foreground mt-1 truncate text-[11px]">
                            {entry.allDay
                                ? dictionary.calendarPage.allDay
                                : formatTime(
                                      entry.startAt,
                                      timezone,
                                      intlLocale
                                  )}
                            {entry.label ? ` • ${entry.label}` : ""}
                        </div>
                    </button>
                }
            />
        )
    }

    return (
        <Card className="border-border/60 overflow-hidden rounded-2xl">
            <div className="border-border/60 flex items-center justify-between gap-3 border-b px-4 py-4">
                <div className="min-w-0">
                    <h2
                        className="text-xl font-semibold first-letter:uppercase"
                        aria-live="polite"
                    >
                        {getMonthLabel(
                            {
                                year: currentMonth.getFullYear(),
                                monthIndex: currentMonth.getMonth(),
                            },
                            intlLocale
                        )}
                    </h2>
                    <div className="text-muted-foreground text-sm">
                        {dictionary.calendarPage.monthView}
                    </div>
                </div>
                <div className="flex shrink-0 gap-2">
                    <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl"
                        aria-label={dictionary.calendarPage.previousMonth}
                        onClick={() =>
                            setCurrentMonth((value) => subMonths(value, 1))
                        }
                    >
                        <ChevronLeft className="size-4" />
                    </Button>
                    <Button
                        variant="outline"
                        className="rounded-xl"
                        onClick={() =>
                            setCurrentMonth(startOfMonth(new Date()))
                        }
                    >
                        {dictionary.common.today}
                    </Button>
                    <Button
                        variant="outline"
                        size="icon"
                        className="rounded-xl"
                        aria-label={dictionary.calendarPage.nextMonth}
                        onClick={() =>
                            setCurrentMonth((value) => addMonths(value, 1))
                        }
                    >
                        <ChevronRight className="size-4" />
                    </Button>
                </div>
            </div>
            <CardContent className="p-0">
                {/* Phones: the month as a list of days that have something on. */}
                <div className="md:hidden">
                    {agendaDays.length ? (
                        <ol className="divide-border/60 divide-y">
                            {agendaDays.map((day) => {
                                const key = dayKeyOf(day)
                                return (
                                    <li
                                        key={key}
                                        className={cn(
                                            "grid grid-cols-[4.5rem_minmax(0,1fr)] gap-3 px-4 py-3",
                                            key === todayKey && "bg-primary/5"
                                        )}
                                    >
                                        <span
                                            className={cn(
                                                "pt-2 text-sm font-medium",
                                                key === todayKey &&
                                                    "text-primary"
                                            )}
                                        >
                                            {agendaDayFormatter.format(day)}
                                        </span>
                                        <div className="min-w-0 space-y-2">
                                            {(entriesByDate.get(key) ?? []).map(
                                                renderEntry
                                            )}
                                        </div>
                                    </li>
                                )
                            })}
                        </ol>
                    ) : (
                        <p className="text-muted-foreground px-4 py-8 text-center text-sm">
                            {dictionary.calendarPage.emptyMonth}
                        </p>
                    )}
                </div>
                <div className="hidden md:block">
                    <div className="border-border/60 grid grid-cols-7 border-b">
                        {weekdays.map((day) => (
                            <div
                                key={day}
                                className="border-border/60 text-muted-foreground border-r px-3 py-3 text-xs font-semibold tracking-[0.18em] uppercase last:border-r-0"
                            >
                                {day}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7">
                        {monthDays.map((day) => {
                            const key = dayKeyOf(day)
                            const dayEntries = entriesByDate.get(key) ?? []
                            const isToday = key === todayKey
                            const inMonth = isSameMonth(day, currentMonth)

                            return (
                                <div
                                    key={key}
                                    className={cn(
                                        "border-border/60 min-h-44 min-w-0 border-r border-b p-2 [&:nth-child(7n)]:border-r-0",
                                        !inMonth && "bg-muted/20",
                                        isToday && "bg-primary/5"
                                    )}
                                >
                                    <div className="mb-2 flex items-center justify-between">
                                        <span
                                            className={cn(
                                                "inline-flex size-8 items-center justify-center rounded-full text-sm",
                                                isToday &&
                                                    "bg-primary text-primary-foreground",
                                                !inMonth &&
                                                    "text-muted-foreground"
                                            )}
                                        >
                                            {day.getDate()}
                                        </span>
                                        {dayEntries.length ? (
                                            <span className="bg-primary/10 text-primary rounded-full px-2 py-0.5 text-[11px] font-medium">
                                                {dayEntries.length}
                                            </span>
                                        ) : null}
                                    </div>
                                    <div className="space-y-2">
                                        {dayEntries
                                            .slice(0, 4)
                                            .map(renderEntry)}
                                        {dayEntries.length > 4 ? (
                                            <div className="text-muted-foreground px-1 text-[11px]">
                                                +{dayEntries.length - 4}{" "}
                                                {
                                                    dictionary.calendarPage
                                                        .moreEvents
                                                }
                                            </div>
                                        ) : null}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}
