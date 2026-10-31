import { actorFixture, seedDashboardActor } from "./testing/dashboard-actor"
import * as enrollment from "../../../convex/competitionEnrollment"
import * as competitions from "../../../convex/competitions"
import * as imageAssets from "../../../convex/imageAssets"
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

test("creating from a competition infers its game, enrolls immediately and safely retries", async () => {
    const ctx = setup()
    const details = {
        name: create.name,
        shortCode: create.shortCode,
        description: create.description,
        idempotencyKey: create.idempotencyKey,
    }
    const input = {
        ...details,
        action: "createAndEnroll",
        competitionId: "competitions:cup",
    }
    const result = await invoke(portal.execute, ctx, { ...access, input })
    assert.equal(result.ok, true)
    assert.equal(result.registrationError, undefined)
    assert.equal(ctx.db.tables.teamDirectory[0].gameId, "wardogs")
    assert.equal(ctx.db.tables.competitionTeams[0].teamId, result.teamId)
    await invoke(portal.execute, ctx, { ...access, input })
    assert.equal(ctx.db.tables.teamDirectory.length, 1)
    assert.equal(ctx.db.tables.competitionTeams.length, 1)
    const forged = await invoke(portal.execute, ctx, {
        ...access,
        input: { ...input, gameId: "hell_let_loose" },
    })
    assert.equal(forged.error, "invalid_input")
})

test("creation explains unmet player minimums and never creates a team for closed or hidden competitions", async () => {
    const ctx = setup()
    const details = {
        name: create.name,
        shortCode: create.shortCode,
        description: create.description,
        idempotencyKey: create.idempotencyKey,
    }
    const input = {
        ...details,
        action: "createAndEnroll",
        competitionId: "competitions:cup",
    }
    ctx.db.tables.competitions[0].registrationMode = "closed"
    assert.equal(
        (await invoke(portal.execute, ctx, { ...access, input })).error,
        "registration_closed"
    )
    assert.equal(ctx.db.tables.teamDirectory?.length ?? 0, 0)
    ctx.db.tables.competitions[0].registrationMode = "approval"
    ctx.db.tables.competitions[0].published = false
    assert.equal(
        (await invoke(portal.execute, ctx, { ...access, input })).error,
        "not_found"
    )
    ctx.db.tables.competitions[0].published = true
    ctx.db.tables.competitions[0].minimumLinkedPlayers = 10
    const result = await invoke(portal.execute, ctx, { ...access, input })
    assert.equal(result.ok, true)
    assert.equal(result.registrationError, "minimum_players")
    assert.equal(ctx.db.tables.teamDirectory.length, 1)
    assert.equal(ctx.db.tables.competitionTeams?.length ?? 0, 0)
    ctx.db.tables.competitions[0].minimumLinkedPlayers = 1
    const accepted = await invoke(portal.execute, ctx, { ...access, input })
    assert.equal(accepted.registrationError, undefined)
    assert.equal(ctx.db.tables.competitionTeams[0].status, "pending")
})

test("one reusable team enters multiple competitions and withdrawal affects only the selected entry", async () => {
    const ctx = setup()
    ctx.db.seed("competitions", {
        ...ctx.db.tables.competitions[0],
        _id: "competitions:second",
        name: "Another cup",
        slug: "second",
    })
    const result = await invoke(portal.execute, ctx, {
        ...access,
        input: create,
    })
    for (const competitionId of ["competitions:cup", "competitions:second"])
        await invoke(portal.execute, ctx, {
            ...access,
            input: { action: "enroll", teamId: result.teamId, competitionId },
        })
    const view = await invoke(portal.account, ctx, {
        ...access,
        competitionId: null,
    })
    assert.equal(view.teams.length, 1)
    assert.deepEqual(
        view.registrations
            .map((row: { competitionName: string }) => row.competitionName)
            .sort(),
        ["Another cup", "Cup"]
    )
    await invoke(portal.execute, ctx, {
        ...access,
        input: {
            action: "withdraw",
            teamId: result.teamId,
            competitionId: "competitions:cup",
        },
    })
    assert.equal(
        ctx.db.tables.competitionTeams.find(
            (row) => row.competitionId === "competitions:second"
        )?.withdrawn,
        false
    )
})

