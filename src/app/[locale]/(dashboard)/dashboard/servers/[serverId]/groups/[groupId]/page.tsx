import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { ManagersOnlyState } from "@/components/app/managers-only-state"
import { PageHeader } from "@/components/app/page-header"
import { GroupForm } from "@/components/app/group-form"
import { GameBadge } from "@/components/app/game-badge"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Group",
    description: "Manage a server group.",
}

export function generateStaticParams() {
    return [{ groupId: "sample-group" }]
}

export default async function GroupDetailPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string; groupId: string }>
}) {
    const { locale, serverId, groupId } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId)
    if (!context) notFound()
    if (!context.canAdmin)
        return (
            <ManagersOnlyState
                dictionary={dictionary}
                overviewHref={`/${locale}/dashboard/servers/${serverId}`}
            />
        )

    const group = (context.groups ?? []).find((item) => item.id === groupId)
    if (!group) notFound()
    const usage = {
        primary: context.assignments.filter(
            (assignment) => assignment.primaryGroupId === group.id
        ).length,
        secondary: context.assignments.filter((assignment) =>
            (assignment.secondaryGroupIds ?? []).includes(group.id)
        ).length,
    }

    return (
        <>
            <PageHeader
                title={group.name}
                description={group.description}
                badges={
                    <GameBadge gameId={group.gameId} dictionary={dictionary} />
                }
            />
            <div className="px-4 lg:px-6">
                <GroupForm
                    serverId={serverId}
                    locale={locale}
                    dictionary={dictionary}
                    canEdit={context.canAdmin}
                    group={group}
                    gameId={group.gameId}
                    availableGroups={context.groups ?? []}
                    usage={usage}
                />
            </div>
        </>
    )
}
