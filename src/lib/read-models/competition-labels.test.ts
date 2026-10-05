import assert from "node:assert/strict"
import test from "node:test"

import { parseClanFixtureLabels } from "./competition-labels"

test("fixture labels are keyed by event and invalid rows are dropped", () => {
    const labels = parseClanFixtureLabels([
        { eventId: "e1", name: "ECL", season: "2026", phase: "league" },
        { eventId: "e2", name: "ECL", season: "2026", phase: "final" },
        { eventId: 3, name: "ECL", season: "2026", phase: "league" },
    ])
    assert.deepEqual(
        [...labels.entries()],
        [["e1", { name: "ECL", season: "2026", phase: "league" }]]
    )
    assert.equal(parseClanFixtureLabels(undefined).size, 0)
})
