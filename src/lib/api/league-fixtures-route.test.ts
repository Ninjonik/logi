import {
    parseLeagueFixtureQuery,
    parseLeagueOverviewQuery,
} from "./league-fixtures-route"
import { allowsApiKeyRead } from "../../domain/api/key-access"
import assert from "node:assert/strict"
import test from "node:test"
test("tracked collection requires exact Wardogs scope and bounded pagination", () => {
    const request = (q: string) =>
        new Request(`https://logi.test/api/v1/clan/league-fixtures?${q}`)
    assert.deepEqual(
        parseLeagueFixtureQuery(request("game=wardogs&limit=20")),
        { cursor: null, limit: 20 }
    )
    for (const q of [
        "game=hell_let_loose",
        "game=wardogs&game=wardogs",
        "game=wardogs&limit=101",
        "game=wardogs&url=https://evil.test",
        "game=wardogs&limit=0",
    ])
        assert.equal(parseLeagueFixtureQuery(request(q)), null)
    assert.equal(
        allowsApiKeyRead(undefined, "league-fixtures", "wardogs"),
        false
    )
    assert.equal(
        allowsApiKeyRead(
            { resources: ["league-matches"], gameIds: ["wardogs"] },
            "league-fixtures",
            "wardogs"
        ),
        false
    )
    assert.equal(
        allowsApiKeyRead(
            { resources: ["league-fixtures"], gameIds: ["wardogs"] },
            "league-fixtures",
            "wardogs"
        ),
        true
    )
})
test("the League overview takes one Wardogs game and at most the ten-fixture panel window", () => {
    const request = (q: string) =>
        new Request(
            `https://logi.test/api/v1/clan/league-fixtures/overview?${q}`
        )
    assert.deepEqual(parseLeagueOverviewQuery(request("game=wardogs")), {
        limit: 6,
    })
    assert.deepEqual(
        parseLeagueOverviewQuery(request("game=wardogs&limit=10")),
        { limit: 10 }
    )
    for (const q of [
        "",
        "game=hell_let_loose",
        "game=wardogs&game=wardogs",
        "game=wardogs&limit=0",
        "game=wardogs&limit=11",
        "game=wardogs&limit=1.5",
        "game=wardogs&limit=6&limit=6",
        "game=wardogs&cursor=x",
    ])
        assert.equal(parseLeagueOverviewQuery(request(q)), null, q)
})
