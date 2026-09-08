import { WikiSearch } from "@/components/wiki/wiki-search"
import { Footer, Layout, Navbar } from "nextra-theme-docs"
import { getPageMap } from "nextra/page-map"
import "nextra-theme-docs/style.css"
import Link from "next/link"

export default async function WikiLayout({
    children,
}: {
    children: React.ReactNode
}) {
    return (
        <Layout
            navbar={
                <Navbar
                    logo={<b>Logi Wiki</b>}
                    projectLink="https://github.com/"
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
    )
}
