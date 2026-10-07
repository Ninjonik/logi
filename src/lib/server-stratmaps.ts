import { appCacheTags, cachedRead } from "@/lib/cache-tags"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import { clientGrantScopes } from "@/domain/identity/client-grant"
import { getLoggedInUser, getSession } from "@/lib/auth"
import { issueClientGrant } from "@/lib/client-grants"
import type { GameId } from "@/domain/games/game"
import { getInternalAuthSecret } from "@/lib/env"

const getStratmapByIdReference =
    makeFunctionReference<"query">("stratmaps:getById")
const getPublicStratmapByIdReference = makeFunctionReference<"query">(
    "stratmaps:getPublicById"
)
const listStratmapsByGuildReference = makeFunctionReference<"query">(
    "stratmaps:listByGuild"
)
const removeStratmapReference =
    makeFunctionReference<"mutation">("stratmaps:remove")

export type RemoveStratmapResult =
    | { ok: true; detachedEventIds: string[] }
    | { ok: false; error: "not_found" | "forbidden" }

/**
 * Deletes a stratmap of the clan for the signed-in user; Convex checks that
 * the user administers the clan and that the stratmap belongs to it.
 */
export async function removeServerStratmap(
    serverId: string,
    stratmapId: string
): Promise<RemoveStratmapResult> {
    const user = await getLoggedInUser()
    if (!user) return { ok: false, error: "forbidden" }
    return (await fetchMutation(removeStratmapReference, {
        secret: getInternalAuthSecret(),
        userId: user.discordId,
        serverId: serverId as never,
        stratmapId: stratmapId as never,
    })) as RemoveStratmapResult
}

export async function getStratmapDetail(stratmapId: string) {
    const [user, session] = await Promise.all([getLoggedInUser(), getSession()])
    if (!user || !session) {
        return null
    }

    const detail = (await fetchQuery(getStratmapByIdReference, {
        secret: getInternalAuthSecret(),
        userId: user.discordId,
        stratmapId: stratmapId as never,
    })) as {
        canAdmin: boolean
        serverId: string
        stratmap: {
            id: string
            guildId: string
            eventId?: string
            gameId?: GameId
            title: string
            description?: string
            baseMapId: string
            side?: string
            strongpointId?: string
            state: string
            createdBy: string
            createdAt: string
            updatedAt: string
        }
    } | null

    return detail
        ? {
              ...detail,
              grant: issueClientGrant(
                  { discordId: session.sub, sid: session.sid },
                  clientGrantScopes.stratmap(stratmapId)
              ),
          }
        : null
}

export async function getPublicStratmapDetail(stratmapId: string) {
    return await cachedRead(
        ["public-stratmap", stratmapId],
        [appCacheTags.stratmap(stratmapId), appCacheTags.publicDiscovery()],
        async () =>
            (await fetchQuery(getPublicStratmapByIdReference, {
                secret: getInternalAuthSecret(),
                stratmapId: stratmapId as never,
            })) as {
                id: string
                guildId: string
                eventId?: string
                gameId?: GameId
                title: string
                description?: string
                baseMapId: string
                side?: string
                strongpointId?: string
                state: string
                createdBy: string
                createdAt: string
                updatedAt: string
            } | null,
        300
    )
}

export async function listServerStratmaps(serverId: string) {
    const user = await getLoggedInUser()
    if (!user) {
        return null
    }

    return (await fetchQuery(listStratmapsByGuildReference, {
        secret: getInternalAuthSecret(),
        userId: user.discordId,
        serverId: serverId as never,
    })) as {
        canAdmin: boolean
        stratmaps: Array<{
            id: string
            guildId: string
            eventId?: string
            gameId?: GameId
            title: string
            description?: string
            baseMapId: string
            side?: string
            strongpointId?: string
            state: string
            createdBy: string
            createdAt: string
            updatedAt: string
        }>
    } | null
}
