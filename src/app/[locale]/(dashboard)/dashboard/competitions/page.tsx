import { redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import {
    competitionAdminAccess,
    listCompetitionsForAdmin,
} from "@/lib/gateways/competition-admin"
import { CompetitionCreateDialog } from "@/components/app/competition-create-dialog"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentPlayer, isCurrentUserSuperadmin } from "@/lib/auth"
import { AdminPageHeader } from "@/components/app/admin-page-header"
import { ConfigNotice } from "@/components/app/config-notice"
import { EmptyState } from "@/components/app/empty-state"
import { GameBadge } from "@/components/app/game-badge"
import { getDictionary } from "@/i18n/dictionaries"
import { GAME_LABELS } from "@/domain/games/game"
import { Badge } from "@/components/ui/badge"
import { pluralize } from "@/i18n/plural"
import { isLocale } from "@/i18n/config"
import { Trophy } from "lucide-react"

export const metadata: Metadata = {
    title: "Competitions",
    description: "Global competition management.",
}

export default async function CompetitionsDashboard({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ workspace?: string }>
}) {
    const { locale } = await params
    const { workspace } = await searchParams
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const t = dictionary.competitionAdmin
    if (!(await getCurrentPlayer()) || !(await isCurrentUserSuperadmin()))
        redirect(`/${safeLocale}/dashboard`)
    const access = await competitionAdminAccess()
    if (!access) redirect(`/${safeLocale}/dashboard`)

    const competitions = await listCompetitionsForAdmin(access)
    const query = workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""
    const manage = (id: string) =>
        `/${safeLocale}/dashboard/competitions/${encodeURIComponent(id)}${query}`
    const legacyRows = competitions.reduce(
        (total, competition) => total + competition.legacyRows,
        0
    )

    return (
        <div className="space-y-6">
            <AdminPageHeader
                eyebrow={dictionary.sidebar.adminNav.title}
                title={dictionary.competition.title}
                description={t.listDescription}
                actions={
                    <CompetitionCreateDialog
                        dictionary={dictionary}
                        managePath={`/${safeLocale}/dashboard/competitions/{id}${query}`}
                    />
                }
            />
            <div className="space-y-4 px-4 lg:px-6">
                {legacyRows ? (
                    <ConfigNotice title={t.legacyTitle}>
                        {t.legacyDescription.replace(
                            "{count}",
                            String(legacyRows)
                        )}
                    </ConfigNotice>
                ) : null}
                {competitions.length ? (
                    <div className="grid gap-4 md:grid-cols-2">
                        {competitions.map((competition) => (
                            <Card key={competition.id}>
                                <CardHeader className="space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <GameBadge
                                            gameId={competition.gameId}
                                            dictionary={dictionary}
                                        />
                                        <CardTitle className="text-base">
                                            {competition.name}{" "}
                                            <span className="text-muted-foreground font-normal">
                                                {competition.season}
                                            </span>
                                        </CardTitle>
                                        <Badge
                                            variant={
                                                competition.published
                                                    ? "default"
                                                    : "secondary"
                                            }
                                        >
                                            {competition.published
                                                ? t.publishedBadge
                                                : t.draftBadge}
                                        </Badge>
                                    </div>
                                    <p className="text-muted-foreground text-sm">
                                        {[
                                            GAME_LABELS[competition.gameId],
                                            pluralize(
                                                safeLocale,
                                                competition.divisions,
                                                t.countDivisions
                                            ),
                                            pluralize(
                                                safeLocale,
                                                competition.registrations,
                                                t.countTeams
                                            ),
                                            pluralize(
                                                safeLocale,
                                                competition.fixtures,
                                                t.countFixtures
                                            ),
                                        ].join(" · ")}
                                    </p>
                                </CardHeader>
                                <CardContent className="flex flex-wrap items-center gap-4 text-sm">
                                    <Link
                                        className="text-primary font-medium hover:underline"
                                        href={manage(competition.id)}
                                    >
                                        {t.manage} →
                                    </Link>
                                    {competition.published ? (
                                        <Link
                                            className="text-muted-foreground hover:text-foreground"
                                            href={`/${safeLocale}/competitions/${competition.slug}`}
                                        >
                                            {t.openPublic}
                                        </Link>
                                    ) : null}
                                    {competition.legacyRows ? (
                                        <Badge variant="outline">
                                            {t.legacyBadge}
                                        </Badge>
                                    ) : null}
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                ) : (
                    <EmptyState
                        icon={Trophy}
                        title={t.noCompetitions}
                        description={t.listDescription}
                    />
                )}
            </div>
        </div>
    )
}
