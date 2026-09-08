import { redirect } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import {
    getPublicCompetition,
    listCompetitionGuilds,
} from "@/lib/read-models/competitions"
import { CompetitionFixtureForm } from "@/components/app/competition-fixture-form"
import { MergeCompetitionClans } from "@/components/app/merge-competition-clans"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getCurrentPlayer, isCurrentUserSuperadmin } from "@/lib/auth"
import { SeedEclButton } from "@/components/app/seed-ecl-button"
import { PageHeader } from "@/components/app/page-header"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Competitions | Logi",
    description: "Global competition management.",
}

export default async function CompetitionsDashboard({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    if (!(await getCurrentPlayer()) || !(await isCurrentUserSuperadmin()))
        redirect(`/${safeLocale}/dashboard`)

    const [ecl, clans] = await Promise.all([
        getPublicCompetition("ecl-2026"),
        listCompetitionGuilds(),
    ])

    return (
        <div className="space-y-6">
            <PageHeader
                title={dictionary.competition.title}
                description={dictionary.competition.manageDescription}
                actions={
                    !ecl ? <SeedEclButton dictionary={dictionary} /> : undefined
                }
            />
            <div className={"space-y-6 px-4 lg:px-6"}>
                {ecl ? (
                    <Card>
                        <CardHeader>
                            <CardTitle>
                                {ecl.name} {ecl.season}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <CompetitionFixtureForm
                                competition={ecl}
                                dictionary={dictionary}
                            />
                            <section className="space-y-2">
                                <h2 className="font-medium">
                                    {dictionary.competition.mergeAliases}
                                </h2>
                                <p className="text-muted-foreground text-sm">
                                    {dictionary.competition.mergeDescription}
                                </p>
                                <MergeCompetitionClans
                                    clans={clans}
                                    dictionary={dictionary}
                                />
                            </section>
                            <Link
                                className="text-primary text-sm font-medium hover:underline"
                                href={`/${safeLocale}/competitions/${ecl.slug}`}
                            >
                                Open public standings →
                            </Link>
                        </CardContent>
                    </Card>
                ) : (
                    <Card>
                        <CardContent className="text-muted-foreground p-6 text-sm">
                            Create ECL 2026 to add its official divisions and
                            teams.
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    )
}
