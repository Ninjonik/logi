import { useMDXComponents as getMDXComponents } from "../../../../mdx-components"
import { generateStaticParamsFor, importPage } from "nextra/pages"
import { getPublicUrl } from "@/lib/seo"
import type { Metadata } from "next"

export const generateStaticParams = generateStaticParamsFor("mdxPath")

export async function generateMetadata({
    params,
}: {
    params: Promise<{ mdxPath?: string[] }>
}) {
    const { mdxPath = [] } = await params
    const { metadata } = await importPage(mdxPath)
    const pathname = `/wiki${mdxPath.length ? `/${mdxPath.join("/")}` : ""}`
    return {
        ...(metadata as Metadata),
        alternates: { canonical: getPublicUrl(pathname) },
    }
}

const Wrapper = getMDXComponents().wrapper

export default async function WikiPage({
    params,
}: {
    params: Promise<{ mdxPath?: string[] }>
}) {
    const resolvedParams = await params
    const { mdxPath = [] } = resolvedParams
    const {
        default: MDXContent,
        toc,
        metadata,
        sourceCode,
    } = await importPage(mdxPath)

    return (
        <Wrapper toc={toc} metadata={metadata} sourceCode={sourceCode}>
            <MDXContent params={resolvedParams} />
        </Wrapper>
    )
}
