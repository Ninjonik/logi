import {
    createResultRevision,
    type ResultDraft,
} from "../../domain/match-results/result-revision"
import { confirmResult, type ResultPorts } from "./confirm-result"
import assert from "node:assert/strict"
import test from "node:test"
const draft: ResultDraft = {
    origin: "manual",
    participants: [
        { id: "a", label: "A", score: 0 },
        { id: "b", label: "B", score: null },
    ],
    players: [],
    sessionLinks: [],
}
const actor = { id: "reviewer", kind: "session" as const },
    now = "2026-09-29T10:00:00.000Z"
test("confirmation rechecks authorization, source and player proof before append", async () => {
    const calls: string[] = []
    const current = createResultRevision({
        previous: null,
        expectedRevision: 0,
        draft,
        action: "stage",
        actor,
        now,
    })
    const ports: ResultPorts = {
        authorize: async () => {
            calls.push("authorize")
        },
        current: async () => current,
        draft: async () => {
            throw new Error("No edits during confirmation")
        },
        refresh: async (value) => {
            calls.push("refresh")
            return value
        },
        append: async (expected, value) => {
            assert.equal(expected, 1)
            calls.push("append")
            return value
        },
        now: () => now,
    }
    const result = await confirmResult(
        {
            eventId: "event",
            expectedRevision: 1,
            action: "confirm",
            sessionLinks: [],
            actor,
        },
        ports
    )
    assert.equal(result.status, "confirmed")
    assert.deepEqual(calls, ["authorize", "refresh", "authorize", "append"])
    ports.authorize = async () => {
        throw new Error("Forbidden")
    }
    await assert.rejects(
        confirmResult(
            {
                eventId: "event",
                expectedRevision: 1,
                action: "confirm",
                sessionLinks: [],
                actor,
            },
            ports
        )
    )
    assert.equal(calls.filter((v) => v === "append").length, 1)
})
