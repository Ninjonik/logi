import { WikiSearch } from "@/components/wiki/wiki-search"
import { Footer, Layout, Navbar } from "nextra-theme-docs"
import { getPageMap } from "nextra/page-map"
import "nextra-theme-docs/style.css"
import Link from "next/link"

import { RootDocument } from "@/components/providers/root-document"

export default async function WikiLayout({
    children,
}: {
    children: React.ReactNode
}) {
    // The wiki is written in English and renders its own document.
    return (
        <RootDocument lang="en">
            <Layout
                navbar={
                    <Navbar
                        logo={<b>Logi Wiki</b>}
                        projectLink="https://github.com/Ninjonik/logi/tree/main/src/app/wiki"
                    />
                }
                pageMap={await getPageMap("/wiki")}
                footer={
                    <Footer>
                        <Link href="/en">Logi</Link> · Community and server
                        management help
                    </Footer>
                }
                editLink={null}
                feedback={{ content: null }}
                search={<WikiSearch />}
            >
                {children}
            </Layout>
        </RootDocument>
    )
}
