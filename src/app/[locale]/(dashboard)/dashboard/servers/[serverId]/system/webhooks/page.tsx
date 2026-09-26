import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WebhookManager } from "@/components/app/webhook-manager"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export default async function SystemWebhooksPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    const { locale, serverId } = await params
    const context = await getServerContext(serverId)
    if (!context?.canAdmin) return null
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    return (
        <>
            <PageHeader
                title={dictionary.clan.webhooksTitle}
                description={dictionary.clan.webhooksBody}
            />
            <div className="px-4 lg:px-6">
                <Card className="border-border/60 rounded-2xl">
                    <CardHeader>
                        <CardTitle>{dictionary.clan.webhookDelivery}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <WebhookManager
                            serverId={serverId}
                            dictionary={dictionary}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
