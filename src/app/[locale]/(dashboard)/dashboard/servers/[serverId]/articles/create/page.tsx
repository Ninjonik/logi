import { ManagersOnlyState } from "@/components/app/managers-only-state"
import { ArticleForm } from "@/components/app/article-form"
import { PageHeader } from "@/components/app/page-header"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { notFound } from "next/navigation"
import { isLocale } from "@/i18n/config"
export default async function CreateArticlePage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    const { locale, serverId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(serverId)
    if (!context) notFound()
    return (
        <>
            <PageHeader
                title={dictionary.articles.createTitle}
                description={dictionary.articles.createDescription}
            />
            {context.canAdmin ? (
                <div className="px-4 lg:px-6">
                    <ArticleForm
                        serverId={serverId}
                        locale={safeLocale}
                        dictionary={dictionary}
                    />
                </div>
            ) : (
                <ManagersOnlyState
                    dictionary={dictionary}
                    overviewHref={`/${safeLocale}/dashboard/servers/${serverId}`}
                />
            )}
        </>
    )
}
