import {
    buildCreateEventRecord,
    type EventUpsertInput,
} from "@/domain/events/upsert-policy"
import {
    eventDraftActionError,
    type EventDraftError,
} from "@/domain/events/drafts"
import type { Clock } from "@/application/ports/clock"

export type EventDraftRecord = {
    id: string
    guildId: string
    isDraft?: boolean
    createdAt?: string
}

export type EventDraftWrite = ReturnType<typeof buildCreateEventRecord> & {
    isDraft?: true
}

export interface EventDraftRepository {
    getById(eventId: string): Promise<EventDraftRecord | null>
    create(record: EventDraftWrite): Promise<string>
    /** Replaces the whole stored event, keeping its ID. */
    replace(eventId: string, record: EventDraftWrite): Promise<void>
    remove(eventId: string): Promise<void>
}

export type EventDraftResult =
    { ok: true; eventId: string } | { ok: false; error: EventDraftError }

type DraftInput = EventUpsertInput & { eventId?: string }

/**
 * Drafts of the new-match flow (design D2). A draft is a complete event
 * record with `isDraft: true`; saving replaces it as a whole, publishing
 * replaces it with exactly the record a direct create would store (fresh
 * status, timestamps and no draft flag), and deleting removes it. Only a
 * draft of the caller's clan can be overwritten, published or deleted.
 */
export class EventDraftsUseCase {
    constructor(
        private readonly events: EventDraftRepository,
        private readonly clock: Clock
    ) {}

    async save(input: DraftInput): Promise<EventDraftResult> {
        const record = buildCreateEventRecord(input, this.clock.now())
        if (!input.eventId)
            return {
                ok: true,
                eventId: await this.events.create({ ...record, isDraft: true }),
            }
        const existing = await this.events.getById(input.eventId)
        const error = eventDraftActionError(existing, input.guildId)
        if (error || !existing)
            return { ok: false, error: error ?? "not_found" }
        await this.events.replace(input.eventId, {
            ...record,
            isDraft: true,
            // The draft keeps the day it was started.
            createdAt: existing.createdAt ?? record.createdAt,
        })
        return { ok: true, eventId: input.eventId }
    }

    async publish(input: DraftInput): Promise<EventDraftResult> {
        const record = buildCreateEventRecord(input, this.clock.now())
        if (!input.eventId)
            return { ok: true, eventId: await this.events.create(record) }
        const existing = await this.events.getById(input.eventId)
        const error = eventDraftActionError(existing, input.guildId)
        if (error) return { ok: false, error }
        await this.events.replace(input.eventId, record)
        return { ok: true, eventId: input.eventId }
    }

    async remove(input: {
        guildId: string
        eventId: string
    }): Promise<EventDraftResult> {
        const existing = await this.events.getById(input.eventId)
        const error = eventDraftActionError(existing, input.guildId)
        if (error) return { ok: false, error }
        await this.events.remove(input.eventId)
        return { ok: true, eventId: input.eventId }
    }
}
