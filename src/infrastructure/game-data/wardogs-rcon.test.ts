import { parseSources } from "../../domain/game-data/policy"
import { wardogsRconProvider } from "./wardogs-rcon"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
const source = parseSources(
    JSON.stringify([
        {
            ref: "wdg",
            guildId: "guild",
            gameId: "wardogs",
            provider: "wardogs_rcon",
            providerServerId: "00012345",
            origin: "https://rcon.example.test",
            secretRef: "LOGI_GAME_DATA_WDG_TOKEN",
        },
    ])
)[0]
const status = JSON.parse(
    readFileSync(
        new URL("./fixtures/wardogs/status.json", import.meta.url),
        "utf8"
    )
)
test("WDG reads only advertised routes, preserves three factions and does not invent history", async () => {
    const calls: string[] = []
    const result = await wardogsRconProvider.readSnapshot(
        source,
        {
            get: async (path) => {
                calls.push(path)
                return {
                    status: 200,
                    etag: null,
                    body:
                        path === "/v1/capabilities"
                            ? {
                                  routes: [
                                      "GET /v1/status",
                                      "GET /v1/server-id",
                                      "POST /v1/bans",
                                  ],
                              }
                            : path === "/v1/server-id"
                              ? { serverId: "00012345" }
                              : status,
                }
            },
        },
        () => 0
    )
    assert.deepEqual(calls, ["/v1/capabilities", "/v1/status", "/v1/server-id"])
    assert.deepEqual(
        result.observation.scores.map((score) => score.score),
        [0, 12, 7]
    )
    assert.deepEqual(result.observation.capabilities, ["server_snapshot"])
    assert.equal(
        result.observation.providerInstanceId,
        null,
        "join code is not an instance ID"
    )
    assert.equal(result.observation.players, 0)
})
test("WDG absent capability, wrong server identity and malformed status fail explicitly", async () => {
    await assert.rejects(
        wardogsRconProvider.readSnapshot(
            source,
            {
                get: async () => ({
                    status: 200,
                    etag: null,
                    body: { routes: [] },
                }),
            },
            () => 0
        ),
        /unsupported/
    )
    for (const invalid of ["identity", "status"])
        await assert.rejects(
            wardogsRconProvider.readSnapshot(
                source,
                {
                    get: async (path) => ({
                        status: 200,
                        etag: null,
                        body:
                            path === "/v1/capabilities"
                                ? {
                                      routes: [
                                          "GET /v1/status",
                                          "GET /v1/server-id",
                                      ],
                                  }
                                : path === "/v1/server-id"
                                  ? { serverId: "wrong" }
                                  : invalid === "status"
                                    ? {}
                                    : status,
                    }),
                },
                () => 0
            ),
            /invalid_response/
        )
})
