import { sourceSchema, ProviderError } from "../../domain/game-data/contracts"
import { createProviderHttp } from "./provider-http"
import assert from "node:assert/strict"
import { test } from "node:test"

const id = "11111111-1111-4111-8111-111111111111"
const raw = {
    ref: "wd",
    guildId: "guild",
    gameId: "wardogs",
    provider: "wardogs_warcon",
    providerServerId: id,
    origin: "https://warcon.example",
    secretRef: "LOGI_GAME_DATA_WD_TOKEN",
    allowedAddresses: [],
}

test("Warcon requires a panel UUID; the credential mode decides the key", async () => {
    assert.equal(sourceSchema.safeParse(raw).success, true)
    // An encrypted key has no variable name.
    assert.equal(
        sourceSchema.safeParse({ ...raw, secretRef: null }).success,
        true
    )
    const keyless = createProviderHttp(
        sourceSchema.parse({ ...raw, secretRef: null }),
        {
            now: () => 0,
            fetch: async () => assert.fail("no request without a key"),
        }
    )
    await assert.rejects(
        keyless.get(`/api/live?ids=${id}`),
        (error: unknown) =>
            error instanceof ProviderError && error.category === "configuration"
    )
    assert.equal(
        sourceSchema.safeParse({ ...raw, providerServerId: "../other" })
            .success,
        false
    )
})

test("Warcon HTTP restricts the server, read action and query before resolving credentials", async () => {
    let requests = 0
    let secrets = 0
    const http = createProviderHttp(sourceSchema.parse(raw), {
        now: () => 0,
        credential: async () => {
            secrets++
            return "test-only"
        },
        fetch: async (url, init) => {
            requests++
            assert.equal(init?.method, "GET")
            assert.equal(
                new Headers(init?.headers).get("authorization"),
                "Bearer test-only"
            )
            return Response.json(
                { ok: true },
                { status: String(url).includes("matches/9") ? 404 : 200 }
            )
        },
    })
    for (const path of [
        `/api/live?ids=${id}`,
        `/api/servers/${id}/analytics?range=24h`,
        `/api/servers/${id}/rcon/catalog`,
        `/api/servers/${id}/matches/9`,
    ])
        await http.get(path)
    assert.equal(requests, 4)
    for (const path of [
        "/api/live?ids=other",
        `/api/live?ids=${id}&ids=${id}`,
        `/api/servers/${id}/leaderboard?scope=org`,
        `/api/servers/${id}/rcon/ban`,
        `/api/servers/${id}/rcon/config`,
        `/api/servers/${id}/rcon/status?raw=1`,
        `/api/servers/${id}/players/76561198000000001/notes`,
        `/api/servers/other/summary`,
        `/api/servers/${id}/matches?page=-1`,
        `/api/servers/${id}/analytics?range=24h&url=https://other`,
        `/api/servers/${id}/rcon/analytics`,
        `/api/servers/${id}/catalog`,
        `https://other/api/live?ids=${id}`,
        `/api/live?ids=${id},other`,
        `/api/servers/${id}/kills?limit=999999`,
    ])
        await assert.rejects(
            () => http.get(path),
            (e: unknown) =>
                e instanceof ProviderError && e.category === "configuration"
        )
    assert.equal(requests, 4)
    assert.equal(secrets, 4)
})
