import { redirect } from "next/navigation"

import { isGameId } from "@/domain/games/game"
import { isLocale } from "@/i18n/config"

/** Membership settings moved to clan settings. */
export default async function ServerMembershipsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string | string[] }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const requestedGame = Array.isArray(game) ? game[0] : game
    const safeLocale = isLocale(locale) ? locale : "en"
    // Only a known game is carried over; anything else opens the clan-wide view.
    const search = isGameId(requestedGame) ? `?game=${requestedGame}` : ""
    redirect(
        `/${safeLocale}/dashboard/servers/${encodeURIComponent(serverId)}/settings/membership${search}`
    )
}
