import { readBoundedBytes } from "./request-bytes"
import assert from "node:assert/strict"
import test from "node:test"

function streamed(chunks: Uint8Array[], onCancel?: () => void) {
    return new Request("https://logi.test/upload", {
        method: "POST",
        body: new ReadableStream<Uint8Array>({
            pull(controller) {
                const next = chunks.shift()
                if (next) controller.enqueue(next)
                else controller.close()
            },
            cancel() {
                onCancel?.()
            },
        }),
        duplex: "half",
    } as RequestInit)
}

test("bounded bytes concatenate chunks that fit within the bound", async () => {
    const bytes = await readBoundedBytes(
        streamed([new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])]),
        5
    )
    assert.deepEqual(bytes && Array.from(bytes), [1, 2, 3, 4, 5])
    const empty = await readBoundedBytes(
        new Request("https://logi.test/upload", { method: "POST" }),
        5
    )
    assert.deepEqual(empty && Array.from(empty), [])
})

test("exceeding the bound cancels the stream without buffering the rest", async () => {
    let cancelled = false
    const remaining = [
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7, 8, 9]),
    ]
    const bytes = await readBoundedBytes(
        streamed(remaining, () => {
            cancelled = true
        }),
        4
    )
    assert.equal(bytes, null)
    assert.equal(cancelled, true)
    assert.equal(remaining.length, 1, "the final chunk was never pulled")
})

test("a Content-Length above the bound is refused before reading the body", async () => {
    let pulled = false
    const request = new Request("https://logi.test/upload", {
        method: "POST",
        headers: { "content-length": "10" },
        body: new ReadableStream<Uint8Array>(
            {
                pull(controller) {
                    pulled = true
                    controller.close()
                },
            },
            { highWaterMark: 0 }
        ),
        duplex: "half",
    } as RequestInit)
    assert.equal(await readBoundedBytes(request, 4), null)
    assert.equal(pulled, false)
    const honest = new Request("https://logi.test/upload", {
        method: "POST",
        headers: { "content-length": "3" },
        body: new Uint8Array([1, 2, 3]),
    })
    assert.deepEqual(
        Array.from((await readBoundedBytes(honest, 4)) ?? []),
        [1, 2, 3]
    )
})
