import type { DataSource } from "../../domain/game-data/contracts"
import { testProviderConnection } from "./connection-test"
import { createProviderHttp } from "./provider-http"
import assert from "node:assert/strict"
import test from "node:test"

const SENTINEL = "sentinel-provider-key-c0ffee"
const warcon: DataSource = {
    ref: "src-0123456789abcdef0123456789abcdef",
    guildId: "guild-a",
    gameId: "wardogs",
    provider: "wardogs_warcon",
    providerServerId: "11111111-1111-4111-8111-111111111111",
    origin: "https://wardogs.example.test",
    secretRef: null,
    allowedAddresses: [],
}
const crcon: DataSource = {
    ...warcon,
    gameId: "hell_let_loose",
    provider: "hll_crcon",
    providerServerId: "1",
    origin: "https://admin.example.test",
}
const rcon: DataSource = {
    ...warcon,
    provider: "wardogs_rcon",
    providerServerId: "primary",
}
function run(
    source: DataSource,
    respond: (url: URL) => Response | Promise<Response>,
    keyed = true,
    timeoutMs?: number
) {
    const urls: string[] = []
    const result = testProviderConnection(
        source,
        createProviderHttp(source, {
            credential: keyed ? async () => SENTINEL : undefined,
            now: Date.now,
            timeoutMs,
            fetch: async (url) => {
                urls.push(String(url))
                return respond(new URL(String(url)))
            },
        }),
        { keyed, now: Date.now }
    )
    return { result, urls }
}

test("a passing test proves the panel lists this server for the key", async () => {
    const ok = run(warcon, () =>
        Response.json({ ok: true, servers: [{ id: warcon.providerServerId }] })
    )
    assert.deepEqual(await ok.result, { outcome: "ok" })
    assert.deepEqual(ok.urls, ["https://wardogs.example.test/api/servers"])
    const other = run(warcon, () =>
        Response.json({
            ok: true,
            servers: [{ id: "22222222-2222-4222-8222-222222222222" }],
        })
    )
    assert.deepEqual(await other.result, { outcome: "server_mismatch" })
})

test("CRCON proves the server number with the key, or reachability without one", async () => {
    const keyed = run(crcon, (url) => {
        assert.equal(url.pathname, "/api/get_connection_info")
        return Response.json({ failed: false, result: { server_number: 1 } })
    })
    assert.deepEqual(await keyed.result, { outcome: "ok" })
    const wrong = run(crcon, () =>
        Response.json({ failed: false, result: { server_number: 2 } })
    )
    assert.deepEqual(await wrong.result, { outcome: "server_mismatch" })
    const keyless = run(
        crcon,
        (url) => {
            assert.equal(url.pathname, "/api/get_public_info")
            return Response.json({
                failed: false,
                result: { name: { name: "Server" } },
            })
        },
        false
    )
    assert.deepEqual(await keyless.result, { outcome: "ok" })
    const rconIdentity = run(rcon, () => Response.json({ serverId: "other" }))
    assert.deepEqual(await rconIdentity.result, { outcome: "server_mismatch" })
})

test("failures map to sanitized categories without provider text", async () => {
    const cases: Array<[(() => Response) | "hang", string]> = [
        [
            () => new Response(`denied ${SENTINEL}`, { status: 401 }),
            "unauthorized",
        ],
        [() => new Response("forbidden", { status: 403 }), "unauthorized"],
        [() => new Response("busy", { status: 503 }), "network"],
        [() => new Response("moved", { status: 302 }), "invalid_response"],
        [() => new Response("not json"), "invalid_response"],
        [
            () => new Response('"' + "x".repeat(2_100_000) + '"'),
            "invalid_response",
        ],
        ["hang", "timeout"],
    ]
    for (const [response, outcome] of cases) {
        const { result } = run(
            warcon,
            () =>
                response === "hang"
                    ? new Promise<Response>(() => undefined)
                    : response(),
            true,
            response === "hang" ? 20 : undefined
        )
        const value = await result
        assert.equal(value.outcome, outcome, outcome)
        assert.equal(JSON.stringify(value).includes(SENTINEL), false)
    }
    const limited = run(
        warcon,
        () =>
            new Response("slow down", {
                status: 429,
                headers: { "retry-after": "120" },
            })
    )
    assert.deepEqual(await limited.result, {
        outcome: "rate_limited",
        retryAfterMs: 120_000,
    })
})

test("the test transport refuses private, loopback and metadata destinations", async () => {
    for (const addresses of [
        ["127.0.0.1"],
        ["169.254.169.254"],
        ["10.0.0.5"],
        ["::1"],
        // A rebinding answer that mixes a public and a private address.
        ["93.184.216.34", "192.168.1.10"],
    ]) {
        let lookups = 0
        const result = await testProviderConnection(
            warcon,
            createProviderHttp(warcon, {
                credential: async () => SENTINEL,
                now: Date.now,
                lookup: async () => {
                    lookups++
                    return addresses.map((address) => ({
                        address,
                        family: address.includes(":") ? 6 : 4,
                    }))
                },
            }),
            { keyed: true, now: Date.now }
        )
        assert.deepEqual(result, { outcome: "configuration" }, addresses.join())
        assert.equal(lookups, 1)
    }
    const literal = await testProviderConnection(
        { ...warcon, origin: "https://127.0.0.1" },
        createProviderHttp(
            { ...warcon, origin: "https://127.0.0.1" },
            {
                credential: async () => SENTINEL,
                now: Date.now,
                lookup: async () =>
                    assert.fail("an IP literal is not resolved"),
            }
        ),
        { keyed: true, now: Date.now }
    )
    assert.deepEqual(literal, { outcome: "configuration" })
})
