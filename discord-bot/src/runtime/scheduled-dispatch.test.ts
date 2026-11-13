import { startScheduledDispatch } from "./scheduled-dispatch"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import assert from "node:assert/strict"
import test from "node:test"

test("dispatch shutdown finishes the active acknowledgment and claims no new work", async (t) => {
    let claims = 0,
        acknowledged = 0,
        processing = false
    let finish!: () => void
    const active = new Promise<void>((resolve) => {
        finish = resolve
    })
    const row = {
        id: "dispatch",
        eventId: "event",
        guildId: "guild",
        kind: "refresh-announcement",
        claimToken: "owner",
        dueAt: "2026-11-12T12:00:00Z",
        changedEventIds: ["event"],
        scoreEventIds: [],
    }
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            switch (getFunctionName(reference)) {
                case "discordScheduledDispatch:claim":
                    claims++
                    return row
                case "discordRequestRecovery:heartbeat":
                    return true
                case "discordScheduledDispatch:acknowledge":
                    acknowledged++
                    return null
                default:
                    throw new Error("Unexpected mutation")
            }
        }
    )
    const stop = startScheduledDispatch(async () => {
        processing = true
        await active
    })
    for (let i = 0; i < 12; i++) await Promise.resolve()
    assert.equal(processing, true)
    let drained = false
    const stopping = stop().then(() => {
        drained = true
    })
    await Promise.resolve()
    assert.equal(drained, false)
    assert.equal(acknowledged, 0)
    finish()
    await stopping
    assert.equal(acknowledged, 1)
    assert.equal(claims, 1)
})
