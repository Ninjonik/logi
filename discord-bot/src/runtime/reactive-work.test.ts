import { startReactiveWork, type WorkSignal } from "./reactive-work"
import assert from "node:assert/strict"
import test from "node:test"

const settle = async () => {
    for (let i = 0; i < 20; i++) await Promise.resolve()
}

test("a broken failure reporter cannot strand or reject a worker timer", async (t) => {
    let warnings = 0
    t.mock.method(console, "warn", () => {
        warnings++
    })
    const stop = startReactiveWork({
        watch: () => ({
            localQueryResult: () => ({ key: "due", dueAt: 0 }),
            onUpdate: () => () => {},
        }),
        read: async () => null,
        run: async () => {
            throw new Error("work failed")
        },
        failed: () => {
            throw new Error("logger failed")
        },
    })
    await settle()
    await stop()
    assert.equal(warnings, 1)
})

test("stop before queued admission prevents both claims and startup reads", async () => {
    let runs = 0,
        reads = 0
    const stop = startReactiveWork({
        watch: () => ({
            localQueryResult: () => ({ key: "due", dueAt: 0 }),
            onUpdate: () => () => {},
        }),
        read: async () => {
            reads++
            return null
        },
        run: async () => {
            runs++
        },
        failed: (error) => assert.fail(String(error)),
    })
    await stop()
    assert.equal(runs, 0)
    assert.equal(reads, 0)
})

test("changed due pages drain sequentially without waiting for the safety check", async () => {
    let head: WorkSignal | null = { key: "page-0", dueAt: 0 },
        update = () => {},
        runs = 0,
        active = 0,
        maximum = 0
    const stop = startReactiveWork({
        watch: () => ({
            localQueryResult: () => head,
            onUpdate: (callback) => {
                update = callback
                return () => {}
            },
        }),
        read: async () => head,
        run: async () => {
            runs++
            active++
            maximum = Math.max(maximum, active)
            head = runs < 3 ? { key: `page-${runs}`, dueAt: 0 } : null
            update()
            await Promise.resolve()
            active--
        },
        failed: (error) => assert.fail(String(error)),
    })
    await settle()
    assert.equal(runs, 3)
    assert.equal(maximum, 1)
    await stop()
})

test("idle reactive workers do no work and new records wake immediately without a poll", async (t) => {
    t.mock.timers.enable({
        apis: ["Date", "setTimeout", "setInterval"],
        now: 1000,
    })
    let head: WorkSignal | null = null,
        update = () => {},
        runs = 0,
        reads = 0,
        unsubscribed = false
    const stop = startReactiveWork({
        watch: () => ({
            localQueryResult: () => head,
            onUpdate: (callback) => {
                update = callback
                return () => {
                    unsubscribed = true
                }
            },
        }),
        read: async () => {
            reads++
            return head
        },
        run: async () => {
            runs++
        },
        failed: (error) => assert.fail(String(error)),
    })
    t.mock.timers.tick(299_999)
    await settle()
    assert.equal(runs, 0)
    assert.equal(reads, 0)
    head = { key: "new-work", dueAt: Date.now() }
    update()
    await settle()
    assert.equal(runs, 1)
    update()
    await settle()
    assert.equal(runs, 1, "unchanged snapshots must not repeat a due pass")
    head = null
    update()
    t.mock.timers.tick(1)
    await settle()
    assert.equal(reads, 1, "slow safety check reads only the queue head")
    assert.equal(runs, 1)
    await stop()
    assert.equal(unsubscribed, true)
    t.mock.timers.tick(600_000)
    await settle()
    assert.equal(reads, 1)
})

test("future deadlines, earlier replacements and lease expiry wake at their exact due time", async (t) => {
    t.mock.timers.enable({
        apis: ["Date", "setTimeout", "setInterval"],
        now: 1000,
    })
    let head: WorkSignal | null = { key: "lease", dueAt: 6000 },
        update = () => {},
        runs = 0
    const stop = startReactiveWork({
        watch: () => ({
            localQueryResult: () => head,
            onUpdate: (callback) => {
                update = callback
                return () => {}
            },
        }),
        read: async () => head,
        run: async () => {
            runs++
        },
        failed: (error) => assert.fail(String(error)),
    })
    t.mock.timers.tick(1000)
    await settle()
    assert.equal(runs, 0)
    head = { key: "earlier", dueAt: 3000 }
    update()
    t.mock.timers.tick(999)
    await settle()
    assert.equal(runs, 0)
    t.mock.timers.tick(1)
    await settle()
    assert.equal(runs, 1)
    head = null
    update()
    t.mock.timers.tick(10_000)
    await settle()
    assert.equal(runs, 1)
    await stop()
})

test("notification bursts cannot overlap work and stop drains the active pass without rearming", async (t) => {
    t.mock.timers.enable({
        apis: ["Date", "setTimeout", "setInterval"],
        now: 1000,
    })
    let head: WorkSignal = { key: "first", dueAt: 0 },
        update = () => {},
        runs = 0,
        finish = () => {}
    const held = new Promise<void>((resolve) => {
        finish = resolve
    })
    const stop = startReactiveWork({
        watch: () => ({
            localQueryResult: () => head,
            onUpdate: (callback) => {
                update = callback
                return () => {}
            },
        }),
        read: async () => head,
        run: async () => {
            runs++
            await held
        },
        failed: (error) => assert.fail(String(error)),
    })
    await settle()
    for (let i = 0; i < 50; i++) {
        head = { key: `burst-${i}`, dueAt: 0 }
        update()
    }
    await settle()
    assert.equal(runs, 1)
    let drained = false
    const stopping = stop().then(() => {
        drained = true
    })
    await settle()
    assert.equal(drained, false)
    finish()
    await stopping
    assert.equal(runs, 1)
    t.mock.timers.tick(600_000)
    await settle()
    assert.equal(runs, 1)
})

test("an old initial read cannot overwrite a newer subscription and failures back off", async (t) => {
    t.mock.timers.enable({
        apis: ["Date", "setTimeout", "setInterval"],
        now: 1000,
    })
    let head: WorkSignal | null | undefined = undefined,
        update = () => {},
        runs = 0
    let release!: (head: WorkSignal | null) => void
    let initial = true
    const warnings: unknown[] = []
    const stop = startReactiveWork({
        watch: () => ({
            localQueryResult: () => head,
            onUpdate: (callback) => {
                update = callback
                return () => {}
            },
        }),
        read: async () => {
            if (initial) {
                initial = false
                return new Promise<WorkSignal | null>((resolve) => {
                    release = resolve
                })
            }
            return head ?? null
        },
        run: async () => {
            runs++
            throw new Error("transient failure")
        },
        failed: (error) => {
            warnings.push(error)
        },
    })
    await settle()
    head = { key: "new", dueAt: 0 }
    update()
    await settle()
    release(null)
    await settle()
    assert.equal(runs, 1)
    t.mock.timers.tick(14_999)
    await settle()
    assert.equal(runs, 1)
    t.mock.timers.tick(1)
    await settle()
    assert.equal(runs, 2)
    assert.equal(warnings.length, 2)
    await stop()
})
