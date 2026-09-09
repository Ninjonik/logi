import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"

import type { GameId } from "@/domain/games/game"
import { getInternalAuthSecret } from "@/lib/env"

const upsertEventReference = makeFunctionReference<"mutation">("events:upsert")
const concludeEventReference =
    makeFunctionReference<"mutation">("events:conclude")
const completeTrainingReference = makeFunctionReference<"mutation">(
    "events:completeTraining"
)
const setEventResultReference =
    makeFunctionReference<"mutation">("events:setResult")
const toggleSignupReference = makeFunctionReference<"mutation">(
    "events:toggleSignUp"
)
const requestForumTopicResyncReference = makeFunctionReference<"mutation">(
    "discordSync:requestForumTopicResync"
)

export async function saveServerEventCommand(input: {
    eventId?: string
    serverId: string
    gameId?: GameId
    kind: "match" | "training"
    matchType?: string
    name: string
    description?: string
    thumbnailUrl?: string
    imageUrl?: string
    announcementChannelId?: string
    eventInfoChannelId?: string
    meetingChannelId?: string
    requiredRoleIds?: string[]
    rewardRoleIds?: string[]
    signupGroupIds?: string[]
    allowedSignupStatuses?: Array<
        "recruit" | "member" | "reserve_member" | "mercenary"
    >
    useGeneralSignup?: boolean
    recurrence?: {
        frequency: "weekly" | "monthly_date" | "monthly_nth_weekday"
        interval: number
        weekdays: number[]
        monthDay?: number
        nth?: number
        weekday?: number
    }
    server?: string
    serverPassword?: string
    side?: string
    map?: string
    cap?: string
    notes?: string
    registrationEnd: string
    meetingStart: string
    gameStart?: string
    gameEnd?: string
    pingClan: boolean
    pingMode?: "none" | "clan" | "roles"
    pingRoleIds?: string[]
    createForumChannel: boolean
    topicPresetId?: string
    stratmapIds?: string[]
}) {
    return await fetchMutation(upsertEventReference, {
        secret: getInternalAuthSecret(),
        eventId: input.eventId as never,
        serverId: input.serverId,
        gameId: input.gameId,
        kind: input.kind,
        matchType: input.matchType,
        name: input.name,
        description: input.description,
        thumbnailUrl: input.thumbnailUrl,
        imageUrl: input.imageUrl,
        announcementChannelId: input.announcementChannelId,
        eventInfoChannelId: input.eventInfoChannelId,
        meetingChannelId: input.meetingChannelId,
        requiredRoleIds: input.requiredRoleIds,
        rewardRoleIds: input.rewardRoleIds,
        signupGroupIds: input.signupGroupIds,
        allowedSignupStatuses: input.allowedSignupStatuses,
        useGeneralSignup: input.useGeneralSignup,
        recurrence: input.recurrence,
        server: input.server,
        serverPassword: input.serverPassword,
        side: input.side,
        map: input.map,
        cap: input.cap,
        notes: input.notes,
        registrationEnd: input.registrationEnd,
        meetingStart: input.meetingStart,
        gameStart: input.gameStart ?? input.meetingStart,
        gameEnd: input.gameEnd ?? input.gameStart ?? input.meetingStart,
        pingClan: input.pingClan,
        pingMode: input.pingMode,
        pingRoleIds: input.pingRoleIds,
        createForumChannel: input.createForumChannel,
        topicPresetId: input.topicPresetId as never,
        stratmapIds: input.stratmapIds,
    })
}

export async function concludeServerEventCommand(input: { eventId: string }) {
    return await fetchMutation(concludeEventReference, {
        secret: getInternalAuthSecret(),
        eventId: input.eventId as never,
    })
}

export async function completeServerTrainingCommand(input: {
    eventId: string
    participants: Array<{
        userId: string
        completed: "passed" | "failed"
    }>
}) {
    return await fetchMutation(completeTrainingReference, {
        secret: getInternalAuthSecret(),
        eventId: input.eventId as never,
        participants: input.participants,
    })
}

export async function saveServerEventResultCommand(input: {
    eventId: string
    eventResult: {
        sourceUrl: string
        mapId: string
        mapName?: string
        endedAt?: string
        importedAt: string
        sideA: string
        sideB: string
        outcome: "victory" | "defeat" | "draw"
        score: {
            sideA: number
            sideB: number
        }
    }
}) {
    return await fetchMutation(setEventResultReference, {
        secret: getInternalAuthSecret(),
        eventId: input.eventId as never,
        eventResult: input.eventResult,
    })
}

export async function toggleServerEventSignupCommand(input: {
    eventId: string
    userId: string
    group: string | null
}) {
    return await fetchMutation(toggleSignupReference, {
        secret: getInternalAuthSecret(),
        eventId: input.eventId as never,
        userId: input.userId,
        group: input.group,
    })
}

export async function requestServerForumTopicResync(input: {
    eventId: string
}) {
    return await fetchMutation(requestForumTopicResyncReference, {
        secret: getInternalAuthSecret(),
        eventId: input.eventId as never,
    })
}