test("team owners edit branding without a bot, with revisions and team-scoped avatar authorization", async () => {
    const ctx = setup()
    const created = await invoke(portal.execute, ctx, {
        ...access,
        input: create,
    })
    await invoke(portal.execute, ctx, {
        ...access,
        input: {
            action: "enroll",
            teamId: created.teamId,
            competitionId: "competitions:cup",
        },
    })
    const scoped = {
        secret: access.secret,
        actor: access.actor,
        guildId: `team:${created.teamId}`,
    }
    assert.equal(
        (
            await invoke(imageAssets.reserveUpload, ctx, {
                ...scoped,
                kind: "team-logo",
            })
        ).ok,
        true
    )
    assert.equal(
        (
            await invoke(imageAssets.reserveUpload, ctx, {
                ...scoped,
                kind: "panel-banner",
            })
        ).error,
        "invalid_kind"
    )
    ctx.db.seed("imageAssets", {
        _id: "imageAssets:own",
        guildId: scoped.guildId,
        kind: "team-logo",
        state: "ready",
        publicUrl: "https://logi.test/own.png",
    })
    ctx.db.seed("imageAssets", {
        _id: "imageAssets:foreign",
        guildId: "team:someone-else",
        kind: "team-logo",
        state: "ready",
    })
    const input = {
        action: "updateTeam",
        teamId: created.teamId,
        expectedRevision: 1,
        name: "Renamed",
        shortCode: "RN",
        description: "New description",
        logoAssetId: "imageAssets:foreign",
    }
    assert.equal(
        (await invoke(portal.execute, ctx, { ...access, input })).error,
        "asset_unavailable"
    )
    const saved = await invoke(portal.execute, ctx, {
        ...access,
        input: { ...input, logoAssetId: "imageAssets:own" },
    })
    assert.equal(saved.ok, true)
    assert.deepEqual(saved.competitionSlugs, ["cup"])
    const view = await invoke(portal.account, ctx, {
        ...access,
        competitionId: null,
    })
    assert.equal(view.teams[0].name, "Renamed")
    assert.equal(view.teams[0].shortCode, "RN")
    assert.equal(view.teams[0].logoUrl, "https://logi.test/own.png")
    assert.equal(view.teams[0].revision, 2)
    assert.equal(
        ctx.db.tables.imageAssetReferences[0].assetId,
        "imageAssets:own"
    )
    assert.equal(
        (await invoke(portal.execute, ctx, { ...access, input })).error,
        "revision_conflict"
    )
    ctx.db.tables.leagueTeamProfiles[0].ownerUserId = "users:other"
    assert.equal(
        (
            await invoke(portal.execute, ctx, {
                ...access,
                input: { ...input, expectedRevision: 2 },
            })
        ).error,
        "forbidden"
    )
    await assert.rejects(
        invoke(imageAssets.reserveUpload, ctx, {
            ...scoped,
            kind: "team-logo",
        }),
        /Forbidden/
    )
})

test("workspace creation connects directly and replays without permitting another team", async () => {
    const ctx = setup(),
        guildId = "300000000000000003"
    ctx.db.tables.guilds[0].discordId = guildId
    ctx.db.tables.discordMemberAccess[0].guildId = guildId
    const managed = { ...access, guildIds: [guildId] }
    const input = { ...create, guildId }
    assert.equal(
        (await invoke(portal.execute, ctx, { ...access, input })).error,
        "forbidden"
    )
    assert.equal(
        (await invoke(portal.execute, ctx, { ...managed, input })).ok,
        true
    )
    assert.equal(ctx.db.tables.teamDirectory[0].linkedGuildId, guildId)
    assert.equal(
        (await invoke(portal.execute, ctx, { ...managed, input })).ok,
        true
    )
    assert.equal(
        (
            await invoke(portal.execute, ctx, {
                ...managed,
                input: {
                    ...input,
                    name: "Second",
                    idempotencyKey: "47b80ee5-3d14-44a8-b56e-36380fded330",
                },
            })
        ).error,
        "guild_already_linked"
    )
    ctx.db.tables.leagueTeamProfiles[0].ownerUserId = "users:original-owner"
    assert.equal(
        (
            await invoke(portal.execute, ctx, {
                ...managed,
                input: {
                    action: "updateTeam",
                    teamId: ctx.db.tables.teamDirectory[0]._id,
                    expectedRevision: 1,
                    name: "Clan managed",
                    shortCode: null,
                    description: null,
                    logoAssetId: null,
                },
            })
        ).ok,
        true
    )
})

