import Link from "next/link"

import type { OverviewFormat } from "@/components/app/clan-overview/overview-format"
import type { Dictionary } from "@/i18n/dictionaries"
import type { EventRecord } from "@/types/domain"
import { cn } from "@/lib/utils"

/** Today and the six days after it, with each day's matches and trainings. */
export function WeekStrip({
    days,
    todayKey,
    eventHref,
    format,
    dictionary,
}: {
    days: Array<{ key: string; events: EventRecord[] }>
    todayKey: string
    eventHref: (event: EventRecord) => string
    format: OverviewFormat
    dictionary: Dictionary
}) {
    const text = dictionary.clanOverview
    return (
        <section aria-labelledby="overview-week" className="space-y-2.5">
            <h2
                id="overview-week"
                className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
            >
                {text.weekTitle}
            </h2>
            <ol className="grid grid-cols-[repeat(auto-fit,minmax(min(7.5rem,100%),1fr))] gap-2">
                {days.map((day) => {
                    const isToday = day.key === todayKey
                    return (
                        <li
                            key={day.key}
                            aria-current={isToday ? "date" : undefined}
                            className={cn(
                                "flex min-h-16 min-w-0 flex-col gap-1.5 rounded-xl border p-2.5 sm:min-h-24",
                                isToday && "border-foreground bg-muted/40"
                            )}
                        >
                            <span
                                className={cn(
                                    "text-xs",
                                    isToday
                                        ? "font-semibold"
                                        : "text-muted-foreground font-medium"
                                )}
                            >
                                {format.dayCell(day.key)}
                                {isToday ? ` · ${text.todayLabel}` : null}
                            </span>
                            {day.events.map((event) => (
                                <Link
                                    key={event.id}
                                    href={eventHref(event)}
                                    className={cn(
                                        "focus-visible:ring-ring/50 block rounded-lg px-2 py-1.5 text-xs leading-4 break-words outline-none hover:underline focus-visible:ring-[3px]",
                                        event.kind === "training"
                                            ? "bg-sky-500/10 text-sky-950 dark:text-sky-100"
                                            : "bg-amber-500/15 text-amber-950 dark:text-amber-100"
                                    )}
                                >
                                    <span className="tabular-nums">
                                        {format.time(event.gameStart)}
                                    </span>{" "}
                                    {event.name}
                                </Link>
                            ))}
                        </li>
                    )
                })}
            </ol>
        </section>
    )
}
