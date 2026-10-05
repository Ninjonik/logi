import Link from "next/link"

import type { CompetitionAdminView } from "@/domain/competitions/admin-view"
import { adminTone } from "@/components/app/admin-page-header"
import { ChevronRight, ExternalLink } from "lucide-react"
import type { Dictionary } from "@/i18n/dictionaries"
import { teamInitials } from "@/domain/teams/team"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"

/**
 * Head of one competition's management (design I3): breadcrumb back to the
 * competitions, the competition's mark, name, visibility, game and counts,
 * and its public page.
 */
export function CompetitionAdminHeader({
    view,
    dictionary,
    locale,
    listHref,
}: {
    view: CompetitionAdminView
    dictionary: Dictionary
    locale: string
    listHref: string
}) {
    const t = dictionary.competitionAdmin
    const { competition } = view
    const title = `${competition.name} ${competition.season}`.trim()
    return (
        <>
            <nav
                aria-label={t.breadcrumb}
                className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
            >
                <Link href={listHref} className="hover:text-foreground">
                    {dictionary.sidebar.competitions}
                </Link>
                <ChevronRight className="size-3.5" aria-hidden />
                <span aria-current="page" className="text-foreground">
                    {title}
                </span>
            </nav>
            <header className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex min-w-0 items-center gap-3.5">
                    <span
                        aria-hidden
                        className="flex size-[52px] shrink-0 items-center justify-center rounded-xl bg-indigo-950 text-[13px] font-bold text-indigo-100 dark:bg-indigo-400/20"
                    >
                        {teamInitials(
                            competition.name,
                            // A short one-word name ("ECL") is its own mark.
                            /^\S{1,4}$/.test(competition.name)
                                ? competition.name
                                : null
                        ) || "?"}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                        <h1 className="text-2xl leading-[30px] font-semibold tracking-tight">
                            {title}
                        </h1>
                        <div className="text-foreground/80 flex flex-wrap items-center gap-2 text-[13px]">
                            <span
                                className={cn(
                                    "inline-flex h-[22px] items-center rounded-md border px-2 font-medium",
                                    competition.published
                                        ? adminTone.success
                                        : adminTone.neutral
                                )}
                            >
                                {competition.published
                                    ? t.publishedBadge
                                    : t.draftBadge}
                            </span>
                            <span>
                                {[
                                    GAME_LABELS[competition.gameId],
                                    pluralize(
                                        locale,
                                        view.divisions.length,
                                        t.countDivisions
                                    ),
                                    pluralize(
                                        locale,
                                        view.registrations.length,
                                        t.countTeams
                                    ),
                                ].join(" · ")}
                            </span>
                        </div>
                    </div>
                </div>
                {competition.published ? (
                    <Button asChild variant="outline">
                        <Link
                            href={`/${locale}/competitions/${competition.slug}`}
                            target="_blank"
                        >
                            {t.openPublic}
                            <ExternalLink className="size-3.5" aria-hidden />
                        </Link>
                    </Button>
                ) : null}
            </header>
        </>
    )
}
