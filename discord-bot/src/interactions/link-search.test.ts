import assert from "node:assert/strict"
import test from "node:test"

import { clanStatsServers, searchStatsServers } from "./link-search"

const KEY = ["fixture", "key"].join("-")

test("stats servers are the usable connections, named after Herní servery by address", () => {
    assert.deepEqual(
        clanStatsServers(
            [
                {
                    url: "https://crcon.vlci.example/api/get_players_history",
                    token: KEY,
                },
                {
                    url: "https://crcon.vlci.example/api/get_players_history",
                    token: KEY,
                },
                {
                    url: "https://other.example/api/get_players_history",
                    token: KEY,
                },
                { url: "", token: KEY },
                { url: "https://x.example", token: " " },
            ],
            [{ origin: "https://crcon.vlci.example/", name: "Vlci #1" }]
        ),
        [
            {
                url: "https://crcon.vlci.example/api/get_players_history",
                token: KEY,
                name: "Vlci #1",
            },
            {
                url: "https://other.example/api/get_players_history",
                token: KEY,
            },
        ]
    )
})

test("the search merges servers, keeps the latest sighting and the server's name", async () => {
    const requests: Array<{
        url: string
        authorization: string
        body: string
    }> = []
    const hits = await searchStatsServers(
        [
            { url: "https://a.example/api", token: KEY, name: "Vlci #1" },
            {
                url: "https://b.example/api",
                token: `Bearer ${KEY}`,
                name: "Vlci #2",
            },
        ],
        "  Hráč ",
        {
            fetch: async (url, init) => {
                const headers = init.headers as Record<string, string>
                requests.push({
                    url,
                    authorization: headers.authorization!,
                    body: String(init.body),
                })
                const seen =
                    url === "https://a.example/api"
                        ? 1791100800000
                        : 1791187200000
                return new Response(
                    JSON.stringify({
                        result: {
                            players: [
                                {
                                    player_id: "76561198000000017",
                                    names: [{ name: "Hráč 17" }],
                                    last_seen_timestamp_ms: seen,
                                },
                            ],
                        },
                    })
                )
            },
        }
    )
    assert.deepEqual(
        requests.map((request) => request.authorization),
        [`Bearer ${KEY}`, `Bearer ${KEY}`]
    )
    assert.match(requests[0]!.body, /"player_name":"Hráč"/)
    assert.deepEqual(hits, [
        {
            playerId: "76561198000000017",
            playerName: "Hráč 17",
            lastSeenAt: 1791187200000,
            platform: "steam",
            server: "Vlci #2",
        },
    ])
})

test("no answer from any server is 'unavailable', not 'not found'", async () => {
    assert.equal(
        await searchStatsServers(
            [{ url: "https://a.example/api", token: KEY }],
            "Hráč",
            { fetch: async () => new Response("", { status: 502 }) }
        ),
        "unavailable"
    )
    assert.deepEqual(await searchStatsServers([], "Hráč"), [])
})
