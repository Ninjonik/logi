import type { Metadata } from "next"

import { ClanOverview } from "@/components/app/clan-overview/clan-overview"
import { getServerContext } from "@/lib/server-context"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Server dashboard | Logi",
    description: "Manage your server community.",
}

export default async function ServerOverviewPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const gameId = isGameId(game) ? game : undefined
    const context = await getServerContext(serverId, gameId ?? "all")
    if (!context) return null
    return (
        <ClanOverview
            locale={isLocale(locale) ? locale : "en"}
            serverId={serverId}
            gameId={gameId}
            context={context}
            now={new Date()}
        />
    )
}
