import { Trophy } from "lucide-react"
import Link from "next/link"

import { fill } from "@/components/app/clan-overview/overview-format"
import type { recentForm } from "@/domain/workspaces/clan-overview"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

const tones = {
    victory:
        "bg-emerald-500/15 text-emerald-800 dark:text-emerald-200 border-emerald-600/60",
    defeat: "bg-muted text-muted-foreground border-border",
    draw: "bg-muted text-muted-foreground border-border",
} as const

/** Outcomes of the clan's last ten matches, oldest first (design G1). */
export function RecentFormCard({
    form,
    matchHref,
    dictionary,
}: {
    form: ReturnType<typeof recentForm>
    matchHref: (eventId: string) => string
    dictionary: Dictionary
}) {
    const text = dictionary.clanOverview
    if (!form.matches.length)
        return (
            <EmptyState
                icon={Trophy}
                title={text.formEmptyTitle}
                description={text.formEmptyDescription}
                className="flex-[1_1_360px]"
            />
        )
    const hasPending = form.matches.some((match) => match.pending)
    return (
        <section
            aria-labelledby="overview-form"
            className="bg-card flex min-w-0 flex-[1_1_360px] flex-col gap-3.5 rounded-2xl border p-5 sm:p-6"
        >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2
                    id="overview-form"
                    className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                >
                    {text.formTitle}
                </h2>
                <span className="text-sm font-semibold">
                    {fill(text.wins, { count: form.wins })}
                </span>
            </div>
            <ol
                aria-label={text.formListLabel}
                className="flex flex-wrap gap-1.5"
            >
                {form.matches.map((match) => {
                    const outcome = text.outcomes[match.outcome]
                    const label = match.pending
                        ? fill(text.outcomePending, { outcome })
                        : outcome
                    return (
                        <li key={match.eventId}>
                            <Link
                                href={matchHref(match.eventId)}
                                title={`${match.name} · ${label}`}
                                aria-label={`${match.name}: ${label}`}
                                className={cn(
                                    "focus-visible:ring-ring/50 flex size-8 items-center justify-center rounded-lg border text-[13px] font-bold outline-none focus-visible:ring-[3px]",
                                    tones[match.outcome],
                                    match.pending
                                        ? "bg-card border-dashed"
                                        : "border-transparent"
                                )}
                            >
                                {text.outcomeLetters[match.outcome]}
                            </Link>
                        </li>
                    )
                })}
            </ol>
            <p className="text-muted-foreground text-xs">
                {hasPending ? `${text.formPendingLegend} ` : null}
                {text.formLegend}
            </p>
        </section>
    )
}
