import { awaitOwnedOperation } from "./owned-operation"
import assert from "node:assert/strict"
import test from "node:test"

test("a slow mutation retains sequencing until its actual completion", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    let finish!: () => void
    let warnings = 0
    let nextStep = false
    const operation = new Promise<void>((resolve) => {
        finish = resolve
    })
    const owned = awaitOwnedOperation(operation, 20_000, () => {
        warnings++
    }).then(() => {
        nextStep = true
    })
    t.mock.timers.tick(20_001)
    await Promise.resolve()
    assert.equal(warnings, 1)
    assert.equal(nextStep, false)
    finish()
    await owned
    assert.equal(nextStep, true)
    t.mock.timers.tick(20_000)
    assert.equal(warnings, 1)
})

test("late failure propagates and a broken diagnostic does not release ownership", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] })
    let fail!: (error: Error) => void
    const operation = new Promise<void>((_, reject) => {
        fail = reject
    })
    const result = awaitOwnedOperation(operation, 10, () => {
        throw new Error("logger failed")
    })
    t.mock.timers.tick(11)
    const error = new Error("Discord refused mutation")
    const rejected = assert.rejects(result, error)
    fail(error)
    await rejected
})
