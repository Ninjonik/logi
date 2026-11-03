import { deliverCacheInvalidation } from "./cache-delivery"
import assert from "node:assert/strict"
import test from "node:test"

test("retries network and server failures, then succeeds", async () => {
    let attempts = 0
    const reports: boolean[] = []
    const delays: number[] = []
    const result = await deliverCacheInvalidation({
        send: async () => {
            attempts++
            if (attempts === 1) throw new Error("network")
            return { ok: attempts === 3, status: attempts === 3 ? 200 : 503 }
        },
        wait: async (ms) => {
            delays.push(ms)
        },
        report: (final) => {
            reports.push(final)
        },
    })
    assert.equal(result, true)
    assert.equal(attempts, 3)
    assert.deepEqual(delays, [250, 500])
    assert.deepEqual(reports, [false, false])
})

test("reports terminal failures without rejecting the committed write", async () => {
    for (const status of [401, 429, 503]) {
        let attempts = 0
        const reports: boolean[] = []
        assert.equal(
            await deliverCacheInvalidation({
                send: async () => {
                    attempts++
                    return { ok: false, status }
                },
                wait: async () => {},
                report: (final) => {
                    reports.push(final)
                },
            }),
            false
        )
        assert.equal(attempts, status === 401 ? 1 : 3)
        assert.equal(reports.at(-1), true)
    }
})
