import { createPublicInviteHandler } from "@/lib/api/public-invite-route"
import { savePublicClanInvite } from "@/lib/gateways/public-clan-invite"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { clanAdminWriteDenied } from "@/lib/api/clan-admin-route"
import { logRouteError } from "@/lib/server-route-errors"

const handle = createPublicInviteHandler({
    denied: clanAdminWriteDenied,
    save: savePublicClanInvite,
    revalidate: (serverId, guildDiscordId) =>
        revalidateCacheEntries([
            appCacheTags.server(serverId),
            appCacheTags.serverContext(serverId),
            appCacheTags.publicClan(guildDiscordId),
        ]),
    logError: (error) => logRouteError("publicInvite.save", error),
})

/** Sets or removes the Discord invite on the clan's public page (settings › Clan profile). */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    return handle(request, serverId)
}
