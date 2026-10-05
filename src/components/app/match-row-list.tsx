import { ChevronRight } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"

import type { MatchBadgeTone, MatchListRow } from "@/lib/match-list-rows"
import { cn } from "@/lib/utils"

const badgeTones: Record<MatchBadgeTone, string> = {
    info: "border-blue-200 bg-blue-50 text-blue-800 dark:border-blue-400/30 dark:bg-blue-400/10 dark:text-blue-200",
    attention:
        "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200",
    success:
        "border-green-200 bg-green-50 text-green-800 dark:border-green-400/30 dark:bg-green-400/10 dark:text-green-200",
    neutral: "border-border bg-muted/60 text-foreground/80",
}

const metricTones: Record<MatchListRow["metricTone"], string> = {
    strong: "text-sm font-semibold",
    default: "text-foreground/80 text-[13px]",
    muted: "text-muted-foreground text-[13px]",
}

/** A rounded list of event rows: date, title and details, count, phase. */
export function MatchRowList({
    rows,
    trailing,
}: {
    rows: MatchListRow[]
    /** Extra content after a row's link, such as a manager action. */
    trailing?: (row: MatchListRow) => ReactNode
}) {
    return (
        <ul className="divide-border/70 divide-y overflow-hidden rounded-[14px] border">
            {rows.map((row) => (
                <li key={row.id} className="flex items-center">
                    <Link
                        href={row.href}
                        className="hover:bg-muted/50 focus-visible:bg-muted/50 flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-3 px-4 py-3.5 transition-colors outline-none sm:px-[18px]"
                    >
                        <span className="flex w-14 shrink-0 flex-col items-center leading-[18px]">
                            <span className="text-muted-foreground text-xs whitespace-nowrap">
                                {row.date}
                            </span>
                            <span className="text-[15px] font-semibold tabular-nums">
                                {row.time}
                            </span>
                        </span>
                        <span className="flex min-w-0 flex-[1_1_13.75rem] flex-col leading-5">
                            <span className="text-sm font-semibold break-words">
                                {row.title}
                            </span>
                            {row.details ? (
                                <span className="text-muted-foreground text-[13px] break-words">
                                    {row.details}
                                </span>
                            ) : null}
                        </span>
                        {row.metric ? (
                            <span
                                className={cn(
                                    "shrink-0 tabular-nums",
                                    metricTones[row.metricTone]
                                )}
                            >
                                {row.metric}
                            </span>
                        ) : null}
                        <span
                            className={cn(
                                "inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium",
                                badgeTones[row.badge.tone]
                            )}
                        >
                            {row.badge.label}
                        </span>
                        <ChevronRight
                            className="text-muted-foreground/70 size-4 shrink-0"
                            aria-hidden="true"
                        />
                    </Link>
                    {trailing ? trailing(row) : null}
                </li>
            ))}
        </ul>
    )
}
