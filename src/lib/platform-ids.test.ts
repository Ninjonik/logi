import assert from "node:assert/strict"
import test from "node:test"

import { assessPlatformIdsInput } from "./platform-ids"

test("valid Steam, Epic and prefixed console IDs pass", () => {
    const result = assessPlatformIdsInput(
        "76561198000000001, epic:0123456789abcdef0123456789abcdef, xbox:Gamer Tag"
    )
    assert.equal(result.hasErrors, false)
    assert.deepEqual(
        result.entries.map((entry) => [entry.platform, entry.rawId]),
        [
            ["steam", "76561198000000001"],
            ["epic", "0123456789abcdef0123456789abcdef"],
            ["xbox", "GamerTag"],
        ]
    )
})

test("a long number that is not a SteamID64 is a mistyped Steam ID", () => {
    const result = assessPlatformIdsInput("7656119800000000, steam:123")
    assert.equal(result.hasErrors, true)
    assert.deepEqual(
        result.entries.map((entry) => entry.issue),
        ["steam_format", "steam_format"]
    )
})

test("a malformed epic: ID and an overlong ID are errors", () => {
    const result = assessPlatformIdsInput(`epic:not-an-id, ${"x".repeat(65)}`)
    assert.deepEqual(
        result.entries.map((entry) => entry.issue),
        ["epic_format", "too_long"]
    )
})

test("a repeated ID only informs, an ID of another player is an error", () => {
    const repeated = assessPlatformIdsInput(
        "76561198000000001, 76561198000000001"
    )
    assert.equal(repeated.hasErrors, false)
    assert.equal(repeated.entries[1]?.issue, "duplicate")

    const taken = assessPlatformIdsInput(
        "76561198000000002",
        new Map([["76561198000000002", "Rex"]])
    )
    assert.equal(taken.hasErrors, true)
    assert.equal(taken.entries[0]?.issue, "linked_elsewhere")
})

test("empty input has no entries", () => {
    assert.deepEqual(assessPlatformIdsInput(" , "), {
        entries: [],
        hasErrors: false,
    })
})
