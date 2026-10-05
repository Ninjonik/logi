import { notFound, redirect } from "next/navigation"
import type { Metadata } from "next"

import {
    competitionAdminAccess,
    getCompetitionForAdmin,
} from "@/lib/gateways/competition-admin"
import { CompetitionAdminHeader } from "@/components/app/competition-admin-header"
import { CompetitionManager } from "@/components/app/competition-manager"
import { getCurrentPlayer, isCurrentUserSuperadmin } from "@/lib/auth"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

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
    if (!(await getCurrentPlayer()) || !(await isCurrentUserSuperadmin()))
        redirect(`/${safeLocale}/dashboard`)
    const access = await competitionAdminAccess()
    if (!access) redirect(`/${safeLocale}/dashboard`)
    const view = await getCompetitionForAdmin(access, competitionId)
    if (!view) notFound()
    const query = workspace ? `?workspace=${encodeURIComponent(workspace)}` : ""

    return (
        <div className="flex flex-col gap-5 px-4 lg:px-6">
            <CompetitionAdminHeader
                view={view}
                dictionary={dictionary}
                locale={safeLocale}
                listHref={`/${safeLocale}/dashboard/competitions${query}`}
            />
            <CompetitionManager
                view={view}
                dictionary={dictionary}
                locale={safeLocale}
            />
        </div>
    )
}
