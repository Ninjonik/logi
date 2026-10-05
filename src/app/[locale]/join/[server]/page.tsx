import { notFound } from "next/navigation"
import type { Metadata } from "next"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { ServerJoinCard } from "@/components/public/server-join-card"
import { getServerJoinPage } from "@/lib/read-models/server-join"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

type Props = { params: Promise<{ locale: string; server: string }> }

const GAME_NAMES = {
    hell_let_loose: "Hell Let Loose",
    wardogs: "Wardogs",
} as const

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { locale, server } = await params
    const t = getDictionary(isLocale(locale) ? locale : "en").joinPage
    const page = await getServerJoinPage(server)
    return {
        title: page
            ? t.metaTitle.replace("{name}", page.name)
            : t.notFoundTitle,
        description: page
            ? t.metaDescription.replace("{name}", page.name)
            : undefined,
        robots: { index: false, follow: false },
    }
}

/**
 * `/join/<server>` (P4-44..46, P4-B10): opened by the "Připojit se" button
 * of a server panel, readable without login. Public data only: the server's
 * name, game, address or join code and players. Never a password.
 */
export default async function ServerJoinPage({ params }: Props) {
    const { locale, server } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const page = await getServerJoinPage(server)
    if (!page) notFound()
    const t = getDictionary(safeLocale).joinPage

    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage className="max-w-[48rem]">
                <ServerJoinCard
                    gameId={page.gameId}
                    gameName={GAME_NAMES[page.gameId]}
                    name={page.name}
                    address={page.address}
                    joinCode={page.joinCode}
                    players={page.players}
                    capacity={page.capacity}
                    map={page.map}
                    copy={t}
                />
            </PublicPage>
        </PublicSiteShell>
    )
}
