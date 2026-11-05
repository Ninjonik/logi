import {
    fixture,
    template,
    settings,
} from "../../infrastructure/testing/wardogs-team-fixtures"
import { fixtureFields } from "../../domain/wardogs-league/team-api"
import { planFixtureImport } from "./import-team-fixture"
import assert from "node:assert/strict"
import test from "node:test"
const input = {
    fixture,
    template,
    settings,
    now: Date.parse("2027-01-01T00:00:00Z"),
}
test("imports upcoming scheduled fixtures only; absent time and cancellation require review", () => {
    assert.equal(planFixtureImport(input).kind, "create")
    assert.equal(
        planFixtureImport({ ...input, now: Date.parse("2028-01-01") }).kind,
        "skip"
    )
    assert.equal(
        planFixtureImport({
            ...input,
            fixture: { ...fixture, status: "COMPLETED" },
        }).kind,
        "skip"
    )
    assert.deepEqual(
        planFixtureImport({
            ...input,
            fixture: { ...fixture, scheduledAt: null },
        }),
        { kind: "review", issue: "missing_kickoff" }
    )
    assert.equal(
        planFixtureImport({
            ...input,
            fixture: { ...fixture, status: "CANCELLED" },
        }).kind,
        "review"
    )
})
test("existing matches sync safely; concluded matches are never reopened", () => {
    const baseline = fixtureFields(fixture, template, settings)
    const existing = {
        current: { ...baseline, name: "Local title" },
        baseline,
        overrides: [],
        concluded: false,
    }
    const result = planFixtureImport({
        ...input,
        fixture: { ...fixture, map: "Ozeti" },
        existing,
    })
    assert.equal(result.kind, "update")
    if (result.kind === "update") {
        assert.deepEqual(result.patch, { map: "Ozeti" })
        assert.deepEqual(result.overrides, ["name"])
    }
    assert.equal(
        planFixtureImport({
            ...input,
            existing: { ...existing, concluded: true },
        }).kind,
        "skip"
    )
})

test("a key or team-code mismatch requires review instead of inventing the home team", () => {
    assert.deepEqual(
        planFixtureImport({
            ...input,
            settings: { ...settings, teamCode: "OTHER" },
        }),
        { kind: "review", issue: "team_not_in_fixture" }
    )
})
