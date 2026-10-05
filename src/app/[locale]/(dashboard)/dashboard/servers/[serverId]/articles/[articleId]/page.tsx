import { ArticleDeleteButton } from "@/components/app/article-delete-button"
import { DiscordMarkdownText } from "@/components/app/discord-markdown"
import { PageHeader } from "@/components/app/page-header"
import { Card, CardContent } from "@/components/ui/card"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { toIntlLocale } from "@/lib/intl-locale"
import { Button } from "@/components/ui/button"
import { getArticle } from "@/lib/articles"
import { notFound } from "next/navigation"
import { formatDate } from "@/lib/format"
import { isLocale } from "@/i18n/config"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
export default async function ArticlePage({
    params,
}: {
    params: Promise<{ locale: string; serverId: string; articleId: string }>
}) {
    const { locale, serverId, articleId } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const context = await getServerContext(serverId)
    if (!context) notFound()
    // The ID comes from the URL; a malformed one is rejected by Convex.
    const article = await getArticle(articleId).catch(() => null)
    if (!article || article.guildId !== serverId) notFound()
    const listHref = `/${safeLocale}/dashboard/servers/${serverId}/articles`
    return (
        <>
            <PageHeader
                title={article.title}
                description={article.description}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <Link href={listHref}>
                                <ArrowLeft className="size-4" />
                                {dictionary.articles.backToList}
                            </Link>
                        </Button>
                        {context.canAdmin ? (
                            <ArticleDeleteButton
                                serverId={serverId}
                                articleId={article.id}
                                articleTitle={article.title}
                                listHref={listHref}
                                dictionary={dictionary}
                            />
                        ) : null}
                    </div>
                }
            />
            <div className="px-4 lg:px-6">
                <Card className="rounded-2xl">
                    <CardContent className="space-y-5 pt-6">
                        <div className="text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 text-sm">
                            {article.createdAt ? (
                                <time dateTime={article.createdAt}>
                                    {dictionary.articles.publishedOn.replace(
                                        "{date}",
                                        formatDate(
                                            article.createdAt,
                                            context.discordConfig?.timezone,
                                            toIntlLocale(safeLocale)
                                        )
                                    )}
                                </time>
                            ) : null}
                            {article.tags.map((tag) => (
                                <span key={tag}>#{tag}</span>
                            ))}
                        </div>
                        <div className="min-w-0 break-words">
                            <DiscordMarkdownText markdown={article.body} />
                        </div>
                        {article.attachments.length ? (
                            <div className="space-y-1">
                                <h2 className="font-medium">
                                    {dictionary.articles.attachments}
                                </h2>
                                {article.attachments.map((url) => (
                                    <a
                                        key={url}
                                        href={url}
                                        className="text-primary block truncate underline"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {url}
                                    </a>
                                ))}
                            </div>
                        ) : null}
                    </CardContent>
                </Card>
            </div>
        </>
    )
}
