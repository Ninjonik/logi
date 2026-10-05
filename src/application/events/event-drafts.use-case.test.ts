import assert from "node:assert/strict"
import test from "node:test"

import { FakeClock } from "@/infrastructure/testing/fake-clock"

import {
    EventDraftsUseCase,
    type EventDraftRecord,
    type EventDraftRepository,
    type EventDraftWrite,
} from "./event-drafts.use-case"

class InMemoryDrafts implements EventDraftRepository {
    readonly rows = new Map<string, EventDraftWrite & { guildId: string }>()
    private next = 1

    async getById(eventId: string): Promise<EventDraftRecord | null> {
        const row = this.rows.get(eventId)
        return row
            ? {
                  id: eventId,
                  guildId: row.guildId,
                  isDraft: row.isDraft,
                  createdAt: row.createdAt,
              }
            : null
    }
    async create(record: EventDraftWrite) {
        const id = `event-${this.next++}`
        this.rows.set(id, record)
        return id
    }
    async replace(eventId: string, record: EventDraftWrite) {
        this.rows.set(eventId, record)
    }
    async remove(eventId: string) {
        this.rows.delete(eventId)
    }
}

const input = {
    guildId: "guild-1",
    kind: "match" as const,
    name: "VLK vs ROG · Friendly",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    gameEnd: "2026-10-11T19:30:00.000Z",
    pingClan: true,
    signupGroupIds: ["g-inf", "g-tanks"],
    signupGroupLimits: [
        { groupId: "g-tanks", max: 6 },
        // Not an offered group: dropped.
        { groupId: "g-other", max: 2 },
    ],
    attendanceReminderHours: [12, 24, 7],
    createParticipantRoles: false,
}

test("a saved draft is a complete event flagged as a draft", async () => {
    const events = new InMemoryDrafts()
    const drafts = new EventDraftsUseCase(
        events,
        new FakeClock(new Date("2026-10-05T10:00:00.000Z"))
    )
    const result = await drafts.save(input)
    assert.equal(result.ok, true)
    const row = result.ok ? events.rows.get(result.eventId) : undefined
    assert.equal(row?.isDraft, true)
    assert.equal(row?.name, input.name)
    assert.deepEqual(row?.signupGroupLimits, [{ groupId: "g-tanks", max: 6 }])
    assert.deepEqual(row?.attendanceReminderHours, [24, 12])
    assert.equal(row?.createParticipantRoles, false)
})

test("saving over a draft keeps its start day and publishing clears the flag", async () => {
    const events = new InMemoryDrafts()
    const clock = new FakeClock(new Date("2026-10-05T10:00:00.000Z"))
    const drafts = new EventDraftsUseCase(events, clock)
    const created = await drafts.save(input)
    assert.ok(created.ok)
    clock.set(new Date("2026-10-06T10:00:00.000Z"))
    await drafts.save({ ...input, eventId: created.eventId, name: "Renamed" })
    const saved = events.rows.get(created.eventId)
    assert.equal(saved?.name, "Renamed")
    assert.equal(saved?.createdAt, "2026-10-05T10:00:00.000Z")

    const published = await drafts.publish({
        ...input,
        eventId: created.eventId,
    })
    assert.deepEqual(published, { ok: true, eventId: created.eventId })
    const row = events.rows.get(created.eventId)
    assert.equal(row?.isDraft, undefined)
    // A published event starts fresh, like a direct create.
    assert.equal(row?.createdAt, "2026-10-06T10:00:00.000Z")
    assert.equal(row?.status, "registration")
})

test("publishing without a draft creates the event directly", async () => {
    const events = new InMemoryDrafts()
    const drafts = new EventDraftsUseCase(
        events,
        new FakeClock(new Date("2026-10-05T10:00:00.000Z"))
    )
    const result = await drafts.publish(input)
    assert.ok(result.ok)
    assert.equal(events.rows.get(result.eventId)?.isDraft, undefined)
})

test("published events and other clans' drafts cannot be touched", async () => {
    const events = new InMemoryDrafts()
    const drafts = new EventDraftsUseCase(
        events,
        new FakeClock(new Date("2026-10-05T10:00:00.000Z"))
    )
    const published = await drafts.publish(input)
    assert.ok(published.ok)
    assert.deepEqual(
        await drafts.save({ ...input, eventId: published.eventId }),
        { ok: false, error: "not_draft" }
    )
    assert.deepEqual(
        await drafts.remove({ guildId: "guild-1", eventId: published.eventId }),
        { ok: false, error: "not_draft" }
    )
    const draft = await drafts.save(input)
    assert.ok(draft.ok)
    assert.deepEqual(
        await drafts.remove({ guildId: "guild-2", eventId: draft.eventId }),
        { ok: false, error: "not_found" }
    )
    assert.deepEqual(
        await drafts.publish({
            ...input,
            guildId: "guild-2",
            eventId: draft.eventId,
        }),
        { ok: false, error: "not_found" }
    )
    assert.deepEqual(
        await drafts.remove({ guildId: "guild-1", eventId: draft.eventId }),
        { ok: true, eventId: draft.eventId }
    )
    assert.equal(events.rows.has(draft.eventId), false)
})
