import assert from "node:assert/strict"
import test from "node:test"

import { settingsAttentionCount } from "./settings-attention"
import type { SettingsSnapshot } from "./settings-sections"

const ready: SettingsSnapshot = {
    enabledGames: ["hell_let_loose"],
    announcementsChannelId: "channel",
    clanRoleId: "role",
    statsEnabled: false,
    membershipEnabled: false,
    ticketsEnabled: false,
}

test("a clan with every required setting needs no attention", () => {
    assert.equal(settingsAttentionCount(ready), 0)
})

test("optional features that are off do not count", () => {
    assert.equal(
        settingsAttentionCount({
            ...ready,
            statsEnabled: false,
            ticketsEnabled: false,
        }),
        0
    )
})

test("each missing required setting counts once", () => {
    assert.equal(
        settingsAttentionCount({ ...ready, announcementsChannelId: undefined }),
        1
    )
    assert.equal(
        settingsAttentionCount({
            ...ready,
            announcementsChannelId: undefined,
            clanRoleId: undefined,
        }),
        2
    )
    assert.equal(
        settingsAttentionCount({
            ...ready,
            enabledGames: [],
            announcementsChannelId: undefined,
            clanRoleId: undefined,
        }),
        3
    )
})
