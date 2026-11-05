import { fixture } from "../testing/wardogs-team-fixtures"
import { fetchTeamFixtures } from "./fetch-team-fixtures"
import assert from "node:assert/strict"
import test from "node:test"
test("uses only the fixed authenticated endpoint, disallows redirects, and validates data", async () => {
    const result = await fetchTeamFixtures(
        "synthetic-api-key",
        async (url, init) => {
            assert.equal(
                String(url),
                "https://wardogsleague.net/api/v1/team/fixtures?limit=20"
            )
            assert.equal(init?.redirect, "error")
            assert.equal(
                new Headers(init?.headers).get("Authorization"),
                "Bearer synthetic-api-key"
            )
            return Response.json({ upcoming: [fixture], recent: [] })
        }
    )
    assert.equal(result.upcoming[0].id, fixture.id)
    await assert.rejects(
        fetchTeamFixtures(
            "synthetic-api-key",
            async () => new Response(null, { status: 401 })
        ),
        /rejected/
    )
    await assert.rejects(
        fetchTeamFixtures("synthetic-api-key", async () =>
            Response.json({ upcoming: [] })
        )
    )
    await assert.rejects(
        fetchTeamFixtures(
            "synthetic-api-key",
            async () => new Response("x".repeat(1024 * 1024 + 1))
        ),
        /too large/
    )
    await assert.rejects(
        fetchTeamFixtures("bad\nheader", async () => {
            throw new Error("must not fetch")
        })
    )
})
