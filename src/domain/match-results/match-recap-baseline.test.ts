import assert from "node:assert/strict"
import test from "node:test"

import { calculateMatchRecapBaseline } from "./match-recap-baseline"

test("uses the ten most recent recorded matches for a recap baseline", () => {
    const baseline = calculateMatchRecapBaseline([
        {
            importedAt: "2026-09-10T00:00:00.000Z",
            kills: 10,
            deaths: 5,
            killDeathRatio: 2,
        },
        {
            importedAt: "2026-09-12T00:00:00.000Z",
            kills: 20,
            deaths: 10,
            killDeathRatio: 2,
        },
    ])

    assert.deepEqual(baseline, { matches: 2, kills: 15, deaths: 7.5, kd: 2 })
})

test("returns an empty baseline only when the player has no prior matches", () => {
    assert.deepEqual(calculateMatchRecapBaseline([]), {
        matches: 0,
        kills: 0,
        deaths: 0,
        kd: 0,
    })
})
