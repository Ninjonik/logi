import {
    agreedManualScores,
    hostChangeError,
    leagueCommandSchema,
    permitsFixtureStatistics,
    usableLeagueServer,
} from "./portal"
import assert from "node:assert/strict"
import test from "node:test"
test("external fixtures never accept imported statistics", () => {
    assert.equal(permitsFixtureStatistics({ kind: "external" }), false)
    assert.equal(permitsFixtureStatistics({ kind: "linked" }), true)
    assert.equal(permitsFixtureStatistics(undefined), true)
})
test("hosting requires authority and locks after events or results exist", () => {
    const base = {
        published: true,
        participant: true,
        organiser: false,
        final: false,
        hasLinkedEvents: false,
    }
    assert.equal(hostChangeError(base), null)
    assert.equal(hostChangeError({ ...base, participant: false }), "forbidden")
    assert.equal(
        hostChangeError({ ...base, hasLinkedEvents: true }),
        "hosting_locked"
    )
    assert.equal(hostChangeError({ ...base, final: true }), "hosting_locked")
})
test("statistics server must be online, current, and support history", () => {
    const base = {
        enabled: true,
        gameMatches: true,
        error: null,
        observedAt: "2026-10-29T12:00:00Z",
        state: "online",
        capabilities: ["match_history"],
        now: Date.parse("2026-10-29T12:10:00Z"),
    }
    assert.equal(usableLeagueServer(base), true)
    for (const patch of [
        { enabled: false },
        { gameMatches: false },
        { error: "unauthorized" },
        { capabilities: [] },
        { state: "offline" },
        { observedAt: "2026-10-29T11:00:00Z" },
    ])
        assert.equal(usableLeagueServer({ ...base, ...patch }), false)
})
test("all participants must submit the same ordered score before standings change", () => {
    const teams = ["a", "b", "c"]
    const a = { teamId: "a", scores: [100, 80, 60] }
    assert.equal(agreedManualScores(teams, [a]), null)
    assert.equal(
        agreedManualScores(teams, [
            a,
            { teamId: "b", scores: [100, 80, 60] },
            { teamId: "c", scores: [100, 80, 61] },
        ]),
        null
    )
    assert.deepEqual(
        agreedManualScores(
            teams,
            teams.map((teamId) => ({ teamId, scores: [100, 80, 60] }))
        ),
        [100, 80, 60]
    )
    assert.equal(agreedManualScores(["a", "a"], [a]), null)
})
test("commands reject forged ownership fields and unsafe scores", () => {
    assert.equal(
        leagueCommandSchema.safeParse({
            action: "reportScore",
            fixtureId: "f",
            teamId: "a",
            scores: [1, -1],
        }).success,
        false
    )
    assert.equal(
        leagueCommandSchema.safeParse({
            action: "setHost",
            fixtureId: "f",
            host: { kind: "external", label: "Server", sourceRef: "forged" },
        }).success,
        false
    )
})
