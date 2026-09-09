import {
    DEFAULT_GAME_ID,
    filterByGameScope,
    matchesGameScope,
    resolveGameScope,
    withGameOverrides,
} from "./game"
import assert from "node:assert/strict"
import test from "node:test"

test("legacy game records resolve to Hell Let Loose", () => {
    assert.equal(resolveGameScope(), DEFAULT_GAME_ID)
    assert.equal(matchesGameScope(undefined, "hell_let_loose"), true)
    assert.equal(matchesGameScope(undefined, "hell_let_loose_vietnam"), false)
})

test("the general scope includes every game", () => {
    assert.equal(matchesGameScope("wardogs", "all"), true)
})

test("game-scoped read models keep legacy HLL records and exclude other games", () => {
    const records = [
        { id: "legacy" },
        { id: "hllv", gameId: "hell_let_loose_vietnam" as const },
        { id: "wardogs", gameId: "wardogs" as const },
    ]

    assert.deepEqual(
        filterByGameScope(records, "hell_let_loose_vietnam").map(
            (record) => record.id
        ),
        ["hllv"]
    )
    assert.deepEqual(
        filterByGameScope(records, "all").map((record) => record.id),
        ["legacy", "hllv", "wardogs"]
    )
})

test("a game override replaces only the configured clan settings", () => {
    assert.deepEqual(
        withGameOverrides(
            { announcementsChannelId: "general", meetingChannelId: "voice" },
            { hell_let_loose_vietnam: { announcementsChannelId: "vietnam" } },
            "hell_let_loose_vietnam"
        ),
        { announcementsChannelId: "vietnam", meetingChannelId: "voice" }
    )
})
