import { ShieldAlert } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { ClanOverview } from "@/components/app/clan-overview/clan-overview"
import { EmptyState } from "@/components/app/empty-state"
import { getServerContext } from "@/lib/server-context"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

export const metadata: Metadata = {
    title: "Server dashboard",
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
    const safeLocale = isLocale(locale) ? locale : "en"
    const gameId = isGameId(game) ? game : undefined
    const context = await getServerContext(serverId, gameId ?? "all")
    if (!context) {
        const text = getDictionary(safeLocale).clanOverview
        return (
            <div className="px-4 lg:px-6">
                <EmptyState
                    icon={ShieldAlert}
                    title={text.unavailableTitle}
                    description={text.unavailableDescription}
                    actions={
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <Link href={`/${safeLocale}/dashboard`}>
                                {text.backToClans}
                            </Link>
                        </Button>
                    }
                />
            </div>
        )
    }
    return (
        <ClanOverview
            locale={safeLocale}
            serverId={serverId}
            gameId={gameId}
            context={context}
            now={new Date()}
        />
    )
}
