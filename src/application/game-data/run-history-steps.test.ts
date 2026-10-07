import { runHistorySteps } from "./run-history-steps"
import assert from "node:assert/strict"
import test from "node:test"

test("a tick runs steps until nothing is due, pausing only between steps", async () => {
    const due = [true, true, true, false]
    const calls: string[] = []
    const processed = await runHistorySteps(
        async () => {
            calls.push("step")
            return due.shift() ?? false
        },
        {
            limit: 30,
            pause: async () => {
                calls.push("pause")
            },
        }
    )
    assert.equal(processed, 3)
    assert.deepEqual(calls, [
        "step",
        "pause",
        "step",
        "pause",
        "step",
        "pause",
        "step",
    ])
})

test("a tick never runs more than its limit", async () => {
    let steps = 0,
        pauses = 0
    const processed = await runHistorySteps(
        async () => {
            steps++
            return true
        },
        {
            limit: 5,
            pause: async () => {
                pauses++
            },
        }
    )
    assert.equal(processed, 5)
    assert.equal(steps, 5)
    assert.equal(pauses, 4)
})

test("a tick with nothing due runs no step and never pauses", async () => {
    let pauses = 0
    assert.equal(
        await runHistorySteps(async () => false, {
            limit: 30,
            pause: async () => {
                pauses++
            },
        }),
        0
    )
    assert.equal(pauses, 0)
})

test("a failing step ends the tick with its error", async () => {
    await assert.rejects(
        runHistorySteps(
            async () => {
                throw new Error("storage")
            },
            { limit: 30, pause: async () => {} }
        ),
        /storage/
    )
})
