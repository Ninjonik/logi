import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import {
    competitionAdminAccess,
    getCompetitionForAdmin,
} from "@/lib/gateways/competition-admin"
import { CompetitionManager } from "@/components/app/competition-manager"
import { getCurrentPlayer, isCurrentUserSuperadmin } from "@/lib/auth"
import { adminTone } from "@/components/app/admin-page-header"
import { ChevronRight, ExternalLink } from "lucide-react"
import { getDictionary } from "@/i18n/dictionaries"
import { teamInitials } from "@/domain/teams/team"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/i18n/plural"
import { isLocale } from "@/i18n/config"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
    title: "Manage competition",
    description: "Global competition management.",
}

export default async function CompetitionManagementPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; competitionId: string }>
    searchParams: Promise<{ workspace?: string }>
}) {
    const { locale, competitionId } = await params
    const { workspace } = await searchParams
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const t = dictionary.competitionAdmin
    if (!(await getCurrentPlayer()) || !(await isCurrentUserSuperadmin()))
        redirect(`/${safeLocale}/dashboard`)
    const access = await competitionAdminAccess()
    if (!access) redirect(`/${safeLocale}/dashboard`)
    const view = await getCompetitionForAdmin(access, competitionId)
    if (!view) notFound()
    const query = workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""
    const title = `${view.competition.name} ${view.competition.season}`.trim()

    return (
        <div className="flex flex-col gap-5 px-4 lg:px-6">
            <nav
                aria-label={t.breadcrumb}
                className="text-muted-foreground flex flex-wrap items-center gap-1.5 text-sm"
            >
                <Link
                    href={`/${safeLocale}/dashboard/competitions${query}`}
                    className="hover:text-foreground"
                >
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
                        {teamInitials(view.competition.name, null) || "?"}
                    </span>
                    <div className="flex min-w-0 flex-col gap-1">
                        <h1 className="text-2xl leading-[30px] font-semibold tracking-tight">
                            {title}
                        </h1>
                        <div className="text-foreground/80 flex flex-wrap items-center gap-2 text-[13px]">
                            <span
                                className={cn(
                                    "inline-flex h-[22px] items-center rounded-md border px-2 font-medium",
                                    view.competition.published
                                        ? adminTone.success
                                        : adminTone.neutral
                                )}
                            >
                                {view.competition.published
                                    ? t.publishedBadge
                                    : t.draftBadge}
                            </span>
                            <span>
                                {[
                                    GAME_LABELS[view.competition.gameId],
                                    pluralize(
                                        safeLocale,
                                        view.divisions.length,
                                        t.countDivisions
                                    ),
                                    pluralize(
                                        safeLocale,
                                        view.registrations.length,
                                        t.countTeams
                                    ),
                                ].join(" · ")}
                            </span>
                        </div>
                    </div>
                </div>
                {view.competition.published ? (
                    <Button asChild variant="outline">
                        <Link
                            href={`/${safeLocale}/competitions/${view.competition.slug}`}
                            target="_blank"
                        >
                            {t.openPublic}
                            <ExternalLink className="size-3.5" aria-hidden />
                        </Link>
                    </Button>
                ) : null}
            </header>
            <CompetitionManager
                view={view}
                dictionary={dictionary}
                locale={safeLocale}
            />
        </div>
    )
}
