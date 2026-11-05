import {
    normalizeFixtureLink,
    sameKickoffCandidates,
    wardogsFixtureUrlSchema,
} from "./fixture-link"
import assert from "node:assert/strict"
import test from "node:test"

test("fixture links canonicalize only trusted match URLs and reject other games or recurrence", () => {
    const url = "https://wardogsleague.net/matches/cmvjzz9tz03nvml015t5vzlpa"
    assert.equal(
        normalizeFixtureLink({
            gameId: "wardogs",
            wardogsFixtureUrl: wardogsFixtureUrlSchema.parse(` ${url}/ `),
        }),
        url
    )
    for (const value of [
        "https://evil.example/matches/a",
        "https://wardogsleague.net/matches/a?x=1",
        "https://wardogsleague.net.evil.example/matches/a",
    ])
        assert.equal(wardogsFixtureUrlSchema.safeParse(value).success, false)
    assert.equal(
        normalizeFixtureLink({
            gameId: "wardogs",
            kind: "match",
            wardogsFixtureUrl: url,
        }),
        url
    )
    assert.throws(
        () =>
            normalizeFixtureLink({
                gameId: "hell_let_loose",
                wardogsFixtureUrl: url,
            }),
        /Wardogs/
    )
    assert.throws(
        () =>
            normalizeFixtureLink({
                gameId: "wardogs",
                kind: "training",
                wardogsFixtureUrl: url,
            }),
        /Wardogs/
    )
    assert.throws(
        () =>
            normalizeFixtureLink({
                gameId: "wardogs",
                wardogsFixtureUrl: url,
                recurrence: {},
            }),
        /recurring/
    )
})
test("kickoff matching uses the exact instant, including offset-equivalent timestamps, and excludes drafts, training and concluded games", () => {
    const match = {
        gameId: "wardogs",
        kind: "match",
        gameStart: "2027-01-20T20:00:00+01:00",
    }
    assert.deepEqual(
        sameKickoffCandidates([match], "2027-01-20T19:00:00.000Z"),
        [match]
    )
    for (const patch of [
        { gameId: "hell_let_loose" },
        { kind: "training" },
        { isDraft: true },
        { status: "concluded" },
        { gameStart: "2027-01-20T19:00:00.001Z" },
    ])
        assert.equal(
            sameKickoffCandidates(
                [{ ...match, ...patch }],
                "2027-01-20T19:00:00Z"
            ).length,
            0
        )
})
