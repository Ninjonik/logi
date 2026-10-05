import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PageHeader } from "@/components/app/page-header"
import { EmptyState } from "@/components/app/empty-state"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { toIntlLocale } from "@/lib/intl-locale"
import { Button } from "@/components/ui/button"
import { listArticles } from "@/lib/articles"
import { notFound } from "next/navigation"
import { formatDate } from "@/lib/format"
import { isLocale } from "@/i18n/config"
import { Newspaper } from "lucide-react"
import Link from "next/link"
export default async function ArticlesPage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string }>
}) {
    const { locale, serverId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(serverId)
    if (!context) notFound()
    const articles = await listArticles(serverId)
    const createHref = `/${safeLocale}/dashboard/servers/${serverId}/articles/create`
    const timezone = context.discordConfig?.timezone
    return (
        <>
            <PageHeader
                title={dictionary.articles.title}
                description={dictionary.articles.description}
                actions={
                    context.canAdmin && articles.length ? (
                        <Button asChild className="rounded-xl">
                            <Link href={createHref}>
                                {dictionary.articles.create}
                            </Link>
                        </Button>
                    ) : undefined
                }
            />
            <div className="space-y-4 px-4 lg:px-6">
                {articles.map((article) => (
                    <Card key={article.id} className="rounded-2xl">
                        <CardHeader>
                            <CardTitle className="break-words">
                                <Link
                                    href={`/${safeLocale}/dashboard/servers/${serverId}/articles/${article.id}`}
                                    className="hover:underline"
                                >
                                    {article.title}
                                </Link>
                            </CardTitle>
                            <p className="text-muted-foreground text-sm break-words">
                                {article.description}
                            </p>
                        </CardHeader>
                        <CardContent className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-xs">
                            {article.createdAt ? (
                                <time dateTime={article.createdAt}>
                                    {dictionary.articles.publishedOn.replace(
                                        "{date}",
                                        formatDate(
                                            article.createdAt,
                                            timezone,
                                            toIntlLocale(safeLocale)
                                        )
                                    )}
                                </time>
                            ) : null}
                            {article.tags.map((tag) => (
                                <span key={tag}>#{tag}</span>
                            ))}
                        </CardContent>
                    </Card>
                ))}
                {!articles.length ? (
                    <EmptyState
                        icon={Newspaper}
                        title={dictionary.articles.emptyTitle}
                        description={
                            context.canAdmin
                                ? dictionary.articles.emptyDescription
                                : dictionary.articles.emptyMemberDescription
                        }
                        actions={
                            context.canAdmin ? (
                                <Button asChild className="rounded-xl">
                                    <Link href={createHref}>
                                        {dictionary.articles.create}
                                    </Link>
                                </Button>
                            ) : undefined
                        }
                    />
                ) : null}
            </div>
        </>
    )
}
