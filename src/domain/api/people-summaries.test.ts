import {
    clanMemberSummarySchema,
    clanRosterSummarySchema,
    clanPlayerStatSummarySchema,
    projectAttendance,
    projectPlayerMetrics,
} from "./people-summaries"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const fixture = JSON.parse(
    readFileSync("docs/integrations/website/v0.14/fixtures.json", "utf8")
)
test("versioned consumer fixtures are closed and reject private fields or guessed identity", () => {
    clanMemberSummarySchema.parse(fixture.member)
    clanRosterSummarySchema.parse(fixture.roster)
    clanPlayerStatSummarySchema.parse(fixture.statistics)
    assert.equal(
        clanMemberSummarySchema.safeParse({
            ...fixture.member,
            note: "private",
        }).success,
        false
    )
    assert.equal(
        clanMemberSummarySchema.safeParse({
            ...fixture.member,
            identityState: "unresolved",
        }).success,
        false
    )
    assert.equal(
        clanMemberSummarySchema.safeParse({
            ...fixture.member,
            schemaVersion: 2,
        }).success,
        false
    )
    assert.equal(
        clanRosterSummarySchema.safeParse({
            ...fixture.roster,
            published: false,
        }).success,
        false
    )
    assert.equal(
        clanPlayerStatSummarySchema.safeParse({
            ...fixture.statistics,
            coverage: {
                observedPlayers: 3,
                verifiedMembers: 3,
                unlinkedPlayers: 0,
            },
        }).success,
        false
    )
    const duplicated = {
        ...fixture.statistics,
        players: [...fixture.statistics.players, ...fixture.statistics.players],
        coverage: {
            observedPlayers: 3,
            verifiedMembers: 2,
            unlinkedPlayers: 1,
        },
    }
    assert.equal(
        clanPlayerStatSummarySchema.safeParse(duplicated).success,
        false
    )
})
test("source metrics preserve measured zero and signed cash while absent/invalid values stay null", () => {
    const result = projectPlayerMetrics({
        kills: 0,
        deaths: 2,
        cashDelta: -150,
        headshots: null,
        seconds: -1,
        support: Infinity,
        unknownSecret: 42,
    })
    assert.equal(result.kills, 0)
    assert.equal(result.cashDelta, -150)
    assert.equal(result.headshots, null)
    assert.equal(result.seconds, null)
    assert.equal(result.support, null)
    assert.equal(result.combat, null)
    assert.equal("unknownSecret" in result, false)
})
test("native acknowledgement and confirmation are distinct and never imply gameplay", () => {
    assert.equal(projectAttendance(false, true), "pending")
    assert.equal(projectAttendance(false), "pending")
    assert.equal(projectAttendance(true), "acknowledged")
    assert.equal(projectAttendance(true, true), "confirmed")
})
