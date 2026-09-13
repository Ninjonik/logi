import { NextResponse } from "next/server"

import {
    getMeetingAttendanceRequest,
    requestMeetingAttendanceConfirmation,
} from "@/lib/server-discord-settings"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { logNextError, logNextInfo } from "@/lib/system-logs"
import { getServerContext } from "@/lib/server-context"
import { handleIfNotLoggedIn } from "@/lib/auth"

const BOT_RESPONSE_TIMEOUT_MS = 12_000
const BOT_RESPONSE_POLL_MS = 250

export async function POST(
    _request: Request,
    context: { params: Promise<{ serverId: string; rosterId: string }> }
) {
    const { serverId, rosterId } = await context.params
    await handleIfNotLoggedIn(
        `/dashboard/servers/${serverId}/rosters/${rosterId}`
    )

    const serverContext = await getServerContext(serverId)
    if (!serverContext?.canAdmin) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    try {
        const roster = serverContext.rosters.find(
            (item) => item.id === rosterId
        )
        const meetingChannelId = serverContext.discordConfig?.meetingChannelId
        if (!roster || !meetingChannelId)
            throw new Error("Meeting channel is not configured.")
        const requestId = await requestMeetingAttendanceConfirmation({
            guildId: serverContext.server.discordId,
            rosterId,
        })
        const result = await waitForMeetingAttendanceResult(requestId)

        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.rosters(serverId),
            appCacheTags.roster(rosterId),
            roster?.eventId
                ? appCacheTags.rosterImageEvent(roster.eventId)
                : undefined,
        ])

        logNextInfo(
            "confirm-meeting-attendance",
            "Confirmed roster attendance from meeting channel",
            {
                serverId,
                rosterId,
                userId: serverContext.user.discordId,
            }
        )
        return NextResponse.json(result)
    } catch (error) {
        logNextError(
            "confirm-meeting-attendance",
            "Failed to confirm meeting attendance",
            {
                serverId,
                rosterId,
                error,
            }
        )
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to confirm attendance.",
            },
            { status: 500 }
        )
    }
}

async function waitForMeetingAttendanceResult(requestId: string) {
    const deadline = Date.now() + BOT_RESPONSE_TIMEOUT_MS
    while (Date.now() < deadline) {
        const request = await getMeetingAttendanceRequest(requestId)
        if (request?.status === "completed" && request.result) {
            return request.result
        }
        if (request?.status === "failed") {
            throw new Error(
                request.error ?? "The bot could not read the meeting channel."
            )
        }
        await new Promise((resolve) =>
            setTimeout(resolve, BOT_RESPONSE_POLL_MS)
        )
    }
    throw new Error("The bot did not respond in time. Please try again.")
}
