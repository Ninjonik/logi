import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"

import {
    resultReviewSchema,
    type ResultRevision,
} from "@/domain/match-results/result-revision"
import type { DashboardActor } from "../../../convex/dashboardActor"
import type { GameId } from "@/domain/games/game"
import { getInternalAuthSecret } from "@/lib/env"

const getEventSyncContextReference = makeFunctionReference<"query">(
    "discordSync:getEventSyncContext"
)
const getEventResultsReference =
    makeFunctionReference<"query">("eventResults:get")

/** Where the bot posted an event: Discord IDs only, no event data. */
export type EventDiscordMessages = {
    announcementChannelId?: string
    announcementMessageId?: string
    eventInfoMessageId?: string
    rosterUpdateChannelId?: string
    rosterUpdateMessageId?: string
    forumThreadId?: string
    scheduledEventId?: string
    scheduledEventStatus?: "scheduled" | "active" | "completed" | "canceled"
}

function optionalString(value: unknown) {
    return typeof value === "string" && value ? value : undefined
}

/**
 * The Discord messages of an event. Callers pass an event they already found
 * in the viewer's clan context, which keeps the read scoped to that clan.
 */
export async function getEventDiscordMessages(
    eventId: string
): Promise<EventDiscordMessages | null> {
    try {
        const context = (await fetchQuery(getEventSyncContextReference, {
            secret: getInternalAuthSecret(),
            eventId: eventId as never,
        })) as { syncState?: Record<string, unknown> | null } | null
        const state = context?.syncState
        if (!state) return null
        const status = state.scheduledEventStatus
        return {
            announcementChannelId: optionalString(state.announcementChannelId),
            announcementMessageId: optionalString(state.announcementMessageId),
            eventInfoMessageId: optionalString(state.eventInfoMessageId),
            rosterUpdateChannelId: optionalString(state.rosterUpdateChannelId),
            rosterUpdateMessageId: optionalString(state.rosterUpdateMessageId),
            forumThreadId: optionalString(state.forumThreadId),
            scheduledEventId: optionalString(state.scheduledEventId),
            scheduledEventStatus:
                status === "scheduled" ||
                status === "active" ||
                status === "completed" ||
                status === "canceled"
                    ? status
                    : undefined,
        }
    } catch {
        return null
    }
}

export type EventResultReview = {
    current: ResultRevision | null
    history: ResultRevision[]
}

/**
 * The reviewed result of a match for a clan admin, or null when it cannot be
 * read (no admin access, or a deployment without reviewed results).
 */
export async function getEventResultReview(scope: {
    guildId: string
    gameId: GameId
    eventId: string
    actorId: string
}) {
    try {
        return resultReviewSchema.parse(
            await fetchQuery(getEventResultsReference, {
                secret: getInternalAuthSecret(),
                ...scope,
                eventId: scope.eventId as never,
            })
        )
    } catch {
        return null
    }
}

const listPublicPanelsReference = makeFunctionReference<"query">(
    "discordPublicPanels:list"
)

/**
 * The channel of the clan's enabled Discord results panel for a game, where a
 * confirmed result appears; null when there is none, undefined when it cannot
 * be read. Convex checks that the actor is a clan admin.
 */
export async function getResultsPanelChannelId(input: {
    guildId: string
    gameId: GameId
    actor: DashboardActor
}): Promise<string | null | undefined> {
    try {
        const result = (await fetchQuery(listPublicPanelsReference, {
            secret: getInternalAuthSecret(),
            guildId: input.guildId,
            actor: input.actor,
        })) as {
            panels?: Array<{
                kind?: string
                gameId?: string
                enabled?: boolean
                channelId?: string
            }>
        } | null
        const panel = result?.panels?.find(
            (item) =>
                item.kind === "results" &&
                item.enabled &&
                item.gameId === input.gameId &&
                item.channelId
        )
        return panel?.channelId ?? null
    } catch {
        return undefined
    }
}

/** Link to a Discord message, thread or channel. */
export function discordUrl(
    guildId: string,
    channelId: string,
    messageId?: string
) {
    return `https://discord.com/channels/${guildId}/${channelId}${messageId ? `/${messageId}` : ""}`
}
