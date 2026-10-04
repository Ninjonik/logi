import { profileFixture } from "../testing/hll-profile"
import { createHllRecordsReader } from "./read-profile"
import assert from "node:assert/strict"
import test from "node:test"

const id = "76561198199051397"
test("HLL reader caches a successful profile and preserves stale data during a provider block", async () => {
    let now = 1000,
        calls = 0,
        blocked = false
    const reader = createHllRecordsReader({
        now: () => now,
        fetch: async (url, init) => {
            calls++
            assert.equal(
                String(url),
                `https://hllrecords.com/profiles/${id}?period=30d`
            )
            assert.equal(init?.redirect, "manual")
            assert.equal(new Headers(init?.headers).has("cookie"), false)
            return blocked
                ? new Response("shield", { status: 403 })
                : new Response(profileFixture, {
                      headers: { "content-type": "text/html" },
                  })
        },
    })
    assert.equal((await reader(id, "30d")).status, "ok")
    assert.equal((await reader(id, "30d")).status, "ok")
    assert.equal(calls, 1)
    now += 16 * 60_000
    blocked = true
    const stale = await reader(id, "30d")
    assert.equal(stale.status, "stale")
    assert.equal(stale.profile?.kills, 191)
    assert.equal(stale.reason, "blocked")
    assert.equal(
        (await reader("76561198000000001", "30d")).status,
        "unavailable"
    )
    assert.equal(calls, 2)
})
test("HLL honors Retry-After globally, rejects redirects, and never calls an arbitrary host", async () => {
    let now = 1000,
        calls = 0
    const reader = createHllRecordsReader({
        now: () => now,
        fetch: async () => {
            calls++
            return new Response(null, {
                status: 429,
                headers: { "retry-after": "120" },
            })
        },
    })
    assert.equal((await reader(id, "all")).reason, "rate_limited")
    now += 119000
    await reader("76561198000000001", "all")
    assert.equal(calls, 1)
    now += 1001
    await reader(id, "all")
    assert.equal(calls, 2)
    const redirect = createHllRecordsReader({
        fetch: async () =>
            new Response(null, {
                status: 302,
                headers: { location: "http://127.0.0.1" },
            }),
    })
    assert.equal((await redirect(id, "all")).status, "unavailable")
    await assert.rejects(reader("https://evil.test", "all"))
})
test("HLL timeout bounds an upstream promise and huge HTML cannot enter the cache", async () => {
    const slow = createHllRecordsReader({
        timeoutMs: 10,
        fetch: () => new Promise(() => {}),
    })
    assert.equal((await slow(id, "all")).reason, "timeout")
    const huge = createHllRecordsReader({
        fetch: async () =>
            new Response("x".repeat(2 * 1024 * 1024 + 1), {
                headers: { "content-type": "text/html" },
            }),
    })
    assert.equal((await huge(id, "all")).status, "unavailable")
})
