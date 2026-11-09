"use server"

import {
    sharedMatchSettingsSchema,
    type SharedMatchSettings,
} from "../validation/shared-match-settings"
import type {
    SharedSignupGroup,
    RequestedMatchRole,
} from "@/domain/events/shared-match"
import { appCacheTags, revalidateCacheEntries } from "../cache-tags"
import { invalidateSharedMatchCaches } from "./shared-match-cache"
import type { EventRecord, Group, AppUser } from "@/types/domain"
import { currentDashboardActor } from "./dashboard-actor"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { getServerContext } from "../server-context"
import { getInternalAuthSecret } from "../env"

export type SharedRosterContext = {
    groups: Group[]
    hostGuildId: string
    clans: { guildId: string; name: string; avatar?: string }[]
    users: (AppUser & { sharedGuildId: string })[]
}
export type SharedInvitation = {
    id: string
    hostEventId: string
    guestGuildId: string
    localEventId?: string
    status: "pending" | "accepted" | "declined" | "revoked"
    hostName: string
    guestName: string
    matchName: string
    requestedRoles: RequestedMatchRole[]
    signupGroups?: (SharedSignupGroup & { name: string })[]
}

async function scope(serverId: string) {
    const [context, actor] = await Promise.all([
        getServerContext(serverId, "all"),
        currentDashboardActor(),
    ])
    if (!actor || !context?.canAdmin) throw new Error("Forbidden.")
    return {
        secret: getInternalAuthSecret(),
        guildId: context.server.discordId,
        actor,
    }
}

export async function sharedRosterContext(
    serverId: string,
    eventId: string
): Promise<SharedRosterContext> {
    return fetchQuery(
        makeFunctionReference<"query">("sharedMatches:rosterContext"),
        { ...(await scope(serverId)), eventId }
    )
}

export async function sharedInvitations(
    serverId: string,
    eventId?: string
): Promise<{ incoming: SharedInvitation[]; invitations: SharedInvitation[] }> {
    return fetchQuery(makeFunctionReference<"query">("sharedMatches:list"), {
        ...(await scope(serverId)),
        eventId,
    })
}

/** Reuse the invitation list's manager authorization and pending-state rules. */
export async function pendingSharedInvitationCount(
    serverId: string
): Promise<number> {
    return (await sharedInvitations(serverId)).incoming.length
}

export async function searchSharedClans(
    serverId: string,
    search: string
): Promise<{ guildId: string; name: string }[]> {
    return fetchQuery(
        makeFunctionReference<"query">("sharedMatches:searchClans"),
        { ...(await scope(serverId)), search }
    )
}

export async function inviteSharedClan(
    serverId: string,
    eventId: string,
    guestGuildId: string,
    requestedRoles: RequestedMatchRole[],
    signupGroups?: SharedSignupGroup[]
) {
    await fetchMutation(
        makeFunctionReference<"mutation">("sharedMatches:invite"),
        {
            ...(await scope(serverId)),
            eventId,
            guestGuildId,
            requestedRoles,
            signupGroups,
        }
    )
    revalidateCacheEntries([
        appCacheTags.serverContext(serverId),
        appCacheTags.event(eventId),
    ])
}

export async function respondSharedInvitation(
    serverId: string,
    invitationId: string,
    accept: boolean,
    registrationStart?: string,
    settings?: SharedMatchSettings
): Promise<string | null> {
    const id = await fetchMutation(
        makeFunctionReference<"mutation">("sharedMatches:respond"),
        {
            ...(await scope(serverId)),
            invitationId,
            accept,
            registrationStart,
            settings: settings
                ? sharedMatchSettingsSchema.parse(settings)
                : undefined,
        }
    )
    revalidateCacheEntries([
        appCacheTags.serverContext(serverId),
        appCacheTags.events(serverId),
        appCacheTags.rosters(serverId),
    ])
    if (id) await invalidateSharedMatchCaches(id)
    return id
}

export async function configureSharedMatch(
    serverId: string,
    eventId: string,
    settings: SharedMatchSettings
) {
    await fetchMutation(
        makeFunctionReference<"mutation">("sharedMatches:configureLocal"),
        {
            ...(await scope(serverId)),
            eventId,
            ...sharedMatchSettingsSchema.parse(settings),
        }
    )
    await invalidateSharedMatchCaches(eventId)
    revalidateCacheEntries([
        appCacheTags.serverContext(serverId),
        appCacheTags.event(eventId),
        appCacheTags.events(serverId),
    ])
}

export async function revokeSharedInvitation(
    serverId: string,
    invitationId: string,
    eventId: string
) {
    await fetchMutation(
        makeFunctionReference<"mutation">("sharedMatches:revoke"),
        { ...(await scope(serverId)), invitationId }
    )
    await invalidateSharedMatchCaches(eventId)
}

export async function sharedAcceptanceContext(
    serverId: string,
    invitationId: string
): Promise<{ event: EventRecord; groups: Group[] }> {
    return fetchQuery(
        makeFunctionReference<"query">("sharedMatches:acceptanceContext"),
        { ...(await scope(serverId)), invitationId }
    )
}
