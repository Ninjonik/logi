import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { HelperDataActions } from "@/components/app/helper-data-actions"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

export default async function SystemHelperDataPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    const { locale, serverId } = await params
    const dictionary = getDictionary(isLocale(locale) ? locale : "en")
    const context = await getServerContext(serverId)
    if (!context?.canAdmin) return null
    return (
        <>
            <PageHeader
                title={dictionary.clan.helperDataTitle}
                description={dictionary.clan.helperDataBody}
            />
            <div className="px-4 lg:px-6">
                <Card className="border-border/60 rounded-2xl">
                    <CardHeader>
                        <CardTitle>{dictionary.clan.helperDataTitle}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <HelperDataActions
                            serverId={serverId}
                            dictionary={dictionary}
                        />
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
