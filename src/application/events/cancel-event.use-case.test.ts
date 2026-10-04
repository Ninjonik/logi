import type {
    EventCommandRecord,
    EventCommandRepository,
} from "./command-ports"
import { CancelEventUseCase } from "./cancel-event.use-case"
import assert from "node:assert/strict"
import test from "node:test"

const now = new Date("2026-10-03T12:00:00.000Z")
const event: EventCommandRecord = {
    id: "event-1",
    registrationEnd: "2026-10-03T12:00:00.000Z",
    meetingStart: "2026-10-03T13:00:00.000Z",
    gameEnd: "2026-10-03T14:00:00.000Z",
    status: "starting",
}

test("cancellation preserves the planned schedule and permanently skips participation scores", async () => {
    const patches: Array<
        Parameters<EventCommandRepository["updateStatus"]>[1]
    > = []
    const result = await new CancelEventUseCase(
        {
            getById: async () => event,
            updateStatus: async (id, patch) => {
                assert.equal(id, event.id)
                patches.push(patch)
            },
        },
        { now: () => now }
    ).execute(event.id)
    assert.deepEqual(result, { ok: true })
    assert.deepEqual(patches, [
        {
            status: "concluded",
            statusUpdatedAt: now.toISOString(),
            concludedAt: now.toISOString(),
            scoreResolution: "skipped",
            updatedAt: now.toISOString(),
        },
    ])
})

test("cancellation rejects missing, ended, started and invalid-clock events before writing", async () => {
    for (const stored of [
        null,
        { ...event, status: "concluded" as const },
        { ...event, meetingStart: now.toISOString() },
        { ...event, meetingStart: "2026-10-02T12:00:00.000Z" },
        { ...event, meetingStart: "invalid" },
    ]) {
        let writes = 0
        await assert.rejects(
            new CancelEventUseCase(
                {
                    getById: async () => stored,
                    updateStatus: async () => {
                        writes++
                    },
                },
                { now: () => now }
            ).execute(event.id)
        )
        assert.equal(writes, 0)
    }
})
