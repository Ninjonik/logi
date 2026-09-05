import fs from "fs/promises"
import path from "path"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"
import { PublicPage, PublicSiteShell } from "@/components/public/public-site-shell"
import { isLocale } from "@/i18n/config"

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  const safeLocale = isLocale(locale) ? locale : "en"
  const filePath = path.join(process.cwd(), "public", "docs", "tos.md")

  let content = ""
  try {
    content = await fs.readFile(filePath, "utf-8")
  } catch (error) {
    console.error("Error reading tos.md:", error)
    content = "# Terms of Service\nFailed to load Terms of Service."
  }

  return (
    <PublicSiteShell locale={safeLocale}><PublicPage className="max-w-4xl"><div className="prose prose-neutral dark:prose-invert max-w-none">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
        >
          {content}
        </ReactMarkdown>
    </div></PublicPage></PublicSiteShell>
  )
}
