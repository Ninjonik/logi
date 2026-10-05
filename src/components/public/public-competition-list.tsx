import { ChevronRight, Trophy } from "lucide-react"
import Link from "next/link"

import {
    CompetitionMark,
    competitionSummary,
} from "@/components/public/public-competition-view"
import type { PublicCompetition } from "@/domain/competitions/competition"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import type { Locale } from "@/i18n/config"

/** Published competitions as cards in the competition page's visual language. */
export function PublicCompetitionList({
    competitions,
    locale,
    dictionary,
}: {
    competitions: PublicCompetition[]
    locale: Locale
    dictionary: Dictionary
}) {
    const labels = dictionary.competition
    return (
        <div className="flex flex-col gap-7">
            <header className="flex flex-col gap-1.5">
                <h1 className="text-3xl leading-9 font-bold">{labels.title}</h1>
                <p className="text-muted-foreground max-w-[60ch] text-[15px] leading-[22px]">
                    {labels.description}
                </p>
            </header>
            {competitions.length ? (
                <ul className="grid gap-3 md:grid-cols-2">
                    {competitions.map((competition) => (
                        <li key={competition.id}>
                            <Link
                                href={`/${locale}/competitions/${competition.slug}`}
                                className="hover:bg-muted/50 flex items-center gap-4 rounded-[14px] border p-4 transition-colors"
                            >
                                <CompetitionMark
                                    competition={competition}
                                    className="size-14 rounded-xl text-base"
                                />
                                <span className="flex min-w-0 flex-1 flex-col gap-1">
                                    <span className="text-base font-semibold break-words">
                                        {competition.name} {competition.season}
                                    </span>
                                    <span className="text-muted-foreground text-sm">
                                        {competitionSummary(
                                            competition,
                                            locale,
                                            dictionary
                                        )}
                                    </span>
                                </span>
                                <ChevronRight
                                    aria-hidden="true"
                                    className="text-muted-foreground size-4 shrink-0"
                                />
                            </Link>
                        </li>
                    ))}
                </ul>
            ) : (
                <EmptyState
                    icon={Trophy}
                    title={dictionary.publicSite.competition.emptyTitle}
                    description={
                        dictionary.publicSite.competition.emptyDescription
                    }
                />
            )}
        </div>
    )
}
