import type { EventCommandRepository } from "./command-ports"
import type { Clock } from "@/application/ports/clock"

/** Explicit pre-meeting cancellation, separate from post-start conclusion/scoring. */
export class CancelEventUseCase {
    constructor(
        private readonly events: Pick<
            EventCommandRepository,
            "getById" | "updateStatus"
        >,
        private readonly clock: Clock
    ) {}

    async execute(eventId: string) {
        const event = await this.events.getById(eventId)
        if (!event) throw new Error("Event not found.")
        const now = this.clock.now()
        const meetingStart = Date.parse(event.meetingStart ?? "")
        if (
            event.status === "concluded" ||
            !Number.isFinite(meetingStart) ||
            now.getTime() >= meetingStart
        )
            throw new Error("Only an upcoming event can be cancelled.")
        const at = now.toISOString()
        await this.events.updateStatus(eventId, {
            status: "concluded",
            statusUpdatedAt: at,
            concludedAt: at,
            scoreResolution: "skipped",
            updatedAt: at,
        })
        return { ok: true as const }
    }
}
