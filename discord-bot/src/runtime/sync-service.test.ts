import { DurableDelivery } from "./durable-delivery"
import assert from "node:assert/strict"
import test from "node:test"

import { DiscordSyncService, interactiveFlushDelay } from "./sync-service"
import { boardConfig } from "../events/board-example.fixture"
import { ConvexReactClient } from "convex/react"
import type { EventSyncIndex } from "../types"
import type { Client } from "discord.js"

test("interactive sync flushes immediately when the bot is idle", () => {
    assert.equal(
        interactiveFlushDelay({
            isFlushing: false,
            hasScheduledFlush: false,
        }),
        0
    )
})

test("interactive sync briefly coalesces clicks during pending or active work", () => {
    assert.equal(
        interactiveFlushDelay({
            isFlushing: false,
            hasScheduledFlush: true,
        }),
        250
    )
    assert.equal(
        interactiveFlushDelay({
            isFlushing: true,
            hasScheduledFlush: false,
        }),
        250
    )
})

// Exercise actual flush scheduling without live Discord/Convex operations.
function flushHarness() {
    const service = new DiscordSyncService({} as Client)
    const control = service as unknown as {
        queuedEventIds: Set<string>
        flush(): Promise<void>
        syncEvent(
            id: string,
            queued: Set<string>,
            attendance: boolean,
            signup: boolean
        ): Promise<string | undefined>
        syncGuildCalendar(guildId: string): Promise<void>
    }
    return { service, control }
}

test("one cycle refreshes each affected clan calendar once after all event effects", async () => {
    const { service, control } = flushHarness()
    const order: string[] = []
    control.syncEvent = async (id) => {
        order.push(id)
        return id.startsWith("a") ? "clan-a" : "clan-b"
    }
    control.syncGuildCalendar = async (guildId) => {
        order.push(guildId)
    }
    for (let i = 0; i < 100; i++) service.queueEventSync(`a${i}`)
    service.queueEventSync("b0")
    await control.flush()
    assert.deepEqual(order.slice(-2), ["clan-a", "clan-b"])
    assert.equal(order.filter((id) => id.startsWith("clan-")).length, 2)
    assert.equal(order.length, 103)
})

test("events arriving during a flush retain their own effects and subsequent calendar refresh", async () => {
    const { service, control } = flushHarness()
    const order: string[] = []
    control.syncEvent = async (id) => {
        order.push(id)
        if (id === "first") service.queueEventSync("second")
        return "clan-a"
    }
    control.syncGuildCalendar = async (guild) => {
        order.push(guild)
    }
    service.queueEventSync("first")
    await control.flush()
    assert.deepEqual(order, ["first", "clan-a", "second", "clan-a"])
})

test("one calendar failure cannot discard another clan or newly queued work", async () => {
    const { service, control } = flushHarness()
    const events: string[] = []
    const calendars: string[] = []
    control.syncEvent = async (id) => {
        events.push(id)
        return id
    }
    control.syncGuildCalendar = async (id) => {
        calendars.push(id)
        if (id === "a") {
            service.queueEventSync("c")
            throw new Error("backend unavailable")
        }
    }
    service.queueEventSync("a")
    service.queueEventSync("b")
    await control.flush()
    assert.deepEqual(events, ["a", "b", "c"])
    assert.deepEqual(calendars, ["a", "b", "c"])
})

