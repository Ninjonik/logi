import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

import { workspaceAdminActions } from "@/lib/api/workspace-admin-actions-route"
import { getServerContextUncached } from "@/lib/read-models/server-context"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { getInternalAuthSecret, getSiteUrl } from "@/lib/env"

const setEnabledGamesReference = makeFunctionReference<"mutation">(
    "guilds:setEnabledGames"
)
const resyncDashboardAdminsReference = makeFunctionReference<"mutation">(
    "guilds:resyncDashboardAdmins"
)

export const workspaceAdminActionHandlers = workspaceAdminActions({
    origin: new URL(getSiteUrl()).origin,
    authorize: async (serverId) => {
        const context = await getServerContextUncached(serverId)
        return context?.canAdmin ? context.user.discordId : null
    },
    setEnabledGames: async (serverId, userId, enabledGames) => {
        await fetchMutation(setEnabledGamesReference, {
            secret: getInternalAuthSecret(),
            userId,
            guildId: serverId as never,
            enabledGames,
        })
    },
    resyncDashboardAdmins: async (serverId, userId) => {
        await fetchMutation(resyncDashboardAdminsReference, {
            secret: getInternalAuthSecret(),
            userId,
            serverId: serverId as never,
        })
    },
    revalidate: (serverId) =>
        revalidateCacheEntries([appCacheTags.serverContext(serverId)]),
})
