import { createClanMutationResponder } from "./clan-mutation-response"
import assert from "node:assert/strict"
import test from "node:test"

test("successful v1 writes and replays invalidate caches without changing recorded responses", async () => {
    const calls: string[] = []
    const respond = createClanMutationResponder({
        invalidate: async (guildId, body) => {
            calls.push(`${guildId}:${body}`)
        },
        onInvalidationError: () => assert.fail("unexpected cache failure"),
    })
    const result = { status: 201, body: '{"data":{"id":"one"}}' }
    for (let i = 0; i < 2; i++) {
        const response = await respond(result, {
            guildId: "guild",
            headers: { "RateLimit-Limit": "300" },
        })
        assert.equal(response.status, 201)
        assert.equal(await response.text(), result.body)
        assert.equal(response.headers.get("RateLimit-Limit"), "300")
        assert.equal(response.headers.get("Content-Type"), "application/json")
    }
    assert.equal(calls.length, 2)
    await respond(
        { status: 403, body: "{}" },
        { guildId: "guild", headers: {} }
    )
    assert.equal(calls.length, 2)
})

test("cache failures are reported and do not turn committed writes into HTTP failures", async () => {
    const errors: unknown[] = []
    const respond = createClanMutationResponder({
        invalidate: async () => {
            throw new Error("cache unavailable")
        },
        onInvalidationError: (error) => errors.push(error),
    })
    const response = await respond(
        { status: 200, body: "{}" },
        { guildId: "guild", headers: {} }
    )
    assert.equal(response.status, 200)
    assert.equal(errors.length, 1)
})
