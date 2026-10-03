import { gameDataHandlers } from "./game-data-route"
import assert from "node:assert/strict"
import test from "node:test"

test("game data management is session-admin-only and rejects origin or secret injection", async () => {
    let writes = 0
    const denied = gameDataHandlers({
        authorize: async () => null,
        list: async () => {
            throw new Error()
        },
        configure: async () => {
            writes++
        },
    })
    assert.equal(
        (await denied.GET(new Request("https://logi.test/api"), "guild"))
            .status,
        403
    )
    assert.equal(
        (
            await denied.POST(
                new Request("https://logi.test/api", {
                    method: "POST",
                    body: "{}",
                    headers: { authorization: "Bearer fixture" },
                }),
                "guild"
            )
        ).status,
        403
    )
    const allowed = gameDataHandlers({
        authorize: async () => "trusted-guild",
        list: async () => [],
        configure: async (guild, value) => {
            assert.equal(guild, "trusted-guild")
            assert.deepEqual(value, { sourceRef: "primary", enabled: true })
            writes++
        },
    })
    for (const body of [
        { sourceRef: "primary", enabled: true, origin: "https://evil.test" },
        { sourceRef: "primary", enabled: true, secretRef: "DISCORD_BOT_TOKEN" },
    ]) {
        assert.equal(
            (
                await allowed.POST(
                    new Request("https://logi.test/api", {
                        method: "POST",
                        body: JSON.stringify(body),
                    }),
                    "guild"
                )
            ).status,
            400
        )
    }
    const valid = JSON.stringify({ sourceRef: "primary", enabled: true })
    assert.equal(
        (
            await allowed.POST(
                new Request("https://logi.test/api", {
                    method: "POST",
                    headers: { origin: "https://other.test" },
                    body: valid,
                }),
                "guild"
            )
        ).status,
        403
    )
    const response = await allowed.POST(
        new Request("https://logi.test/api", {
            method: "POST",
            headers: { origin: "https://logi.test" },
            body: valid,
        }),
        "guild"
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("Cache-Control"), "no-store")
    assert.equal(writes, 1)
})

test("configuration rechecks authority after a streamed request body completes", async () => {
    let allowed = true,
        writes = 0
    let authorized!: () => void
    const firstCheck = new Promise<void>((resolve) => {
        authorized = resolve
    })
    let body!: ReadableStreamDefaultController<Uint8Array>
    const stream = new ReadableStream<Uint8Array>({
        start(controller) {
            body = controller
        },
    })
    const handlers = gameDataHandlers({
        authorize: async () => {
            authorized()
            return allowed ? "guild" : null
        },
        list: async () => [],
        configure: async () => {
            writes++
        },
    })
    const response = handlers.POST(
        new Request("https://logi.test/api", {
            method: "POST",
            body: stream,
            duplex: "half",
            headers: { origin: "https://logi.test" },
        } as RequestInit),
        "server"
    )
    await firstCheck
    allowed = false
    body.enqueue(
        new TextEncoder().encode(
            JSON.stringify({ sourceRef: "primary", enabled: true })
        )
    )
    body.close()
    assert.equal((await response).status, 403)
    assert.equal(writes, 0)
})

test("configuration stops reading an oversized streamed body before allocating it", async () => {
    let cancelled = false,
        writes = 0
    const handlers = gameDataHandlers({
        authorize: async () => "guild",
        list: async () => [],
        configure: async () => {
            writes++
        },
    })
    const body = new ReadableStream<Uint8Array>({
        start(controller) {
            controller.enqueue(new Uint8Array(2049))
        },
        cancel() {
            cancelled = true
        },
    })
    const response = await handlers.POST(
        new Request("https://logi.test/api", {
            method: "POST",
            body,
            duplex: "half",
        } as RequestInit),
        "server"
    )
    assert.equal(response.status, 400)
    assert.equal(cancelled, true)
    assert.equal(writes, 0)
})
