import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { TeamRequestQueue } from "@/components/app/team-request-queue"
import { getCurrentPlayer, isCurrentUserSuperadmin } from "@/lib/auth"
import { PageHeader } from "@/components/app/page-header"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Team requests",
    description: "Global moderation queue for team requests.",
}

export default async function TeamRequestsPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    if (!(await getCurrentPlayer()) || !(await isCurrentUserSuperadmin()))
        redirect(`/${safeLocale}/dashboard`)
    const dictionary = getDictionary(safeLocale)

    return (
        <>
            <PageHeader
                title={dictionary.teamRequestAdmin.title}
                description={dictionary.teamRequestAdmin.description}
            />
            <div className="px-4 lg:px-6">
                <TeamRequestQueue
                    labels={{
                        requests: dictionary.teamRequestAdmin,
                        catalog: dictionary.teamCatalogAdmin,
                    }}
                    locale={safeLocale}
                    allGamesLabel={dictionary.games.all}
                />
            </div>
        </>
    )
}
