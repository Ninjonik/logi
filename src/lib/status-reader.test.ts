import assert from "node:assert/strict"
import test from "node:test"

import { createStatusReader } from "./status-reader"

test("shares successful and failed checks for five minutes without retrying", async (t) => {
    let now = 1_000
    let calls = 0
    t.mock.method(Date, "now", () => now)
    t.mock.method(globalThis, "fetch", async () => {
        calls++
        if (calls === 2) throw new Error("unavailable")
        return new Response(
            JSON.stringify([{ name: "Logi", group_id: 2, online: true }])
        )
    })
    const read = createStatusReader<{
        name: string
        group_id: number
        online: boolean
    }>("http://localhost/status")
    assert.deepEqual(await Promise.all([read(), read()]), [
        [{ name: "Logi", group_id: 2, online: true }],
        [{ name: "Logi", group_id: 2, online: true }],
    ])
    assert.equal(calls, 1)
    now += 300_000
    assert.equal(await read(), null)
    assert.equal(await read(), null)
    assert.equal(calls, 2)
    now += 300_000
    assert.deepEqual(await read(), [
        { name: "Logi", group_id: 2, online: true },
    ])
    assert.equal(calls, 3)
})
