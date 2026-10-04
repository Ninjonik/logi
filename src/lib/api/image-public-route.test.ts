import { publicImageHandler, type PublicImagePorts } from "./image-public-route"
import assert from "node:assert/strict"
import test from "node:test"

const id = "b".repeat(32)
const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3])

function fakePorts(
    record: Awaited<ReturnType<PublicImagePorts["resolve"]>> | Error,
    upstream: () => Response = () =>
        new Response(bytes, {
            headers: {
                "content-type": "application/octet-stream",
                "content-length": String(bytes.length),
            },
        })
) {
    const calls = { resolve: [] as string[], fetched: [] as string[] }
    const serve = publicImageHandler({
        resolve: async (publicId) => {
            calls.resolve.push(publicId)
            if (record instanceof Error) throw record
            return record
        },
        fetchStorage: async (url) => {
            calls.fetched.push(url)
            return upstream()
        },
    })
    return { calls, serve }
}

const png = {
    url: "https://storage.test/blob/1",
    contentType: "image/png" as const,
}

test("file names outside the contract are not found without a lookup", async () => {
    const { calls, serve } = fakePorts(png)
    for (const file of ["", "logo.png", `${id}.gif`, `${"B".repeat(32)}.png`]) {
        const response = await serve(file)
        assert.equal(response.status, 404)
        assert.equal(response.headers.get("cache-control"), "no-store")
        assert.deepEqual(await response.json(), { error: "not_found" })
    }
    assert.deepEqual(calls.resolve, [])
})

test("unknown records and extension mismatches are not found", async () => {
    const missing = fakePorts(null)
    assert.equal((await missing.serve(`${id}.png`)).status, 404)
    assert.deepEqual(missing.calls.resolve, [id])
    const mismatch = fakePorts(png)
    assert.equal((await mismatch.serve(`${id}.webp`)).status, 404)
    assert.equal((await mismatch.serve(`${id}.jpg`)).status, 404)
    assert.deepEqual(mismatch.calls.fetched, [])
    const jpeg = fakePorts({ ...png, contentType: "image/jpeg" })
    assert.equal((await jpeg.serve(`${id}.jpg`)).status, 200)
})

test("a live file streams with the recorded type and immutable caching", async () => {
    const { calls, serve } = fakePorts(png)
    const response = await serve(`${id}.png`)
    assert.equal(response.status, 200)
    assert.deepEqual(calls.fetched, [png.url])
    assert.equal(response.headers.get("content-type"), "image/png")
    assert.equal(response.headers.get("x-content-type-options"), "nosniff")
    assert.equal(
        response.headers.get("cache-control"),
        "public, max-age=31536000, immutable"
    )
    assert.equal(response.headers.get("content-disposition"), "inline")
    assert.equal(response.headers.get("content-length"), String(bytes.length))
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes)
})

test("content length is only forwarded for identity-encoded bodies", async () => {
    const { serve } = fakePorts(
        png,
        () =>
            new Response(bytes, {
                headers: {
                    "content-length": "999",
                    "content-encoding": "gzip",
                },
            })
    )
    const response = await serve(`${id}.png`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("content-length"), null)
})

test("storage and lookup failures are not found", async () => {
    const failed = fakePorts(png, () => new Response(null, { status: 500 }))
    assert.equal((await failed.serve(`${id}.png`)).status, 404)
    const thrown = fakePorts(new Error("convex down"))
    const response = await thrown.serve(`${id}.png`)
    assert.equal(response.status, 404)
    assert.equal(response.headers.get("cache-control"), "no-store")
})
