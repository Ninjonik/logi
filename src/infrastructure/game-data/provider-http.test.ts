import { createProviderHttp, isAllowedAddress } from "./provider-http"
import { parseSources } from "../../domain/game-data/policy"
import assert from "node:assert/strict"
import test from "node:test"

const source = parseSources(
    JSON.stringify([
        {
            ref: "wdg",
            guildId: "guild",
            gameId: "wardogs",
            provider: "wardogs_rcon",
            providerServerId: "primary",
            origin: "https://rcon.example.test",
            secretRef: "LOGI_GAME_DATA_WDG_TOKEN",
        },
    ])
)[0]

test("a claimed connection can perform a bounded read without serializing its lease or secret", async () => {
    const claimed = {
        ...source,
        id: "connection",
        generation: 2,
        fence: 3,
        attempt: 1,
        observation: null,
        etag: null,
    }
    const http = createProviderHttp(claimed, {
        credential: async () => "synthetic-token",
        now: Date.now,
        fetch: async (url) => {
            assert.equal(String(url), "https://rcon.example.test/v1/status")
            return Response.json({ players: { current: 0, max: 100 } })
        },
    })
    assert.deepEqual((await http.get("/v1/status")).body, {
        players: { current: 0, max: 100 },
    })
    const missing = createProviderHttp(claimed, {
        now: Date.now,
        fetch: async () => {
            assert.fail("no request without configured credentials")
        },
    })
    await assert.rejects(missing.get("/v1/status"), /configuration/)
})

test("only allowed GET routes receive provider credentials; redirects cannot forward them", async () => {
    const calls: string[] = []
    const http = createProviderHttp(source, {
        credential: async () => "synthetic-token",
        now: Date.now,
        fetch: async (url, init) => {
            calls.push(String(url))
            assert.equal(init?.method, "GET")
            assert.equal(init?.redirect, "error")
            assert.equal(
                new Headers(init?.headers).get("authorization"),
                "Bearer synthetic-token"
            )
            return new Response(null, {
                status: 302,
                headers: { location: "https://other.test" },
            })
        },
    })
    await assert.rejects(http.get("/v1/status"), /invalid_response/)
    await assert.rejects(http.get("/v1/bans"), /configuration/)
    await assert.rejects(
        http.get("https://other.test/v1/status"),
        /configuration/
    )
    assert.deepEqual(calls, ["https://rcon.example.test/v1/status"])
})

test("bounded transport sanitizes upstream failures and honors Retry-After", async () => {
    const http = createProviderHttp(source, {
        credential: async () => "synthetic-token",
        now: () => 0,
        fetch: async () =>
            new Response("secret response", {
                status: 429,
                headers: { "retry-after": "120" },
            }),
    })
    await assert.rejects(
        http.get("/v1/status"),
        (error: unknown) =>
            error instanceof Error &&
            error.message === "rate_limited" &&
            "retryAfterMs" in error &&
            error.retryAfterMs === 120_000
    )
    const invalid = createProviderHttp(source, {
        credential: async () => "synthetic-token",
        now: Date.now,
        fetch: async () => new Response("not json"),
    })
    await assert.rejects(invalid.get("/v1/status"), /invalid_response/)
    const huge = createProviderHttp(source, {
        credential: async () => "synthetic-token",
        now: Date.now,
        fetch: async () => new Response('"' + "x".repeat(2_100_000) + '"'),
    })
    await assert.rejects(huge.get("/v1/status"), /invalid_response/)
})

test("deadline also bounds a transport that never resolves", async () => {
    const http = createProviderHttp(source, {
        credential: async () => "synthetic-token",
        now: Date.now,
        timeoutMs: 10,
        fetch: async () => new Promise<Response>(() => {}),
    })
    await assert.rejects(http.get("/v1/status"), /timeout/)
})

test("provider access denial has a sanitized category and no upstream payload", async () => {
    for (const status of [401, 403]) {
        const http = createProviderHttp(source, {
            credential: async () => "synthetic-token",
            now: Date.now,
            fetch: async () =>
                new Response("private upstream detail", { status }),
        })
        await assert.rejects(
            http.get("/v1/status"),
            (error: unknown) =>
                error instanceof Error && error.message === "unauthorized"
        )
    }
})

test("DNS destinations deny metadata, loopback and private networks unless explicitly pinned by operator", () => {
    for (const address of [
        "127.0.0.1",
        "169.254.169.254",
        "10.20.1.2",
        "100.100.100.200",
        "::1",
        "::ffff:127.0.0.1",
        "fc00::1",
        "fe80::1",
        "2001:db8::1",
    ])
        assert.equal(isAllowedAddress(address, []), false, address)
    assert.equal(isAllowedAddress("8.8.8.8", []), true)
    assert.equal(isAllowedAddress("2606:4700:4700::1111", []), true)
    assert.equal(isAllowedAddress("10.20.1.2", ["10.20.1.2"]), true)
    assert.equal(isAllowedAddress("8.8.8.8", ["10.20.1.2"]), false)
})

test("a resolved key that could split a header, or a key for a keyless provider, is never sent", async () => {
    let requests = 0
    const fetch = async () => {
        requests++
        return Response.json({})
    }
    for (const key of ["token\r\nx-forwarded-for: 1", "two words", ""]) {
        const http = createProviderHttp(source, {
            credential: async () => key,
            now: Date.now,
            fetch,
        })
        await assert.rejects(http.get("/v1/status"), /configuration/)
    }
    const directory = parseSources(
        JSON.stringify([
            {
                ref: "dir",
                guildId: "guild",
                gameId: "wardogs",
                provider: "wardogs_public_directory",
                providerServerId: "1",
                origin: "https://api.wardogservers.com",
                secretRef: null,
            },
        ])
    )[0]!
    const keyed = createProviderHttp(directory, {
        credential: async () => "synthetic-token",
        now: Date.now,
        fetch,
    })
    await assert.rejects(keyed.get("/v1/servers/1"), /configuration/)
    assert.equal(requests, 0)
})
