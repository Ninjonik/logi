import { trackingDecision } from "./tracking"
import assert from "node:assert/strict"
import test from "node:test"
const now = Date.parse("2026-10-03T12:00:00Z")
const row = {
    firstSeenAt: now,
    pinned: false,
    discordRefs: [],
    ignored: false,
    paused: false,
}
const match = {
    scheduledAt: "2026-10-10T18:30:00Z",
    teams: [{ code: "VLK", profileUrl: "https://wardogsleague.net/teams/VLK" }],
}
test("automatic tracking matches current policy, while pinning survives filter and reference removal", () => {
    assert.equal(trackingDecision(row, match, ["VLK"], now).tracked, true)
    assert.equal(trackingDecision(row, match, ["ROG"], now).tracked, false)
    assert.equal(
        trackingDecision({ ...row, pinned: true }, match, ["ROG"], now).tracked,
        true
    )
})
test("ignore persists over discovery and historic discoveries do not announce", () => {
    assert.equal(
        trackingDecision({ ...row, ignored: true }, match, ["VLK"], now)
            .tracked,
        false
    )
    const old = { ...match, scheduledAt: "2026-09-01T12:00:00Z" }
    assert.deepEqual(trackingDecision(row, old, ["VLK"], now), {
        tracked: true,
        automatic: true,
        state: "archived",
        announce: false,
    })
    assert.equal(
        trackingDecision({ ...row, pinned: true }, old, ["VLK"], now).announce,
        true
    )
})
test("paused records remain readable without scheduling refresh and unknown start is bounded", () => {
    assert.equal(
        trackingDecision({ ...row, paused: true }, match, ["VLK"], now).state,
        "paused"
    )
    assert.equal(
        trackingDecision(
            row,
            { ...match, scheduledAt: null },
            ["VLK"],
            now + 14 * 86400000
        ).state,
        "archived"
    )
})
