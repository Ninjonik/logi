import { resourceCreationRequest } from "./resource-http"
import assert from "node:assert/strict"
import { REST } from "@discordjs/rest"
import { Response } from "undici"
import test from "node:test"

for (const route of [
    "/guilds/123/channels",
    "/guilds/123/scheduled-events",
    "/channels/123/threads",
] as const) {
    for (const failure of ["timeout", "server-error"] as const) {
        test(`${route}: SDK does not retry an ambiguous ${failure} resource create`, async () => {
            let attempts = 0
            const rest = new REST({
                retries: 3,
                hashSweepInterval: 0,
                handlerSweepInterval: 0,
                makeRequest: resourceCreationRequest(async () => {
                    attempts++
                    if (failure === "timeout")
                        throw Object.assign(new Error("timeout"), {
                            name: "AbortError",
                        })
                    return new Response("error", { status: 503 })
                }),
            }).setToken("synthetic-test-token")
            await assert.rejects(
                rest.post(route, { body: {} }),
                /creation uncertain/
            )
            assert.equal(attempts, 1)
        })
    }
}
test("reads retain SDK server-error retries", async () => {
    let attempts = 0
    const rest = new REST({
        retries: 3,
        hashSweepInterval: 0,
        handlerSweepInterval: 0,
        makeRequest: resourceCreationRequest(async () => {
            attempts++
            return new Response("error", { status: 503 })
        }),
    }).setToken("synthetic-test-token")
    await assert.rejects(rest.get("/guilds/123/channels"))
    assert.equal(attempts, 4)
})
test("definite rate limits retain SDK waiting and retry behavior", async () => {
    let attempts = 0
    const rest = new REST({
        hashSweepInterval: 0,
        handlerSweepInterval: 0,
        makeRequest: resourceCreationRequest(async () => {
            attempts++
            return attempts === 1
                ? new Response(
                      JSON.stringify({ retry_after: 0.001, global: false }),
                      {
                          status: 429,
                          headers: {
                              "Content-Type": "application/json",
                              "Retry-After": "0.001",
                              Via: "test",
                          },
                      }
                  )
                : new Response(JSON.stringify({ id: "created" }), {
                      status: 200,
                      headers: { "Content-Type": "application/json" },
                  })
        }),
    }).setToken("synthetic-test-token")
    assert.deepEqual(await rest.post("/guilds/123/channels", { body: {} }), {
        id: "created",
    })
    assert.equal(attempts, 2)
})
