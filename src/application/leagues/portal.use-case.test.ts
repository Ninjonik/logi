import {
    executeLeagueCommand,
    type FixtureFacts,
    type LeaguePortalPorts,
    type EnrollmentFacts,
} from "./portal.use-case"
import assert from "node:assert/strict"
import test from "node:test"
function setup() {
    const writes: unknown[] = []
    let facts: EnrollmentFacts = {
        owned: true,
        active: true,
        gameMatches: true,
        published: true,
        registrationMode: "approval",
        minimumLinkedPlayers: null,
        members: 1,
        existing: null,
        slug: "cup",
    }
    let fixture: FixtureFacts = {
        id: "fixture",
        competitionId: "cup",
        slug: "cup",
        gameId: "wardogs",
        published: true,
        participants: ["a", "b", "c"],
        ownedParticipants: ["a"],
        organiser: false,
        final: false,
        hasLinkedEvents: false,
        host: { kind: "external", label: "Outside" },
    }
    const reports: Array<{ id: string; teamId: string; scores: number[] }> = []
    const ports: LeaguePortalPorts = {
        createTeam: async () => ({ ok: true }),
        joinTeam: async () => ({ ok: true }),
        enrollmentFacts: async () => facts,
        saveRegistration: async (...args) => {
            writes.push(args)
        },
        fixture: async () => fixture,
        linkedHost: async () => null,
        saveHost: async (...args) => {
            writes.push(args)
        },
        reportScore: async (_fixture, teamId, scores) => {
            reports.push({ id: teamId, teamId, scores })
        },
        reports: async () => reports,
        finalizeScore: async (...args) => {
            writes.push(args)
        },
    }
    return {
        ports,
        writes,
        reports,
        setFacts: (value: Partial<EnrollmentFacts>) => {
            facts = { ...facts, ...value }
        },
        setFixture: (value: Partial<FixtureFacts>) => {
            fixture = { ...fixture, ...value }
        },
    }
}
test("enrollment policy, ownership and player minimum are enforced before writes", async () => {
    const s = setup()
    s.setFacts({ owned: false })
    assert.deepEqual(
        await executeLeagueCommand(s.ports, {
            action: "enroll",
            teamId: "a",
            competitionId: "cup",
        }),
        { error: "forbidden" }
    )
    s.setFacts({ owned: true, minimumLinkedPlayers: 30 })
    assert.deepEqual(
        await executeLeagueCommand(s.ports, {
            action: "enroll",
            teamId: "a",
            competitionId: "cup",
        }),
        { error: "minimum_players" }
    )
    assert.equal(s.writes.length, 0)
    s.setFacts({ minimumLinkedPlayers: null })
    assert.deepEqual(
        await executeLeagueCommand(s.ports, {
            action: "enroll",
            teamId: "a",
            competitionId: "cup",
        }),
        { ok: true, slug: "cup" }
    )
    assert.deepEqual(s.writes[0], ["a", "cup", "pending", false])
})
test("closed enrollment still permits withdrawal and accepted replays do not downgrade", async () => {
    const s = setup()
    s.setFacts({
        registrationMode: "closed",
        existing: { status: "approved", withdrawn: false },
    })
    assert.equal(
        "ok" in
            (await executeLeagueCommand(s.ports, {
                action: "enroll",
                teamId: "a",
                competitionId: "cup",
            })),
        true
    )
    assert.equal(s.writes.length, 0)
    await executeLeagueCommand(s.ports, {
        action: "withdraw",
        teamId: "a",
        competitionId: "cup",
    })
    assert.deepEqual(s.writes[0], ["a", "cup", "approved", true])
})
test("a guessed healthy server identifier never bypasses source ownership", async () => {
    const s = setup()
    assert.deepEqual(
        await executeLeagueCommand(s.ports, {
            action: "setHost",
            fixtureId: "fixture",
            host: { kind: "linked", sourceRef: "foreign" },
        }),
        { error: "server_unavailable" }
    )
    assert.equal(s.writes.length, 0)
})
test("foreign captains and incorrect score lengths cannot report", async () => {
    const s = setup()
    assert.deepEqual(
        await executeLeagueCommand(s.ports, {
            action: "reportScore",
            fixtureId: "fixture",
            teamId: "b",
            participantTeamIds: ["a", "b", "c"],
            scores: [100, 80, 60],
        }),
        { error: "forbidden" }
    )
    assert.deepEqual(
        await executeLeagueCommand(s.ports, {
            action: "reportScore",
            fixtureId: "fixture",
            teamId: "a",
            participantTeamIds: ["a", "b", "c"],
            scores: [100, 80],
        }),
        { error: "invalid_scores" }
    )
    assert.equal(s.reports.length, 0)
})
test("external scores remain provisional until every participant agrees", async () => {
    const s = setup()
    const command = {
        action: "reportScore",
        fixtureId: "fixture",
        teamId: "a",
        participantTeamIds: ["a", "b", "c"],
        scores: [100, 80, 60],
    }
    await executeLeagueCommand(s.ports, command)
    assert.equal(s.writes.length, 0)
    s.reports.push(
        { id: "b", teamId: "b", scores: [100, 80, 60] },
        { id: "c", teamId: "c", scores: [100, 80, 60] }
    )
    await executeLeagueCommand(s.ports, command)
    assert.deepEqual(s.writes[0], ["fixture", [100, 80, 60], false])
})
test("only organisers approve a report and connected fixtures reject manual scores", async () => {
    const s = setup()
    s.reports.push({ id: "r", teamId: "a", scores: [100, 80, 60] })
    assert.deepEqual(
        await executeLeagueCommand(s.ports, {
            action: "approveScore",
            fixtureId: "fixture",
            reportId: "r",
        }),
        { error: "forbidden" }
    )
    s.setFixture({ organiser: true })
    await executeLeagueCommand(s.ports, {
        action: "approveScore",
        fixtureId: "fixture",
        reportId: "r",
    })
    assert.deepEqual(s.writes[0], ["fixture", [100, 80, 60], true])
    s.setFixture({
        host: {
            kind: "linked",
            sourceRef: "source",
            guildId: "guild",
            label: "Host",
        },
    })
    assert.deepEqual(
        await executeLeagueCommand(s.ports, {
            action: "reportScore",
            fixtureId: "fixture",
            teamId: "a",
            participantTeamIds: ["a", "b", "c"],
            scores: [100, 80, 60],
        }),
        { error: "manual_scores_external_only" }
    )
})

test("a stale form cannot submit scores after the participant order changes", async () => {
    const s = setup()
    const result = await executeLeagueCommand(s.ports, {
        action: "reportScore",
        fixtureId: "fixture",
        teamId: "a",
        participantTeamIds: ["b", "a", "c"],
        scores: [100, 80, 60],
    })
    assert.deepEqual(result, { error: "invalid_scores" })
    assert.equal(s.reports.length, 0)
})
