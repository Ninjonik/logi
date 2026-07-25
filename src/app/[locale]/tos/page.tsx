import fs from "fs/promises"
import path from "path"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeRaw from "rehype-raw"

export default async function Page() {
  const filePath = path.join(process.cwd(), "public", "docs", "tos.md")

  let content = ""
  try {
    content = await fs.readFile(filePath, "utf-8")
  } catch (error) {
    console.error("Error reading tos.md:", error)
    content = "# Terms of Service\nFailed to load Terms of Service."
  }

  return (
      <div className="prose prose-neutral dark:prose-invert max-w-4xl mx-auto p-6">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          rehypePlugins={[rehypeRaw]}
        >
          {content}
        </ReactMarkdown>
    </div>
  )
}