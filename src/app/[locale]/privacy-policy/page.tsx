import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
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
        title: "Privacy policy",
        description: "Logi privacy policy and information about personal data.",
        alternates: getLocalizedCanonical(safeLocale, "/privacy-policy"),
    }
}

export default async function Page({
    params,
}: {
    params: Promise<{ locale: string }>
}) {
    const { locale } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const filePath = path.join(
        process.cwd(),
        "public",
        "docs",
        "privacy-policy.md"
    )

    let content = ""
    try {
        content = await fs.readFile(filePath, "utf-8")
    } catch (error) {
        console.error("Error reading privacy-policy.md:", error)
        content = "# Terms of Service\nFailed to load Privacy Policy."
    }

    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage className="max-w-4xl">
                <div className="prose prose-neutral dark:prose-invert max-w-none">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        rehypePlugins={[rehypeRaw]}
                    >
                        {content}
                    </ReactMarkdown>
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}
