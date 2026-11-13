import { readResponseBytes, DownloadTooLarge } from "./download"
import assert from "node:assert/strict"
import test from "node:test"

test("lying and missing lengths cannot buffer an unbounded stream", async () => {
    for (const headers of [
        new Headers(),
        new Headers({ "content-length": "1" }),
    ]) {
        let reads = 0,
            cancelled = false
        const stream = new ReadableStream<Uint8Array>(
            {
                pull(controller) {
                    reads++
                    controller.enqueue(new Uint8Array(8))
                },
                cancel() {
                    cancelled = true
                },
            },
            { highWaterMark: 0 }
        )
        await assert.rejects(
            readResponseBytes(new Response(stream, { headers }), 10),
            DownloadTooLarge
        )
        assert.equal(reads, 2)
        assert.equal(cancelled, true)
    }
})

test("a deadline cancels a stalled body and does not retain its reader", async () => {
    let cancelled = false
    const abort = new AbortController()
    const response = new Response(
        new ReadableStream({
            cancel() {
                cancelled = true
            },
        })
    )
    const pending = readResponseBytes(response, 100, abort.signal)
    abort.abort(new Error("deadline"))
    await assert.rejects(pending, /deadline/)
    assert.equal(cancelled, true)
    assert.equal(response.body?.locked, false)
})

test("exact byte limits work and advertised excessive lengths are cancelled before reading", async () => {
    assert.deepEqual(
        await readResponseBytes(new Response(new Uint8Array([1, 2])), 2),
        new Uint8Array([1, 2])
    )
    await assert.rejects(
        readResponseBytes(
            new Response("abc", { headers: { "content-length": "999" } }),
            2
        ),
        DownloadTooLarge
    )
})
