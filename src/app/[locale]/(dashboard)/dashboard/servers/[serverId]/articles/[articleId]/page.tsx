import { notFound } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { DiscordMarkdownText } from "@/components/app/discord-markdown";
import { Card, CardContent } from "@/components/ui/card";
import { getArticle } from "@/lib/articles";
import { getServerContext } from "@/lib/server-context";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
export default async function ArticlePage({params}:{params:Promise<{locale:string;serverId:string;articleId:string}>}) {const {locale,serverId,articleId}=await params;const dictionary=getDictionary(isLocale(locale)?locale:"en");const context=await getServerContext(serverId);if(!context)return null;const article=await getArticle(articleId);if(!article||article.guildId!==serverId)notFound();return <><PageHeader title={article.title} description={article.description}/><div className="px-4 lg:px-6"><Card><CardContent className="space-y-5 pt-6"><div className="flex gap-2 text-sm text-muted-foreground">{article.tags.map(tag=><span key={tag}>#{tag}</span>)}</div><DiscordMarkdownText markdown={article.body}/>{article.attachments.length?<div className="space-y-1"><h2 className="font-medium">{dictionary.articles.attachments}</h2>{article.attachments.map(url=><a key={url} href={url} className="block text-primary underline" target="_blank" rel="noreferrer">{url}</a>)}</div>:null}</CardContent></Card></div></>;}
