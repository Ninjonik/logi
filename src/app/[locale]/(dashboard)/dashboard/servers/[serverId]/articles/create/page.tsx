import { PageHeader } from "@/components/app/page-header";
import { ArticleForm } from "@/components/app/article-form";
import { getServerContext } from "@/lib/server-context";
import { getDictionary } from "@/i18n/dictionaries";
import { isLocale } from "@/i18n/config";
export default async function CreateArticlePage({params}:{params:Promise<{locale:string;serverId:string}>}) {const {locale,serverId}=await params;const dictionary=getDictionary(isLocale(locale)?locale:"en");const context=await getServerContext(serverId);if(!context?.canAdmin)return null;return <><PageHeader title={dictionary.articles.createTitle} description={dictionary.articles.createDescription}/><div className="px-4 lg:px-6"><ArticleForm serverId={serverId} locale={locale} dictionary={dictionary}/></div></>;}
