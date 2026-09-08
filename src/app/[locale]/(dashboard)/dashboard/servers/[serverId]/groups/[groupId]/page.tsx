import type { Metadata } from "next"

import { PageHeader } from "@/components/app/page-header"
import { getGroupMetadata } from "@/lib/server-metadata"
import { GroupForm } from "@/components/app/group-form"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Group | Logi",
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
    if (!context?.canAdmin) return null

    const group = (context.groups ?? []).find((item) => item.id === groupId)
    if (!group) return null

    return (
        <>
            <PageHeader title={group.name} description={group.description} />
            <div className="px-4 lg:px-6">
                <GroupForm
                    serverId={serverId}
                    locale={locale}
                    dictionary={dictionary}
                    canEdit={context.canAdmin}
                    group={group}
                    availableGroups={context.groups ?? []}
                />
            </div>
        </>
    )
}
