import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as competitions from "../../../convex/competitions"
import { invoke, testContext } from "./testing/database"
import * as portal from "../../../convex/leaguePortal"
import assert from "node:assert/strict"
import test from "node:test"
process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret"
const access = {
    secret: process.env.INTERNAL_AUTH_SECRET,
    actor: actorFixture,
    guildIds: [],
}
function setup() {
    const ctx = testContext()
    seedDashboardActor(ctx.db, "unused")
    ctx.db.seed("competitions", {
        _id: "competitions:cup",
        name: "Cup",
        slug: "cup",
        season: "2026",
        gameId: "wardogs",
        published: true,
        registrationMode: "automatic",
        minimumLinkedPlayers: null,
    })
    return ctx
}
const create = {
    action: "createTeam",
    gameId: "wardogs",
    name: "New Team",
    shortCode: "NEW",
    description: null,
    idempotencyKey: "37b80ee5-3d14-44a8-b56e-36380fded330",
}
test("a basic team needs only the current account, preserves idempotency and counts its owner", async () => {
    const ctx = setup()
    const result = await invoke(portal.execute, ctx, {
        ...access,
        input: create,
    })
    assert.equal(result.ok, true)
    const again = await invoke(portal.execute, ctx, {
        ...access,
        input: create,
    })
    assert.equal(again.teamId, result.teamId)
    assert.equal(ctx.db.tables.teamDirectory.length, 1)
    assert.equal(ctx.db.tables.leagueTeamMembers.length, 1)
    assert.equal(ctx.db.tables.leagueTeamProfiles.length, 1)
    assert.equal(ctx.db.tables.teamDirectory[0].linkedGuildId, null)
    const account = await invoke(portal.account, ctx, {
        ...access,
        competitionId: "competitions:cup",
    })
    assert.equal(account.teams[0].owner, true)
    assert.equal(account.teams[0].members, 1)
    assert.equal(account.teams[0].inviteToken.length, 32)
    assert.deepEqual(
        await invoke(portal.execute, ctx, {
            ...access,
            input: {
                action: "enroll",
                teamId: result.teamId,
                competitionId: "competitions:cup",
            },
        }),
        { ok: true, slug: "cup" }
    )
    assert.equal(ctx.db.tables.competitionTeams[0].status, "approved")
})
test("expired sessions and tampered actors cannot create or read teams", async () => {
    const ctx = setup()
    await assert.rejects(
        invoke(portal.execute, ctx, {
            ...access,
            actor: { ...actorFixture, subject: "222222222222222222" },
            input: create,
        })
    )
    await assert.rejects(
        invoke(portal.account, ctx, {
            ...access,
            secret: "invalid",
            competitionId: null,
        })
    )
    assert.equal(ctx.db.tables.teamDirectory?.length ?? 0, 0)
})
test("catalogue duplicates cannot be claimed by creating a profile", async () => {
    const ctx = setup()
    await invoke(portal.execute, ctx, { ...access, input: create })
    const result = await invoke(portal.execute, ctx, {
        ...access,
        input: {
            ...create,
            idempotencyKey: "47b80ee5-3d14-44a8-b56e-36380fded330",
        },
    })
    assert.equal(result.error, "duplicate_name")
    assert.equal(ctx.db.tables.leagueTeamProfiles.length, 1)
})
test("external host facts are public but invite tokens and score reports are not", async () => {
    const ctx = setup()
    ctx.db.seed("competitionDivisions", {
        _id: "competitionDivisions:one",
        competitionId: "competitions:cup",
        name: "One",
        order: 0,
    })
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:one",
        competitionId: "competitions:cup",
        divisionId: "competitionDivisions:one",
        phase: "league",
        sideATeamId: "teamDirectory:a",
        sideBTeamId: "teamDirectory:b",
        status: "scheduled",
        hosting: { kind: "external", label: "External host" },
    })
    const view = await invoke(competitions.getPublic, ctx, {
        secret: access.secret,
        slug: "cup",
    })
    assert.deepEqual(view.divisions[0].fixtures[0].hosting, {
        kind: "external",
        label: "External host",
    })
    assert.equal(view.registrationMode, "automatic")
    assert.equal(JSON.stringify(view).includes("inviteToken"), false)
})
test("a non-participant cannot select a host or submit a score", async () => {
    const ctx = setup()
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:one",
        competitionId: "competitions:cup",
        phase: "league",
        sideATeamId: "teamDirectory:a",
        sideBTeamId: "teamDirectory:b",
        status: "scheduled",
        hosting: { kind: "external", label: "Host" },
    })
    assert.equal(
        (
            await invoke(portal.execute, ctx, {
                ...access,
                input: {
                    action: "setHost",
                    fixtureId: "competitionFixtures:one",
                    host: { kind: "external", label: "Changed" },
                },
            })
        ).error,
        "forbidden"
    )
    assert.equal(
        (
            await invoke(portal.execute, ctx, {
                ...access,
                input: {
                    action: "reportScore",
                    fixtureId: "competitionFixtures:one",
                    teamId: "teamDirectory:a",
                    participantTeamIds: ["a", "b", "c"],
                    scores: [100, 50],
                },
            })
        ).error,
        "forbidden"
    )
})

