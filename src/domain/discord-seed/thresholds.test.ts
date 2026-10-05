import assert from "node:assert/strict"
import test from "node:test"

import {
    isBelowStart,
    nextSeedServerPhase,
    reachesLive,
    seedServerStatus,
} from "./thresholds"

const owner = { liveFrom: 40, startBelow: 20 }

test("a server becomes live at 40 players and stays live until it drops under 20", () => {
    assert.equal(nextSeedServerPhase(null, 40, owner), "live")
    assert.equal(nextSeedServerPhase("not_live", 41, owner), "live")
    assert.equal(nextSeedServerPhase("live", 36, owner), "live")
    assert.equal(nextSeedServerPhase("live", 20, owner), "live")
    assert.equal(nextSeedServerPhase("live", 19, owner), "not_live")
    assert.equal(nextSeedServerPhase("not_live", 39, owner), "not_live")
    assert.equal(
        nextSeedServerPhase(null, 25, owner),
        "not_live",
        "without memory a server between the thresholds is not live"
    )
})

test("the live and start thresholds are inclusive and exclusive respectively", () => {
    assert.equal(reachesLive(40, owner), true)
    assert.equal(reachesLive(39, owner), false)
    assert.equal(isBelowStart(19, owner), true)
    assert.equal(isBelowStart(20, owner), false)
})

test("status chips use hysteresis and never guess without fresh data", () => {
    const status = (
        players: number | null,
        phase: "live" | "not_live" | null = null,
        fresh = true,
        online: boolean | null = true
    ) => seedServerStatus({ players, phase, fresh, online }, owner)
    assert.equal(status(3), "below_start", "P5-26 Prázdný 3 / 100")
    assert.equal(status(36, "live"), "live", "P5-27 Živě 36 / 100")
    assert.equal(status(12), "below_start", "P3-04 Pod hranicí startu")
    assert.equal(status(25, "not_live"), "filling")
    assert.equal(status(45, "not_live"), "live")
    assert.equal(status(12, null, false), "unknown")
    assert.equal(status(null), "unknown")
    assert.equal(status(12, null, true, false), "offline")
    assert.equal(status(12, null, true, null), "below_start")
})
