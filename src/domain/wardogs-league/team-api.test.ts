import {
    autoImportSettingsSchema,
    fixtureCommand,
    fixtureFields,
    matchFixtureTeams,
    mergeFixtureFields,
    teamFixturesSchema,
} from "./team-api"
import {
    fixture,
    template,
    settings,
} from "../../infrastructure/testing/wardogs-team-fixtures"
import assert from "node:assert/strict"
import test from "node:test"
test("API payload preserves nullable facts and rejects invalid dates, IDs and oversized participant lists", () => {
    assert.equal(
        teamFixturesSchema.parse({ upcoming: [fixture], recent: [] })
            .upcoming[0].participants[1].faction,
        null
    )
    for (const patch of [
        { scheduledAt: "tomorrow" },
        { id: "../secret" },
        { participants: Array(4).fill(fixture.participants[0]) },
    ])
        assert.equal(
            teamFixturesSchema.safeParse({
                upcoming: [{ ...fixture, ...patch }],
                recent: [],
            }).success,
            false
        )
})
test("seven-day opening, meeting, closing and duration use the selected template", () => {
    const fields = fixtureFields(fixture, template, settings)
    assert.equal(fields.side, "Valkyra")
    assert.equal(fields.registrationStart, "2027-01-13T19:00:00.000Z")
    assert.equal(fields.registrationEnd, "2027-01-19T18:30:00.000Z")
    assert.equal(fields.meetingStart, "2027-01-20T18:30:00.000Z")
    assert.equal(fields.gameEnd, "2027-01-20T20:30:00.000Z")
    const command = fixtureCommand("clan", fixture, template, settings)
    assert.equal(command.gameId, "wardogs")
    assert.equal(command.createForumChannel, true)
    assert.match(command.description!, /New team \(NEW\)/)
    assert.match(command.description!, /Round 3/)
    assert.throws(
        () =>
            fixtureFields(fixture, template, {
                ...settings,
                registrationHoursBeforeStart: 1,
            }),
        /open before/
    )
    assert.throws(
        () =>
            fixtureFields(
                fixture,
                { ...template, gameId: "hell_let_loose" },
                settings
            ),
        /Wardogs/
    )
})
test("three-way sync retains local overrides across later provider coincidences", () => {
    const baseline = fixtureFields(fixture, template, settings)
    const next = { ...baseline, name: "New API name", map: "Ozeti" }
    const first = mergeFixtureFields(
        { ...baseline, name: "Manager name" },
        baseline,
        next
    )
    assert.deepEqual(first.patch, { map: "Ozeti" })
    assert.deepEqual(first.overrides, ["name"])
    const again = mergeFixtureFields(
        { ...next, name: "New API name" },
        next,
        { ...next, name: "Another name" },
        first.overrides
    )
    assert.equal(again.patch.name, undefined)
})
test("known teams resolve with valid factions, missing and ambiguous teams retain API names without invented IDs", () => {
    const team = {
        id: "teamDirectory:1",
        gameId: "wardogs" as const,
        name: "Valkyria",
        shortCode: "VLK",
        logoAssetId: null,
        logoUrl: null,
        revision: 1,
        archivedAt: null,
    }
    const result = matchFixtureTeams(
        fixture,
        [team],
        [],
        "2027-01-01T00:00:00Z"
    )
    assert.equal(result.assignments[0].side, "Valkyra")
    assert.deepEqual(result.unmatched, ["New team"])
    assert.equal(
        matchFixtureTeams(
            fixture,
            [team, { ...team, id: "duplicate" }],
            [],
            "now"
        ).assignments.length,
        0
    )
    assert.equal(
        matchFixtureTeams(
            fixture,
            [{ ...team, gameId: "hell_let_loose" }],
            [],
            "now"
        ).assignments.length,
        0
    )
})

test("configured clan code puts the clan first without guessing the key owner", async () => {
    const { ownTeamFirst } = await import("./team-api")
    const reversed = {
        ...fixture,
        participants: [...fixture.participants].reverse(),
    }
    const ordered = ownTeamFirst(reversed, "vlk")
    assert.equal(ordered?.participants[0].team.code, "VLK")
    assert.equal(ownTeamFirst(fixture, "OTHER"), null)
})
