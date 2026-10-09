import assert from "node:assert/strict"
import test from "node:test"

import { interactiveFlushDelay } from "./sync-service"

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
