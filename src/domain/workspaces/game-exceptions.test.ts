import assert from "node:assert/strict"
import test from "node:test"

import {
    gameExceptions,
    showsGameExceptions,
    withGameExceptions,
    type GameOverrides,
} from "./game-exceptions"

type Overrides = {
    announcementsChannelId?: string
    meetingChannelId?: string
    playerStatsServers?: Array<{ url: string; token: string }>
}

const stored: GameOverrides<Overrides> = {
    wardogs: { announcementsChannelId: "300", meetingChannelId: "301" },
    hell_let_loose_vietnam: { announcementsChannelId: "302" },
}

test("only enabled games with a value count as exceptions", () => {
    assert.deepEqual(
        gameExceptions(stored, "announcementsChannelId", [
            "hell_let_loose",
            "wardogs",
        ]),
        { wardogs: "300" }
    )
    assert.deepEqual(
        gameExceptions(
            { wardogs: { playerStatsServers: [] } },
            "playerStatsServers",
            ["wardogs"]
        ),
        {}
    )
})

test("editing one setting keeps the game's other settings and disabled games", () => {
    const next = withGameExceptions(
        stored,
        "announcementsChannelId",
        { hell_let_loose: "303" },
        ["hell_let_loose", "wardogs"]
    )
    assert.deepEqual(next, {
        hell_let_loose: { announcementsChannelId: "303" },
        wardogs: { meetingChannelId: "301" },
        hell_let_loose_vietnam: { announcementsChannelId: "302" },
    })
    assert.equal(stored.wardogs?.announcementsChannelId, "300")
})

test("an emptied exception falls back and an empty game is dropped", () => {
    const next = withGameExceptions(
        { wardogs: { announcementsChannelId: "300" } },
        "announcementsChannelId",
        { wardogs: "" },
        ["hell_let_loose", "wardogs"]
    )
    assert.deepEqual(next, {})
    assert.deepEqual(
        withGameExceptions(
            { wardogs: { playerStatsServers: [{ url: "u", token: "t" }] } },
            "playerStatsServers",
            { wardogs: [] },
            ["wardogs"]
        ),
        {}
    )
})

test("exceptions show for several games or when one is already stored", () => {
    assert.equal(showsGameExceptions(["hell_let_loose"], [{}, {}]), false)
    assert.equal(showsGameExceptions(["hell_let_loose", "wardogs"], [{}]), true)
    assert.equal(
        showsGameExceptions(["wardogs"], [{}, { wardogs: "300" }]),
        true
    )
})
