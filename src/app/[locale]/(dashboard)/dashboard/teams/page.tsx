import { redirect } from "next/navigation"
import type { Metadata } from "next"

import {
    getCurrentPlayer,
    getVisibleGuildsForLoggedInUser,
    isCurrentUserSuperadmin,
} from "@/lib/auth"
import { TeamCatalogueAdmin } from "@/components/app/team-catalogue-admin"
import { linkableWorkspaces } from "@/lib/teams-admin/team-admin-list"
import { TEAM_GAMES, teamGameSchema } from "@/domain/teams/team"
import { PageHeader } from "@/components/app/page-header"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Team catalogue | Logi",
    description: "Global team catalogue administration.",
}

export default async function TeamCataloguePage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string }>
    searchParams: Promise<{ game?: string | string[] }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    if (!(await getCurrentPlayer()) || !(await isCurrentUserSuperadmin()))
        redirect(`/${safeLocale}/dashboard`)
    const { game } = await searchParams
    const selected = teamGameSchema.safeParse(game)
    const dictionary = getDictionary(safeLocale)
    // Every workspace the global administrator can see may be linked to a team.
    const workspaces = linkableWorkspaces(
        await getVisibleGuildsForLoggedInUser()
    )

    return (
        <>
            <PageHeader
                title={dictionary.teamCatalogAdmin.title}
                description={dictionary.teamCatalogAdmin.description}
            />
            <div className="px-4 lg:px-6">
                <TeamCatalogueAdmin
                    labels={dictionary.teamCatalogAdmin}
                    workspaces={workspaces}
                    initialGame={
                        selected.success ? selected.data : TEAM_GAMES[0]
                    }
                />
            </div>
        </>
    )
}
