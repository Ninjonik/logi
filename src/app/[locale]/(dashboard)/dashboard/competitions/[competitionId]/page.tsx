import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import {
    competitionAdminAccess,
    getCompetitionForAdmin,
} from "@/lib/gateways/competition-admin"
import { CompetitionManager } from "@/components/app/competition-manager"
import { getCurrentPlayer, isCurrentUserSuperadmin } from "@/lib/auth"
import { PageHeader } from "@/components/app/page-header"
import { GameBadge } from "@/components/app/game-badge"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isLocale } from "@/i18n/config"
import { ArrowLeft } from "lucide-react"

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

    return (
        <div className="space-y-6">
            <PageHeader
                title={`${view.competition.name} ${view.competition.season}`}
                description={view.competition.description ?? undefined}
                badge={
                    view.competition.published ? t.publishedBadge : t.draftBadge
                }
                badges={
                    <GameBadge
                        gameId={view.competition.gameId}
                        dictionary={dictionary}
                    />
                }
                actions={
                    <Button asChild variant="outline">
                        <Link
                            href={`/${safeLocale}/dashboard/competitions${query}`}
                        >
                            <ArrowLeft className="size-4" aria-hidden />
                            {t.back}
                        </Link>
                    </Button>
                }
            />
            <div className="px-4 lg:px-6">
                <CompetitionManager
                    view={view}
                    dictionary={dictionary}
                    locale={safeLocale}
                />
            </div>
        </div>
    )
}
