import { normalizeEventRecord } from "@/domain/events/normalization"
import { upsertNotice } from "@/domain/events/notice-policy"
import type { Clock } from "@/application/ports/clock"

import type { EventWorkflowRepository } from "./ports"

export class UpsertNoticeUseCase {
    constructor(
        private readonly events: EventWorkflowRepository,
        private readonly clock: Clock
    ) {}

    async execute(input: { eventId: string; userId: string; reason: string }) {
        const event = await this.events.getById(input.eventId)
        if (!event) {
            throw new Error("Event not found.")
        }

        const now = this.clock.now()
        const normalizedEvent = normalizeEventRecord(event, now)
        const reservePlayerIds = await this.events.getReservePlayerIds(
            input.eventId
        )
        const absenceNotices = upsertNotice({
            event: {
                gameStart:
                    normalizedEvent.gameStart ?? normalizedEvent.meetingStart,
                status: normalizedEvent.status,
                participants: normalizedEvent.participants,
                reservePlayerIds,
                absenceNotices: normalizedEvent.absenceNotices,
            },
            userId: input.userId,
            reason: input.reason,
            now,
        })

        await this.events.saveAbsenceNotices(input.eventId, {
            absenceNotices,
            updatedAt: now.toISOString(),
        })

        return { ok: true as const }
    }
}
