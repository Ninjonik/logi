import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { isGameId } from "@/domain/games/game"

export const metadata: Metadata = {
    title: "Events",
    description: "Matches and trainings of the clan.",
}

/**
 * The old table of all events. Matches and trainings now share one list
 * (design E1), so old links and bookmarks open it with the same game filter.
 */
export default async function EventsPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}) {
    const { locale, serverId } = await params
    const game = (await searchParams)?.game
    const query =
        typeof game === "string" && isGameId(game) ? `?game=${game}` : ""
    redirect(
        `/${encodeURIComponent(locale)}/dashboard/servers/${encodeURIComponent(serverId)}/matches${query}`
    )
}
