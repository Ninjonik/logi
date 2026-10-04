import {
    fixtureFormInput,
    fixtureFormValues,
    fromLocalDateTimeInput,
    suggestCompetitionSlug,
    toLocalDateTimeInput,
    type FixtureFormValues,
} from "./competition-form"
import type { CompetitionFixtureView } from "@/domain/competitions/admin-view"
import assert from "node:assert/strict"
import test from "node:test"

test("slug suggestions are lowercase, accent-free and valid or empty", () => {
    assert.equal(
        suggestCompetitionSlug("European Community League", "2026"),
        "european-community-league-2026"
    )
    assert.equal(suggestCompetitionSlug("Ligue Été", "S1"), "ligue-ete-s1")
    assert.equal(suggestCompetitionSlug("!!!", ""), "")
    assert.ok(suggestCompetitionSlug("a".repeat(80), "2026").length <= 64)
})

test("datetime-local values round-trip through ISO instants", () => {
    const iso = fromLocalDateTimeInput("2026-10-10T19:30")
    assert.ok(iso)
    assert.equal(toLocalDateTimeInput(iso), "2026-10-10T19:30")
    assert.equal(fromLocalDateTimeInput(""), null)
    assert.equal(fromLocalDateTimeInput("not a date"), null)
    assert.equal(toLocalDateTimeInput(null), "")
})

const team = (id: string, legacy = false) => ({
    id,
    name: id,
    shortCode: null,
    logoUrl: null,
    archived: false,
    legacy,
})
const stored: CompetitionFixtureView = {
    id: "f1",
    divisionId: "d1",
    phase: "playoff",
    sideA: team("t1"),
    sideB: team("guild:g1", true),
    scheduledAt: null,
    scoreA: 5,
    scoreB: 0,
    status: "final",
    event: null,
}

test("the fixture form starts from a stored fixture or a scheduled league default", () => {
    assert.deepEqual(fixtureFormValues(null, "d2"), {
        divisionId: "d2",
        phase: "league",
        sideATeamId: "",
        sideBTeamId: "",
        scheduledAt: "",
        status: "scheduled",
        scoreA: "",
        scoreB: "",
    })
    // Legacy sides must be chosen again from registered teams.
    assert.deepEqual(fixtureFormValues(stored, "d2"), {
        divisionId: "d1",
        phase: "playoff",
        sideATeamId: "t1",
        sideBTeamId: "",
        scheduledAt: "",
        status: "final",
        scoreA: "5",
        scoreB: "0",
    })
})

test("the fixture form produces a domain-valid write or nothing", () => {
    const values: FixtureFormValues = {
        divisionId: "d1",
        phase: "league",
        sideATeamId: "t1",
        sideBTeamId: "t2",
        scheduledAt: "",
        status: "final",
        scoreA: "3",
        scoreB: " 2 ",
    }
    assert.deepEqual(fixtureFormInput(values), {
        divisionId: "d1",
        phase: "league",
        sideATeamId: "t1",
        sideBTeamId: "t2",
        scheduledAt: null,
        status: "final",
        scoreA: 3,
        scoreB: 2,
    })
    assert.equal(fixtureFormInput({ ...values, scoreB: "" }), null)
    assert.equal(fixtureFormInput({ ...values, scoreB: "2.5" }), null)
    assert.equal(fixtureFormInput({ ...values, sideBTeamId: "t1" }), null)
    assert.equal(fixtureFormInput({ ...values, sideBTeamId: "" }), null)
    // Scheduled fixtures drop typed scores.
    const scheduled = fixtureFormInput({ ...values, status: "scheduled" })
    assert.equal(scheduled?.scoreA, null)
    assert.equal(scheduled?.scoreB, null)
})
