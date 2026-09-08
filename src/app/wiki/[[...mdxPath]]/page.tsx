import { useMDXComponents as getMDXComponents } from "../../../../mdx-components"
import { generateStaticParamsFor, importPage } from "nextra/pages"

export const generateStaticParams = generateStaticParamsFor("mdxPath")

export async function generateMetadata({
    params,
}: {
    params: Promise<{ mdxPath?: string[] }>
}) {
    const { mdxPath = [] } = await params
    const { metadata } = await importPage(mdxPath)
    return metadata
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
