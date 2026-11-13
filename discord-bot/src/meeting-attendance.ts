import { TaskOwner } from "./runtime/task-owner"
import type { Client } from "discord.js"

import { getMeetingChannelMemberIds } from "./meeting-attendance-members"
import { logError, logInfo, logWarn } from "./log"
import { convex, references } from "./convex"
import { env } from "./environment"

type PendingRequest = {
    _id: string
    guildId: string
    rosterId: string
    rosterUserIds: string[]
    meetingChannelId: string
}

type AttendanceResult = {
    matchedVoiceCount: number
    rosteredCount: number
    reserveCount: number
    updatedCount: number
    updatedUserIds: string[]
}

/** Handles dashboard-triggered requests using fresh REST reads of roster candidates only. */
export class MeetingAttendanceRequestService {
    private readonly tasks = new TaskOwner()
    private unsubscribe?: () => void
    private readonly processingRequestIds = new Set<string>()

    constructor(private readonly client: Client) {}

    start() {
        return this.tasks.run(() => this.initialize())
    }

    private async initialize() {
        if (this.tasks.stopped) return
        const watch = convex.watchQuery(
            references.listPendingMeetingAttendanceRequests,
            { secret: env.internalSecret }
        )
        this.unsubscribe = watch.onUpdate(() => {
            const requests = watch.localQueryResult() as
                PendingRequest[] | undefined
            if (requests)
                void this.tasks
                    .run(() => this.processRequests(requests))
                    .catch((error) =>
                        logError("request-worker", "Request batch failed", {
                            error,
                        })
                    )
        })

        const requests = (await convex.query(
            references.listPendingMeetingAttendanceRequests,
            { secret: env.internalSecret }
        )) as PendingRequest[]
        await this.processRequests(requests)
        logInfo("meeting-attendance", "Started meeting attendance requests")
    }

    stop() {
        this.unsubscribe?.()
        this.unsubscribe = undefined
        return this.tasks.stop()
    }

    private async processRequests(requests: PendingRequest[]) {
        for (const request of requests) {
            if (this.tasks.stopped) break
            if (this.processingRequestIds.has(request._id)) continue
            this.processingRequestIds.add(request._id)
            void this.tasks
                .run(() => this.processRequest(request))
                .catch((error) =>
                    logError("meeting-attendance", "Attendance task failed", {
                        error,
                    })
                )
                .finally(() => {
                    this.processingRequestIds.delete(request._id)
                })
        }
    }

    private async processRequest(request: PendingRequest) {
        let claimed: PendingRequest | null
        try {
            claimed = (await convex.mutation(
                references.claimMeetingAttendanceRequest,
                { secret: env.internalSecret, requestId: request._id as never }
            )) as PendingRequest | null
        } catch (error) {
            logError(
                "meeting-attendance",
                "Failed to claim attendance request",
                {
                    requestId: request._id,
                    error,
                }
            )
            return
        }
        if (!claimed) return

        try {
            const memberIdsInMeetingChannel = await getMeetingChannelMemberIds(
                this.client,
                claimed.guildId,
                claimed.meetingChannelId,
                claimed.rosterUserIds
            )
            const result = (await convex.mutation(
                references.confirmRosterAttendanceFromMeetingChannel,
                {
                    secret: env.internalSecret,
                    guildId: claimed.guildId,
                    rosterId: claimed.rosterId as never,
                    memberIdsInMeetingChannel,
                    expectedMeetingChannelId: claimed.meetingChannelId,
                    requestId: claimed._id as never,
                }
            )) as AttendanceResult
            await convex.mutation(references.completeMeetingAttendanceRequest, {
                secret: env.internalSecret,
                requestId: claimed._id as never,
                result,
            })
            logInfo("meeting-attendance", "Confirmed meeting attendance", {
                guildId: claimed.guildId,
                rosterId: claimed.rosterId,
                matchedVoiceCount: result.matchedVoiceCount,
                updatedCount: result.updatedCount,
            })
        } catch (error) {
            const message =
                "The bot could not read the configured meeting channel."
            logWarn("meeting-attendance", message, {
                guildId: claimed.guildId,
                rosterId: claimed.rosterId,
                error,
            })
            await convex
                .mutation(references.failMeetingAttendanceRequest, {
                    secret: env.internalSecret,
                    requestId: claimed._id as never,
                    error: message,
                })
                .catch((completionError) =>
                    logError(
                        "meeting-attendance",
                        "Failed to record meeting attendance request failure",
                        { error: completionError }
                    )
                )
        }
    }
}
