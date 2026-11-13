import { WorkQueue, mapConcurrent } from "./work-queue"
import assert from "node:assert/strict"
import test from "node:test"

const tick = () => new Promise<void>((resolve) => setImmediate(resolve))
function held() {
    let release!: () => void
    const promise = new Promise<void>((resolve) => {
        release = resolve
    })
    return { promise, release }
}

test("keyed admission coalesces newest revision, serializes groups and lets another guild progress", async () => {
    const first = held(),
        calls: string[] = []
    const queue = new WorkQueue({ concurrency: 2, capacity: 3 })
    queue.enqueue(
        "a",
        async () => {
            calls.push("a1")
            await first.promise
        },
        "guild-a"
    )
    queue.enqueue(
        "a",
        async () => {
            calls.push("a2")
        },
        "guild-a"
    )
    queue.enqueue(
        "a",
        async () => {
            calls.push("a3")
        },
        "guild-a"
    )
    queue.enqueue(
        "b",
        async () => {
            calls.push("b")
        },
        "guild-a"
    )
    queue.enqueue(
        "c",
        async () => {
            calls.push("c")
        },
        "guild-c"
    )
    await tick()
    assert.deepEqual(calls, ["a1", "c"])
    first.release()
    await queue.drain()
    assert.deepEqual(calls, ["a1", "c", "a3", "b"])
    assert.equal(queue.snapshot().maxActive, 2)
    assert.equal(queue.snapshot().coalesced, 2)
})

test("bounded backlog, throwing reporters and stop never strand actual active work", async () => {
    const hold = held()
    const queue = new WorkQueue({
        concurrency: 1,
        capacity: 1,
        onError: () => {
            throw Error("logger failed")
        },
    })
    queue.enqueue("a", () => hold.promise)
    queue.enqueue("b", async () => {
        throw Error("must not start")
    })
    assert.equal(
        queue.enqueue("c", async () => {}),
        false
    )
    let stopped = false
    const stop = queue.stop().then(() => {
        stopped = true
    })
    await tick()
    assert.equal(stopped, false)
    assert.equal(queue.snapshot().active, 1)
    hold.release()
    await stop
    assert.equal(
        queue.enqueue("d", async () => {}),
        false
    )
    const failed = new WorkQueue({
        concurrency: 1,
        onError: () => {
            throw Error("logger")
        },
    })
    failed.enqueue("failure", async () => {
        throw Error("request")
    })
    await failed.drain()
    assert.equal(failed.snapshot().failed, 1)
    assert.equal(failed.snapshot().active, 0)
})

test("a thousand admitted items respect capacity and deterministic timing counters", async () => {
    let now = 0
    const queue = new WorkQueue({
        concurrency: 4,
        capacity: 1000,
        now: () => now,
    })
    for (let i = 0; i < 1000; i++)
        queue.enqueue(
            String(i),
            async () => {
                now++
            },
            String(i % 10)
        )
    await queue.drain()
    const state = queue.snapshot()
    assert.equal(state.completed, 1000)
    assert.equal(state.maxActive, 4)
    assert.equal(state.pending, 0)
    assert.ok(state.waitMs > 0)
})

test("mapConcurrent waits for other active I/O after a failure and preserves successful order", async () => {
    const hold = held()
    let settled = false
    const failed = mapConcurrent([1, 2, 3], 2, async (value) => {
        if (value === 1) throw Error("failed")
        await hold.promise
        return value
    }).catch((error) => {
        settled = true
        assert.match(error.message, /failed/)
    })
    await tick()
    assert.equal(settled, false)
    hold.release()
    await failed
    assert.deepEqual(
        await mapConcurrent([3, 2, 1], 2, async (value) => value * 2),
        [6, 4, 2]
    )
})
