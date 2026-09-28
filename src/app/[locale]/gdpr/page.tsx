import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { getLocalizedCanonical } from "@/lib/seo"
import ReactMarkdown from "react-markdown"
import { isLocale } from "@/i18n/config"
import type { Metadata } from "next"
import remarkGfm from "remark-gfm"
import fs from "fs/promises"
import path from "path"

export async function generateMetadata({
    params,
}: {
    params: Promise<{ locale: string }>
}): Promise<Metadata> {
    const { locale } = (await params) ?? { locale: "en" }
    const safeLocale = isLocale(locale) ? locale : "en"
    return {
        title: "GDPR information",
        description: "Logi information and rights under the GDPR.",
        alternates: getLocalizedCanonical(safeLocale, "/gdpr"),
    }
}

export default async function GdprPage({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const content = await fs.readFile(
        path.join(process.cwd(), "public", "docs", "gdpr.md"),
        "utf-8"
    )
    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage className="max-w-4xl">
                <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {content}
                    </ReactMarkdown>
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}