test("linking preserves team history, invitations and players and unifies both enrollment paths", async () => {
    const ctx = setup()
    const guildId = "300000000000000003"
    ctx.db.tables.guilds[0].discordId = guildId
    ctx.db.tables.guilds[0].name = "Our clan"
    ctx.db.tables.guilds[0].memberIds = [actorFixture.subject]
    ctx.db.tables.discordMemberAccess[0].guildId = guildId
    const managed = { ...access, guildIds: [guildId] }
    const created = await invoke(portal.execute, ctx, {
        ...managed,
        input: create,
    })
    await invoke(portal.execute, ctx, {
        ...managed,
        input: {
            action: "enroll",
            teamId: created.teamId,
            competitionId: "competitions:cup",
        },
    })
    const before = await invoke(portal.account, ctx, {
        ...managed,
        competitionId: null,
    })
    assert.equal(before.workspaces[0].teamId, null)
    const link = { action: "linkTeam", teamId: created.teamId, guildId }
    assert.equal(
        (await invoke(portal.execute, ctx, { ...managed, input: link })).ok,
        true
    )
    const revision = ctx.db.tables.teamDirectory[0].revision
    assert.equal(
        (await invoke(portal.execute, ctx, { ...managed, input: link })).ok,
        true
    )
    assert.equal(ctx.db.tables.teamDirectory[0].revision, revision)
    const after = await invoke(portal.account, ctx, {
        ...managed,
        competitionId: null,
    })
    assert.equal(after.teams[0].id, created.teamId)
    assert.equal(after.teams[0].inviteToken, before.teams[0].inviteToken)
    assert.equal(after.teams[0].accountOwner, true)
    assert.equal(after.teams[0].members, 1) // owner is also a clan member, counted once
    assert.equal(after.teams[0].linkedGuildId, guildId)
    assert.equal(after.workspaces[0].teamId, created.teamId)
    assert.deepEqual(after.registrations, before.registrations)
    const clan = await invoke(enrollment.list, ctx, { ...access, guildId })
    assert.equal(clan.teams[0].id, created.teamId)
    assert.equal(clan.linkedPlayers, 1)
    assert.equal(
        (
            await invoke(enrollment.execute, ctx, {
                ...access,
                guildId,
                input: {
                    action: "withdraw",
                    teamId: created.teamId,
                    competitionId: "competitions:cup",
                },
            })
        ).ok,
        true
    )
    assert.equal(
        (await invoke(portal.account, ctx, { ...managed, competitionId: null }))
            .registrations[0].withdrawn,
        true
    )
    assert.equal(ctx.db.tables.competitionTeams.length, 1)
})

test("linking rejects forged workspace lists, lost admin access, foreign teams and occupied servers across games", async () => {
    const ctx = setup()
    const guildId = "300000000000000003"
    ctx.db.tables.guilds[0].discordId = guildId
    ctx.db.tables.discordMemberAccess[0].guildId = guildId
    const managed = { ...access, guildIds: [guildId] }
    const created = await invoke(portal.execute, ctx, {
        ...managed,
        input: create,
    })
    const link = { action: "linkTeam", teamId: created.teamId, guildId }
    ctx.db.tables.discordMemberAccess[0].isAdmin = false
    ctx.db.tables.discordMemberAccess[0].hasDashboardAccess = false
    assert.equal(
        (await invoke(portal.execute, ctx, { ...managed, input: link })).error,
        "forbidden"
    )
    const view = await invoke(portal.account, ctx, {
        ...managed,
        competitionId: null,
    })
    assert.equal(view.workspaces.length, 0)
    ctx.db.tables.discordMemberAccess[0].isAdmin = true
    ctx.db.tables.leagueTeamProfiles[0].ownerUserId = "users:someone-else"
    assert.equal(
        (await invoke(portal.execute, ctx, { ...managed, input: link })).error,
        "forbidden"
    )
    ctx.db.tables.leagueTeamProfiles[0].ownerUserId = actorFixture.userRecordId
    ctx.db.seed("teamDirectory", {
        _id: "teamDirectory:other",
        gameId: "hell_let_loose",
        linkedGuildId: guildId,
        name: "Other",
        archivedAt: null,
        mergedIntoTeamId: null,
    })
    assert.equal(
        (await invoke(portal.execute, ctx, { ...managed, input: link })).error,
        "guild_already_linked"
    )
    assert.equal(ctx.db.tables.teamDirectory[0].linkedGuildId, null)
    ctx.db.tables.teamDirectory[1].linkedGuildId = null
    ctx.db.tables.teamDirectory[0].linkedGuildId = "400000000000000004"
    assert.equal(
        (await invoke(portal.execute, ctx, { ...managed, input: link })).error,
        "team_already_linked"
    )
    ctx.db.tables.teamDirectory[0].archivedAt = "2026-01-01T00:00:00Z"
    assert.equal(
        (await invoke(portal.execute, ctx, { ...managed, input: link })).error,
        "not_found"
    )
})
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