test("calendar contexts use a guild index, bounded reads and fresh data on the next pass", async (t) => {
    // The paused policy prevents Discord output after all contexts have loaded.
    t.mock.method(ConvexReactClient.prototype, "query", async () => ({
        paused: true,
    }))
    const service = new DiscordSyncService({} as Client)
    const control = service as unknown as {
        applyEventIndex(index: EventSyncIndex, initial: boolean): void
        guildCache: { get(id: string): unknown }
        loadEventSyncContext(id: string): Promise<null>
        syncGuildCalendar(id: string, requested?: boolean): Promise<void>
    }
    control.guildCache.get = () => ({ config: boardConfig })
    const events: EventSyncIndex["events"] = Array.from(
        { length: 20 },
        (_, i) => ({
            id: `event-${i}`,
            guildId: i < 12 ? "a" : "b",
            status: "registration",
            gameEnd: "2099-01-01T00:00:00Z",
            updatedAt: "1",
        })
    )
    control.applyEventIndex({ events, rosters: [] }, false)
    let active = 0,
        maximum = 0
    const reads: string[] = []
    control.loadEventSyncContext = async (id) => {
        reads.push(id)
        active++
        maximum = Math.max(maximum, active)
        await new Promise<void>((resolve) => setImmediate(resolve))
        active--
        return null
    }
    // Explicit refresh bypasses the unrelated target-configuration check.
    await control.syncGuildCalendar("a", true)
    assert.equal(reads.length, 12)
    assert.ok(reads.every((id) => Number(id.slice(6)) < 12))
    assert.equal(maximum, 4)
    await control.syncGuildCalendar("a", true)
    assert.equal(reads.length, 24, "no stale cross-cycle context cache")
    control.applyEventIndex({ events: events.slice(12), rosters: [] }, false)
    await control.syncGuildCalendar("a", true)
    assert.equal(reads.length, 24, "removed events leave the guild index")
})

test("stopping sync waits for the active cycle and cannot rearm after it settles", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const { service, control } = flushHarness()
    let finish!: () => void
    const active = new Promise<void>((resolve) => {
        finish = resolve
    })
    let calls = 0,
        drained = false
    control.syncEvent = async () => {
        calls++
        await active
        return undefined
    }
    service.queueEventSync("one")
    service.triggerInteractiveFlush()
    t.mock.timers.tick(1)
    for (let i = 0; i < 4; i++) await Promise.resolve()
    const stopping = service.stop().then(() => {
        drained = true
    })
    service.queueEventSync("two")
    service.triggerInteractiveFlush()
    await Promise.resolve()
    assert.equal(calls, 1)
    assert.equal(drained, false)
    finish()
    await stopping
    t.mock.timers.tick(5000)
    assert.equal(calls, 1)
})

test("durable dispatch acknowledges only after the actual queued work finishes", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const { service, control } = flushHarness()
    const order: string[] = []
    let finish!: () => void
    const active = new Promise<void>((resolve) => {
        finish = resolve
    })
    control.syncEvent = async () => {
        order.push("sync")
        await active
        return undefined
    }
    const extra = service as unknown as {
        runScheduledReminders(): Promise<void>
    }
    extra.runScheduledReminders = async () => {
        order.push("recipients")
    }
    let acknowledged = false
    const work = service
        .enqueueScheduled(
            "event",
            "signup-reminder",
            new DurableDelivery({
                kind: "dispatch",
                id: "dispatch",
                token: "owner",
            }),
            "2026-11-12T12:00:00Z"
        )
        .then(() => {
            acknowledged = true
            order.push("ack")
        })
    t.mock.timers.tick(1)
    for (let i = 0; i < 5; i++) await Promise.resolve()
    assert.equal(acknowledged, false)
    finish()
    await work
    assert.deepEqual(order, ["sync", "recipients", "ack"])
    await service.stop()
})

test("failed or stopped main-process work rejects the durable acknowledgment", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    const { service, control } = flushHarness()
    control.syncEvent = async () => {
        throw new Error("Discord unavailable")
    }
    const delivery = new DurableDelivery({
        kind: "dispatch",
        id: "dispatch",
        token: "owner",
    })
    const work = service.enqueueScheduled(
        "event",
        "refresh-announcement",
        delivery,
        "2026-11-12T12:00:00Z"
    )
    const rejected = assert.rejects(work, /Discord unavailable/)
    t.mock.timers.tick(1)
    await rejected
    const queued = service.enqueueScheduled(
        "second",
        "refresh-announcement",
        delivery,
        "2026-11-12T12:00:00Z"
    )
    const stopped = assert.rejects(queued, /stopped before dispatch/)
    await service.stop()
    await stopped
})
