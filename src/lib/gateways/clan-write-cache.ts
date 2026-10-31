import { createClanMutationResponder } from "../api/clan-mutation-response"
import { appCacheTags, revalidateCacheEntries } from "../cache-tags"
import { logRouteError } from "../server-route-errors"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "../env"
import { fetchQuery } from "convex/nextjs"

export function clanWriteCacheTags(
    serverId: string,
    guildId: string,
    body: string
) {
    const parsed: unknown = JSON.parse(body)
    const data =
        parsed &&
        typeof parsed === "object" &&
        "data" in parsed &&
        parsed.data &&
        typeof parsed.data === "object"
            ? parsed.data
            : {}
    const field = (name: string) => {
        const value: unknown = Reflect.get(data, name)
        return typeof value === "string" ? value : undefined
    }
    const id = field("id"),
        eventId = field("eventId"),
        userId = field("userId")
    return [
        appCacheTags.server(serverId),
        appCacheTags.serverContext(serverId),
        appCacheTags.events(serverId),
        appCacheTags.matches(serverId),
        appCacheTags.rosters(serverId),
        appCacheTags.groups(serverId),
        appCacheTags.assignments(serverId),
        appCacheTags.topicPresets(serverId),
        appCacheTags.squadPresets(serverId),
        appCacheTags.stratmaps(serverId),
        appCacheTags.discordConfig(serverId),
        appCacheTags.publicClan(guildId),
        appCacheTags.publicDiscovery(),
        appCacheTags.rosterImage(),
        ...(id
            ? [
                  appCacheTags.event(id),
                  appCacheTags.match(id),
                  appCacheTags.publicMatch(id),
                  appCacheTags.roster(id),
                  appCacheTags.group(id),
                  appCacheTags.assignment(id),
                  appCacheTags.topicPreset(id),
                  appCacheTags.squadPreset(id),
                  appCacheTags.stratmap(id),
              ]
            : []),
        ...(eventId
            ? [
                  appCacheTags.event(eventId),
                  appCacheTags.match(eventId),
                  appCacheTags.publicMatch(eventId),
                  appCacheTags.rosterImageEvent(eventId),
              ]
            : []),
        ...(userId
            ? [
                  appCacheTags.player(userId),
                  appCacheTags.publicProfile(userId),
                  appCacheTags.users(),
              ]
            : []),
    ]
}

export const clanMutationResponse = createClanMutationResponder({
    async invalidate(guildId, body) {
        const server: unknown = await fetchQuery(
            makeFunctionReference<"query">("guilds:getByDiscordId"),
            { secret: getInternalAuthSecret(), discordId: guildId }
        )
        if (
            !server ||
            typeof server !== "object" ||
            !("id" in server) ||
            typeof server.id !== "string"
        )
            throw new Error("Cannot resolve clan cache scope.")
        revalidateCacheEntries(clanWriteCacheTags(server.id, guildId, body))
    },
    onInvalidationError: (error) => logRouteError("clan-write-cache", error),
})
