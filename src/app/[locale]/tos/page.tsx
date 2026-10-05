import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { getDictionary } from "@/i18n/dictionaries"
import { getLocalizedCanonical } from "@/lib/seo"
import ReactMarkdown from "react-markdown"
import { isLocale } from "@/i18n/config"
import type { Metadata } from "next"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
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
        title: "Terms of service",
        description: "Terms of service for using Logi.",
        alternates: getLocalizedCanonical(safeLocale, "/tos"),
    }
}

export default async function Page({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const filePath = path.join(process.cwd(), "public", "docs", "tos.md")

    let content: string | null = null
    try {
        content = await fs.readFile(filePath, "utf-8")
    } catch (error) {
        console.error("Error reading tos.md:", error)
    }
    const legal = getDictionary(safeLocale).publicSite.legal

    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage className="max-w-4xl">
                {content === null ? (
                    <div className="space-y-4">
                        <h1 className="text-3xl font-semibold">
                            {legal.termsTitle}
                        </h1>
                        <p role="alert" className="text-muted-foreground">
                            {legal.loadFailed}
                        </p>
                    </div>
                ) : (
                    <div className="prose prose-neutral dark:prose-invert max-w-none">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            rehypePlugins={[rehypeRaw]}
                        >
                            {content}
                        </ReactMarkdown>
                    </div>
                )}
            </PublicPage>
        </PublicSiteShell>
    )
}
