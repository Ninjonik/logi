import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import { serverJoinSlugSchema } from "@/domain/discord-publications/server-join.schema"
import { getInternalAuthSecret } from "@/lib/env"

/**
 * The public join page of one server (`/join/<slug>`, P4-44..46): its Logi
 * name, game, address (HLL) or join code (Wardogs), current players and the
 * queue from the server panel's live read. A narrow read that exposes
 * nothing else and never a password.
 */
export type ServerJoinPage = {
    gameId: "hell_let_loose" | "wardogs"
    name: string
    address: string | null
    joinCode: string | null
    players: number | null
    capacity: number | null
    queue: number | null
}

const joinPageReference = makeFunctionReference<
    "query",
    { secret: string; slug: string },
    ServerJoinPage | null
>("discordPanelBot:joinPage")

export async function getServerJoinPage(
    slug: string
): Promise<ServerJoinPage | null> {
    if (!serverJoinSlugSchema.safeParse(slug).success) return null
    try {
        return await fetchQuery(joinPageReference, {
            secret: getInternalAuthSecret(),
            slug,
        })
    } catch {
        return null
    }
}
