import {
    convertLegacyStatsServers,
    discordCommandsWebAccess,
    readCommandRegistration,
    requestCommandRegistration,
    saveCommandSettings,
} from "@/lib/gateways/discord-commands"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { discordCommandsRoutes } from "@/lib/api/discord-commands-route"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"

export const runtime = "nodejs"
type Context = { params: Promise<{ serverId: string }> }

const handlers = discordCommandsRoutes({
    isWriteOrigin: isDashboardWriteOrigin,
    access: discordCommandsWebAccess,
    registration: readCommandRegistration,
    save: async (access, input) => {
        await saveCommandSettings(access, input)
        revalidateCacheEntries([
            appCacheTags.serverContext(access.serverId),
            appCacheTags.discordConfig(access.serverId),
        ])
    },
    reregister: requestCommandRegistration,
    convertLegacy: convertLegacyStatsServers,
})

/** The "Registrace příkazů" status (N3-03). */
export async function GET(request: Request, context: Context) {
    return handlers.GET(request, await context.params)
}

/** Save the "Příkazy" page, re-register commands or convert old stats servers. */
export async function POST(request: Request, context: Context) {
    return handlers.POST(request, await context.params)
}
