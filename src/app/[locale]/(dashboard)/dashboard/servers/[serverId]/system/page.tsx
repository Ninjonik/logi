import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ApiKeyManager } from "@/components/app/api-key-manager"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export default async function SystemPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    const { locale, serverId } = await params
    const context = await getServerContext(serverId)
    if (!context?.canAdmin) return null
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const base = `/${locale}/dashboard/servers/${serverId}/system`
    return (
        <>
            <PageHeader
                title={dictionary.clan.systemTitle}
                description={dictionary.clan.systemBody}
            />
            <div className="space-y-6 px-4 lg:px-6">
                <Card className="border-border/60 rounded-2xl">
                    <CardHeader>
                        <CardTitle>{dictionary.clan.websiteApi}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ApiKeyManager serverId={serverId} />
                    </CardContent>
                </Card>
                <div className="grid gap-4 md:grid-cols-3">
                    <Link
                        href={`${base}/imports`}
                        className="hover:bg-muted/40 rounded-2xl border p-5"
                    >
                        {dictionary.clan.importsTitle}
                    </Link>
                    <Link
                        href={`${base}/helper-data`}
                        className="hover:bg-muted/40 rounded-2xl border p-5"
                    >
                        {dictionary.clan.helperDataTitle}
                    </Link>
                    <Link
                        href={`${base}/webhooks`}
                        className="hover:bg-muted/40 rounded-2xl border p-5"
                    >
                        {dictionary.clan.webhooksTitle}
                    </Link>
                </div>
            </div>
        </>
    )
}
