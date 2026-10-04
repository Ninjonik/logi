import { parseLeagueFixtureQuery } from "./league-fixtures-route"
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
