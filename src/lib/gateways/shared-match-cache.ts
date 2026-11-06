import { appCacheTags, revalidateCacheEntries } from "../cache-tags"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "../env"
import { fetchQuery } from "convex/nextjs"

type Scope = {
    serverId: string
    guildId: string
    eventId: string
    rosterId?: string
}
export async function sharedMatchCacheScopes(
    resourceId: string
): Promise<Scope[]> {
    return fetchQuery(
        makeFunctionReference<"query">("sharedMatches:cacheScopes"),
        { secret: getInternalAuthSecret(), resourceId }
    )
}
export function invalidateSharedMatchScopes(scopes: Scope[]) {
    revalidateCacheEntries(
        scopes.flatMap((item) => [
            appCacheTags.serverContext(item.guildId),
            item.rosterId ? appCacheTags.roster(item.rosterId) : undefined,
            appCacheTags.serverContext(item.serverId),
            appCacheTags.events(item.serverId),
            appCacheTags.rosters(item.serverId),
            appCacheTags.event(item.eventId),
            appCacheTags.match(item.eventId),
            appCacheTags.publicMatch(item.eventId),
            appCacheTags.rosterImageEvent(item.eventId),
            appCacheTags.publicClan(item.guildId),
        ])
    )
}
export async function invalidateSharedMatchCaches(resourceId: string) {
    invalidateSharedMatchScopes(await sharedMatchCacheScopes(resourceId))
}