test("team invitations add distinct members without granting ownership or leaking owner invite tokens", async () => {
    const ctx = setup()
    const created = await invoke(portal.execute, ctx, {
        ...access,
        input: create,
    })
    const ownerView = await invoke(portal.account, ctx, {
        ...access,
        competitionId: null,
    })
    const token = ownerView.teams[0].inviteToken
    const member = {
        ...actorFixture,
        subject: "200000000000000002",
        userRecordId: "users:member",
        sid: "b".repeat(43),
    }
    ctx.db.seed("users", {
        _id: member.userRecordId,
        discordId: member.subject,
        name: "Player",
        sessionVersion: 0,
    })
    ctx.db.seed("dashboardSessions", {
        _id: "sessions:member",
        sid: member.sid,
        subject: member.subject,
        userRecordId: member.userRecordId,
        userSessionVersion: 0,
        expiresAt: Date.now() + 3600000,
    })
    const memberAccess = { ...access, actor: member }
    await invoke(portal.execute, ctx, {
        ...memberAccess,
        input: { action: "joinTeam", token },
    })
    await invoke(portal.execute, ctx, {
        ...memberAccess,
        input: { action: "joinTeam", token },
    })
    assert.equal(ctx.db.tables.leagueTeamMembers.length, 2)
    const memberView = await invoke(portal.account, ctx, {
        ...memberAccess,
        competitionId: null,
    })
    assert.equal(memberView.teams[0].owner, false)
    assert.equal(memberView.teams[0].inviteToken, null)
    assert.equal(
        (
            await invoke(portal.execute, ctx, {
                ...memberAccess,
                input: {
                    action: "enroll",
                    teamId: created.teamId,
                    competitionId: "competitions:cup",
                },
            })
        ).error,
        "forbidden"
    )
})
test("a submitted score locks hosting so reports cannot be carried to a different server", async () => {
    const ctx = setup()
    const team = await invoke(portal.execute, ctx, { ...access, input: create })
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:one",
        competitionId: "competitions:cup",
        phase: "league",
        participantTeamIds: [team.teamId, "teamDirectory:b"],
        status: "scheduled",
        hosting: { kind: "external", label: "Original" },
    })
    await invoke(portal.execute, ctx, {
        ...access,
        input: {
            action: "reportScore",
            fixtureId: "competitionFixtures:one",
            teamId: team.teamId,
            participantTeamIds: [team.teamId, "teamDirectory:b"],
            scores: [100, 50],
        },
    })
    assert.equal(
        (
            await invoke(portal.execute, ctx, {
                ...access,
                input: {
                    action: "setHost",
                    fixtureId: "competitionFixtures:one",
                    host: { kind: "external", label: "Different" },
                },
            })
        ).error,
        "hosting_locked"
    )
})

test("reports cannot be reused or approved after an organiser changes the fixture pairing", async () => {
    const ctx = setup()
    const team = await invoke(portal.execute, ctx, { ...access, input: create })
    const fixtureId = "competitionFixtures:pairing"
    ctx.db.seed("competitionFixtures", {
        _id: fixtureId,
        competitionId: "competitions:cup",
        phase: "league",
        participantTeamIds: [team.teamId, "teamDirectory:b"],
        status: "scheduled",
        hosting: { kind: "external", label: "Host" },
    })
    await invoke(portal.execute, ctx, {
        ...access,
        input: {
            action: "reportScore",
            fixtureId,
            teamId: team.teamId,
            participantTeamIds: [team.teamId, "teamDirectory:b"],
            scores: [100, 50],
        },
    })
    assert.deepEqual(ctx.db.tables.leagueScoreReports[0].participantTeamIds, [
        team.teamId,
        "teamDirectory:b",
    ])
    const reportId = ctx.db.tables.leagueScoreReports[0]._id
    await ctx.db.patch(fixtureId, {
        participantTeamIds: ["teamDirectory:b", team.teamId],
    })
    const stale = await invoke(portal.execute, ctx, {
        ...access,
        input: {
            action: "reportScore",
            fixtureId,
            teamId: team.teamId,
            participantTeamIds: [team.teamId, "teamDirectory:b"],
            scores: [100, 50],
        },
    })
    assert.equal(stale.error, "invalid_scores")
    const approved = await invoke(portal.execute, ctx, {
        ...access,
        actor: { ...actorFixture, superadmin: true },
        input: { action: "approveScore", fixtureId, reportId },
    })
    assert.equal(approved.error, "invalid_scores")
    assert.equal(ctx.db.tables.competitionFixtures[0].status, "scheduled")
    const view = await invoke(portal.account, ctx, {
        ...access,
        competitionId: "competitions:cup",
    })
    assert.equal(view.fixtures[0].reports.length, 0)
    await invoke(portal.execute, ctx, {
        ...access,
        input: {
            action: "reportScore",
            fixtureId,
            teamId: team.teamId,
            participantTeamIds: ["teamDirectory:b", team.teamId],
            scores: [50, 100],
        },
    })
    const fresh = await invoke(portal.execute, ctx, {
        ...access,
        actor: { ...actorFixture, superadmin: true },
        input: { action: "approveScore", fixtureId, reportId },
    })
    assert.equal(fresh.ok, true)
    assert.equal(ctx.db.tables.competitionFixtures[0].status, "final")
    assert.deepEqual(
        ctx.db.tables.competitionFixtures[0].participantScores,
        [50, 100]
    )
})
