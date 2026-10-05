import assert from "node:assert/strict"
import test from "node:test"

import { selectedDivisionId, splitPublicFixtures } from "./public-fixtures"
import type { PublicCompetitionFixture } from "./competition"

function fixture(
    id: string,
    status: PublicCompetitionFixture["status"],
    scheduledAt?: string
): PublicCompetitionFixture {
    return {
        id,
        phase: "league",
        teamAId: "a",
        teamBId: "b",
        status,
        ...(scheduledAt ? { scheduledAt } : {}),
    }
}

test("upcoming fixtures are soonest first, results newest first", () => {
    const { upcoming, results } = splitPublicFixtures([
        fixture("late", "scheduled", "2026-10-18T18:00:00Z"),
        fixture("undated", "scheduled"),
        fixture("soon", "scheduled", "2026-10-17T18:00:00Z"),
        fixture("old", "final", "2026-09-27T18:00:00Z"),
        fixture("forfeit", "forfeit", "2026-10-04T18:00:00Z"),
        fixture("noDate", "final"),
    ])
    assert.deepEqual(
        upcoming.map((item) => item.id),
        ["soon", "late", "undated"]
    )
    assert.deepEqual(
        results.map((item) => item.id),
        ["forfeit", "old", "noDate"]
    )
})

test("an empty division has nothing to show", () => {
    assert.deepEqual(splitPublicFixtures([]), { upcoming: [], results: [] })
})

test("the requested division is shown when it exists", () => {
    const divisions = [{ id: "d1" }, { id: "d2" }]
    assert.equal(selectedDivisionId(divisions, "d2"), "d2")
    assert.equal(selectedDivisionId(divisions, "nope"), "d1")
    assert.equal(selectedDivisionId(divisions, undefined), "d1")
    assert.equal(selectedDivisionId([], "d1"), null)
})
