import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerContext } from "@/lib/server-context";
import { listArticles } from "@/lib/articles";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
export default async function ArticlesPage({params}:{params:Promise<{locale:string;serverId:string}>}) { const {locale,serverId}=await params; const dictionary=getDictionary(isLocale(locale)?locale:"en"); const context=await getServerContext(serverId); if(!context)return null; const articles=await listArticles(serverId); return <><PageHeader title={dictionary.articles.title} description={dictionary.articles.description} actions={context.canAdmin?<Button asChild><Link href={`/${locale}/dashboard/servers/${serverId}/articles/create`}>{dictionary.articles.create}</Link></Button>:undefined}/><div className="space-y-4 px-4 lg:px-6">{articles.map(article=><Card key={article.id}><CardHeader><CardTitle><Link href={`/${locale}/dashboard/servers/${serverId}/articles/${article.id}`}>{article.title}</Link></CardTitle><p className="text-sm text-muted-foreground">{article.description}</p></CardHeader><CardContent className="flex gap-2 text-xs text-muted-foreground">{article.tags.map(tag=><span key={tag}>#{tag}</span>)}</CardContent></Card>)}{!articles.length?<p className="text-muted-foreground">{dictionary.articles.noArticles}</p>:null}</div></>; }
