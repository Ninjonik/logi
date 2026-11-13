import { startConvexWorkSignal } from "./convex-work-signal"
import { ConvexReactClient } from "convex/react"
import { Events, type Client } from "discord.js"
import { closeConvexClient } from "../convex"
import { EventEmitter } from "node:events"
import assert from "node:assert/strict"
import test from "node:test"

test("gateway recovery wakes unchanged durable work and stopping removes its listeners", async (t) => {
    t.after(closeConvexClient)
    const head = { key: "pending", dueAt: 0 }
    t.mock.method(ConvexReactClient.prototype, "watchQuery", () => ({
        localQueryResult: () => head,
        onUpdate: () => () => {},
    }))
    let reads = 0,
        ready = false,
        completed = 0
    t.mock.method(ConvexReactClient.prototype, "query", async () => {
        reads++
        return head
    })
    const events = new EventEmitter()
    const stop = startConvexWorkSignal(
        "team",
        async () => {
            if (ready) completed++
        },
        (error) => assert.fail(String(error)),
        events as unknown as Client
    )
    for (let i = 0; i < 20; i++) await Promise.resolve()
    assert.equal(completed, 0)
    ready = true
    events.emit(Events.ShardResume)
    for (let i = 0; i < 20; i++) await Promise.resolve()
    assert.equal(completed, 1)
    assert.equal(reads, 1)
    await stop()
    assert.equal(events.listenerCount(Events.ShardResume), 0)
    assert.equal(events.listenerCount(Events.ShardReady), 0)
    events.emit(Events.ShardResume)
    for (let i = 0; i < 20; i++) await Promise.resolve()
    assert.equal(reads, 1)
})
