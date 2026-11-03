import { appCacheTags } from "../cache-tags"

type AssignmentChangedPayload = {
    type: "assignment-changed"
    serverId: string
    userId: string
    assignmentId?: string
}

type RosterChangedPayload = {
    type: "roster-changed"
    serverId: string
    rosterId: string
    eventId?: string
}

type EventChangedPayload = {
    type: "event-changed"
    serverId: string
    eventId: string
}

type DiscordConfigChangedPayload = {
    type: "discord-config-changed"
    serverId: string
}

type ServerContextChangedPayload = {
    type: "server-context-changed"
    serverId: string
}

export type CacheRevalidationPayload =
    | AssignmentChangedPayload
    | RosterChangedPayload
    | EventChangedPayload
    | DiscordConfigChangedPayload
    | ServerContextChangedPayload

export function getTagsForPayload(payload: CacheRevalidationPayload) {
    switch (payload.type) {
        case "assignment-changed":
            return [
                appCacheTags.serverContext(payload.serverId),
                appCacheTags.assignments(payload.serverId),
                payload.assignmentId
                    ? appCacheTags.assignment(payload.assignmentId)
                    : undefined,
                appCacheTags.player(payload.userId),
                appCacheTags.users(),
                appCacheTags.rosterImage(),
            ]
        case "roster-changed":
            return [
                appCacheTags.serverContext(payload.serverId),
                appCacheTags.rosters(payload.serverId),
                appCacheTags.roster(payload.rosterId),
                appCacheTags.rosterImage(),
                payload.eventId
                    ? appCacheTags.rosterImageEvent(payload.eventId)
                    : undefined,
            ]
        case "event-changed":
            return [
                appCacheTags.serverContext(payload.serverId),
                appCacheTags.events(payload.serverId),
                appCacheTags.event(payload.eventId),
                appCacheTags.matches(payload.serverId),
                appCacheTags.match(payload.eventId),
                appCacheTags.rosters(payload.serverId),
                appCacheTags.rosterImageEvent(payload.eventId),
                appCacheTags.users(),
            ]
        case "discord-config-changed":
            return [
                appCacheTags.serverContext(payload.serverId),
                appCacheTags.discordConfig(payload.serverId),
            ]
        case "server-context-changed":
            return [appCacheTags.serverContext(payload.serverId)]
    }
}

/** Resolve transport scope once, then invalidate every cached ID alias. */
export async function invalidateAppData(
    payload: CacheRevalidationPayload,
    deps: {
        resolve(serverId: string): Promise<unknown>
        invalidate(tags: Array<string | undefined>): void
    }
) {
    const server = await deps.resolve(payload.serverId)
    if (
        !server ||
        typeof server !== "object" ||
        !("id" in server) ||
        typeof server.id !== "string" ||
        !server.id ||
        !("discordId" in server) ||
        typeof server.discordId !== "string" ||
        !server.discordId
    ) {
        throw new Error("Cannot resolve clan cache scope.")
    }
    deps.invalidate([
        ...getTagsForPayload({ ...payload, serverId: server.id }),
        ...getTagsForPayload({ ...payload, serverId: server.discordId }),
        appCacheTags.publicClan(server.discordId),
        appCacheTags.publicDiscovery(),
    ])
}
