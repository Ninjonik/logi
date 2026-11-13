import { TaskOwner, startOwnedInterval } from "./task-owner"
import { BotLifecycle } from "./lifecycle"
import assert from "node:assert/strict"
import test from "node:test"

function deferred() {
    let resolve!: () => void
    const promise = new Promise<void>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

test("shutdown stops every producer before draining and closes clients last", async () => {
    const work = deferred()
    const order: string[] = []
    const lifecycle = new BotLifecycle(() => {})
    await lifecycle.start("a", () => () => {
        order.push("stop-a")
        return work.promise
    })
    await lifecycle.start("b", () => () => {
        order.push("stop-b")
    })
    const stopping = lifecycle.stop(async () => {
        order.push("close")
    })
    assert.deepEqual(order, ["stop-a", "stop-b"])
    await lifecycle.run(async () => {
        order.push("late work")
    })
    work.resolve()
    await stopping
    assert.deepEqual(order, ["stop-a", "stop-b", "close"])
    assert.equal(
        lifecycle.stop(async () => {
            order.push("second close")
        }),
        stopping
    )
})

test("late startup completion is stopped and drained before client closure", async () => {
    const startup = deferred(),
        active = deferred()
    const order: string[] = []
    const lifecycle = new BotLifecycle(() => {})
    const starting = lifecycle.start("slow", async () => {
        await startup.promise
        return async () => {
            order.push("stop-late")
            await active.promise
        }
    })
    await Promise.resolve()
    const stop = lifecycle.stop(async () => {
        order.push("close")
    })
    startup.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    assert.deepEqual(order, ["stop-late"])
    active.resolve()
    await Promise.all([stop, starting])
    assert.deepEqual(order, ["stop-late", "close"])
})

test("partial startup failure retains its registered cleanup and does not prevent other services", async () => {
    const failures: string[] = [],
        order: string[] = []
    const lifecycle = new BotLifecycle((name) => {
        failures.push(name)
    })
    await lifecycle.start(
        "broken",
        async () => {
            throw new Error("subscription failed")
        },
        () => {
            order.push("cleanup")
        }
    )
    await lifecycle.start("healthy", () => () => {
        order.push("healthy-stop")
    })
    await lifecycle.stop(async () => {
        order.push("close")
    })
    assert.deepEqual(failures, ["broken"])
    assert.deepEqual(order, ["cleanup", "healthy-stop", "close"])
})

test("a failed drain does not close clients underneath unfinished work", async () => {
    let closed = false
    const lifecycle = new BotLifecycle(() => {})
    await lifecycle.start("broken-stop", () => async () => {
        throw new Error("failed drain")
    })
    await assert.rejects(
        lifecycle.stop(async () => {
            closed = true
        }),
        /could not drain/
    )
    assert.equal(closed, false)
})

test("owned interval stops intake immediately and waits for a slow pass", async (t) => {
    t.mock.timers.enable({ apis: ["setInterval"] })
    const active = deferred()
    let calls = 0,
        drained = false
    const stop = startOwnedInterval(
        async () => {
            calls++
            await active.promise
        },
        10,
        () => {}
    )
    await Promise.resolve()
    t.mock.timers.tick(100)
    const stopping = stop().then(() => {
        drained = true
    })
    await Promise.resolve()
    assert.equal(calls, 1)
    assert.equal(drained, false)
    active.resolve()
    await stopping
    t.mock.timers.tick(100)
    assert.equal(calls, 1)
})

test("gateway work and rejected operations remain owned until settlement", async () => {
    const owner = new TaskOwner(),
        active = deferred()
    const task = owner.run(async () => {
        await active.promise
        throw new Error("provider failed")
    })
    const rejected = assert.rejects(task, /provider failed/)
    let drained = false
    const stopping = owner.stop().then(() => {
        drained = true
    })
    await Promise.resolve()
    assert.equal(drained, false)
    active.resolve()
    await Promise.all([rejected, stopping])
    assert.equal(
        await owner.run(async () => {
            throw new Error("late work")
        }),
        undefined
    )
})
