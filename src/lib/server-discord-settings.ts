import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"

import type { DiscordSettingsPatch } from "@/lib/validation/discord-settings"
import type { DiscordConfig } from "@/types/domain"
import { getInternalAuthSecret } from "@/lib/env"

const getConfigByGuildReference = makeFunctionReference<"query">(
    "discordConfig:getConfigByGuild"
)
const getMembershipApplicationByAssignmentReference =
    makeFunctionReference<"query">(
        "discordMembership:getMembershipApplicationByAssignment"
    )
const upsertConfigReference = makeFunctionReference<"mutation">(
    "discordConfig:upsertConfig"
)

export async function getDiscordConfigByGuild(guildId: string) {
    return (await fetchQuery(getConfigByGuildReference, {
        guildId: guildId as never,
    })) as DiscordConfig | null
}

export async function getMembershipApplicationByAssignment(
    assignmentId: string
) {
    return (await fetchQuery(getMembershipApplicationByAssignmentReference, {
        secret: getInternalAuthSecret(),
        assignmentId: assignmentId as never,
    })) as { categoryId: string } | null
}

/**
 * Saves only the settings present in `patch`; omitted settings keep their stored
 * values and `null` clears a single Discord ID.
 */
export async function saveDiscordConfig(
    guildId: string,
    patch: DiscordSettingsPatch
) {
    const present = Object.fromEntries(
        Object.entries(patch).filter(([, value]) => value !== undefined)
    )
    return await fetchMutation(upsertConfigReference, {
        secret: getInternalAuthSecret(),
        guildId: guildId as never,
        ...present,
    })
}

const confirmRosterAttendanceFromMeetingChannelReference =
    makeFunctionReference<"mutation">(
        "discordRosters:confirmRosterAttendanceFromMeetingChannel"
    )

const requestMeetingAttendanceConfirmationReference =
    makeFunctionReference<"mutation">(
        "meetingAttendance:requestMeetingAttendanceConfirmation"
    )
const getMeetingAttendanceRequestReference = makeFunctionReference<"query">(
    "meetingAttendance:getMeetingAttendanceRequest"
)

export async function confirmRosterAttendanceFromMeetingChannel(input: {
    guildId: string
    rosterId: string
    memberIdsInMeetingChannel: string[]
}) {
    return (await fetchMutation(
        confirmRosterAttendanceFromMeetingChannelReference,
        {
            secret: getInternalAuthSecret(),
            guildId: input.guildId,
            rosterId: input.rosterId as any,
            memberIdsInMeetingChannel: input.memberIdsInMeetingChannel,
        }
    )) as {
        matchedVoiceCount: number
        rosteredCount: number
        updatedCount: number
        updatedUserIds: string[]
    }
}

export async function requestMeetingAttendanceConfirmation(input: {
    guildId: string
    rosterId: string
}) {
    return String(
        await fetchMutation(requestMeetingAttendanceConfirmationReference, {
            secret: getInternalAuthSecret(),
            guildId: input.guildId,
            rosterId: input.rosterId as never,
        })
    )
}

export async function getMeetingAttendanceRequest(requestId: string) {
    return (await fetchQuery(getMeetingAttendanceRequestReference, {
        secret: getInternalAuthSecret(),
        requestId: requestId as never,
    })) as {
        status: "pending" | "processing" | "completed" | "failed"
        error?: string
        result?: {
            matchedVoiceCount: number
            rosteredCount: number
            reserveCount: number
            updatedCount: number
            updatedUserIds: string[]
        }
    } | null
}
