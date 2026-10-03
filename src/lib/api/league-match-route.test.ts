import { leagueMatchResponse } from "./league-match-route"
import assert from "node:assert/strict"
import test from "node:test"
const url = "https://wardogsleague.net/matches/cmuqt8ep605e1lf018w2nlywu"
const request = (query: string) =>
    new Request(`https://logi.test/api/v1/clan/league-matches?${query}`)
test("URL read rejects ambiguous queries before invoking backend", async () => {
    for (const query of [
        "",
        `game=wardogs&url=${url}&url=${url}`,
        `game=hell_let_loose&url=${url}`,
        `game=wardogs&url=https://localhost/x`,
        `game=wardogs&url=${url}&force=true`,
    ]) {
        const response = await leagueMatchResponse(request(query), async () =>
            assert.fail("unexpected backend")
        )
        assert.equal(response.status, 400)
        assert.equal(response.headers.get("cache-control"), "no-store")
    }
})
test("no-snapshot failures preserve retry metadata without claiming success", async () => {
    const response = await leagueMatchResponse(
        request(`game=wardogs&url=${url}`),
        async () => ({
            kind: "data",
            data: {
                snapshot: null,
                stale: true,
                ageSeconds: null,
                error: "rate_limited",
                lastAttemptAt: null,
                nextRefreshAt: new Date(Date.now() + 120000).toISOString(),
            },
        })
    )
    assert.equal(response.status, 429)
    assert.ok(Number(response.headers.get("retry-after")) >= 119)
    assert.equal((await response.json()).data.snapshot, null)
})
