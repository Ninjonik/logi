import { ManualReminderRequestService } from "./manual-reminders"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import type { Client } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

test("manual reminder shutdown drains a claimed request and rejects late watch intake", async (t) => {
    const request = {
        id: "request",
        guildId: "guild",
        eventId: "event",
        audience: "unanswered",
        recipientIds: [],
        claimToken: "owner",
    }
    let update: () => void = () => {},
        unsubscribed = false,
        claims = 0,
        failures = 0
    t.mock.method(ConvexReactClient.prototype, "watchQuery", () => ({
        onUpdate: (callback: () => void) => {
            update = callback
            return () => {
                unsubscribed = true
            }
        },
        localQueryResult: () => [request],
    }))
    t.mock.method(ConvexReactClient.prototype, "query", async () => [request])
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            if (getFunctionName(reference) === "eventReminders:claim") {
                claims++
                return request
            }
            failures++
            return null
        }
    )
    let finish!: () => void
    const active = new Promise<void>((resolve) => {
        finish = resolve
    })
    const service = new ManualReminderRequestService({} as Client, async () => {
        await active
        return null
    })
    const started = service.start()
    for (let i = 0; i < 8; i++) await Promise.resolve()
    let drained = false
    const stopping = service.stop().then(() => {
        drained = true
    })
    update()
    await Promise.resolve()
    assert.equal(unsubscribed, true)
    assert.equal(drained, false)
    assert.equal(claims, 1)
    finish()
    await Promise.all([started, stopping])
    assert.equal(
        failures,
        1,
        "claimed failure is recorded before drain completes"
    )
})
