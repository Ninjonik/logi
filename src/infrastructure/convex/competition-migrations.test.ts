import * as migrations from "../../../convex/competitionMigrations"
import * as competitions from "../../../convex/competitions"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const secret = (process.env.INTERNAL_AUTH_SECRET = "dev-internal-auth-secret")

const NOW = "2026-10-01T00:00:00.000Z"
const REAL_GUILD = "123456789012345678"

function setup() {
    const ctx = testContext()
    ctx.db.seed("competitions", {
        _id: "competitions:ecl",
        gameId: "hell_let_loose",
        slug: "ecl-2026",
        name: "European Community League",
        season: "2026",
        format: { kind: "league_with_playoffs", standings: "ecl_cap_score" },
        createdAt: NOW,
        updatedAt: NOW,
    })
    ctx.db.seed("competitions", {
        _id: "competitions:dogs",
        gameId: "wardogs",
        slug: "dogs-cup",
        name: "Dogs Cup",
        season: "1",
        format: { kind: "league_with_playoffs", standings: "ecl_cap_score" },
        createdAt: NOW,
        updatedAt: NOW,
    })
    ctx.db.seed("competitionDivisions", {
        _id: "competitionDivisions:d1",
        competitionId: "competitions:ecl",
        name: "Division 1",
        order: 0,
        createdAt: NOW,
    })
    // A real Logi workspace, placeholder ("ghost") clans created by the old seed,
    // and an alias of the real clan that was never merged.
    ctx.db.seed("guilds", {
        _id: "guilds:omen",
        name: "Omen",
        discordId: REAL_GUILD,
        botInside: true,
    })
    ctx.db.seed("guilds", {
        _id: "guilds:ghost-valkyria",
        name: "Valkyria",
        botInside: false,
    })
    ctx.db.seed("guilds", {
        _id: "guilds:ghost-circle",
        name: "The Circle",
        botInside: false,
    })
    ctx.db.seed("guilds", {
        _id: "guilds:omen-alias",
        name: " OMEN ",
        botInside: false,
    })
    // The catalogue already holds Valkyria (e.g. created by a global administrator).
    ctx.db.seed("teamDirectory", {
        _id: "teamDirectory:valkyria",
        gameId: "hell_let_loose",
        name: "Valkyria",
        shortCode: "VLK",
        logoAssetId: null,
        normalizedName: "valkyria",
        searchText: "Valkyria VLK",
        archivedAt: null,
        mergedIntoTeamId: null,
        linkedGuildId: null,
        revision: 3,
        createdAt: NOW,
        updatedAt: NOW,
        createdBy: "admin",
        updatedBy: "admin",
    })
    const registration = (
        id: string,
        competitionId: string,
        guildId: string,
        withdrawn = false
    ) =>
        ctx.db.seed("competitionTeams", {
            _id: id,
            competitionId,
            guildId,
            divisionId:
                competitionId === "competitions:ecl"
                    ? "competitionDivisions:d1"
                    : undefined,
            withdrawn,
            createdAt: NOW,
            updatedAt: NOW,
        })
    registration("competitionTeams:omen", "competitions:ecl", "guilds:omen")
    registration(
        "competitionTeams:valkyria",
        "competitions:ecl",
        "guilds:ghost-valkyria"
    )
    registration(
        "competitionTeams:circle",
        "competitions:ecl",
        "guilds:ghost-circle",
        true
    )
    registration(
        "competitionTeams:alias",
        "competitions:ecl",
        "guilds:omen-alias"
    )
    // The same workspace in a Wardogs competition is a different catalogue team.
    registration("competitionTeams:dogs", "competitions:dogs", "guilds:omen")
    const fixture = (id: string, teamAId: string, teamBId: string) =>
        ctx.db.seed("competitionFixtures", {
            _id: id,
            competitionId: "competitions:ecl",
            divisionId: "competitionDivisions:d1",
            phase: "league",
            teamAId,
            teamBId,
            scoreA: 5,
            scoreB: 0,
            status: "final",
            createdAt: NOW,
            updatedAt: NOW,
        })
    fixture("competitionFixtures:1", "guilds:omen", "guilds:ghost-valkyria")
    fixture("competitionFixtures:2", "guilds:ghost-circle", "guilds:omen-alias")
    fixture("competitionFixtures:3", "guilds:ghost-circle", "guilds:deleted")
    return ctx
}
type Ctx = ReturnType<typeof setup>

/** Runs the first batch and every batch it schedules, like the Convex scheduler would. */
async function runToCompletion(ctx: Ctx) {
    const results = []
    let args: Record<string, unknown> = {}
    for (let guard = 0; guard < 10; guard++) {
        const scheduled = ctx.scheduler.calls.length
        results.push(await invoke(migrations.adoptGlobalTeams, ctx, args))
        const next = ctx.scheduler.calls[scheduled] as
            [number, unknown, { cursor: string }] | undefined
        if (!next) return results
        assert.equal(next[0], 0)
        args = next[2]
    }
    throw new Error("Migration did not finish.")
}

const teamNamed = (ctx: Ctx, name: string, gameId = "hell_let_loose") =>
    ctx.db.tables.teamDirectory.filter(
        (row) => row.name.toLowerCase() === name && row.gameId === gameId
    )

test("legacy registrations become global teams: real workspaces linked, ghosts unlinked, existing names reused", async () => {
    const ctx = setup()
    const [teams, fixtures] = await runToCompletion(ctx)
    assert.deepEqual(teams, {
        phase: "teams",
        registrationsAdopted: 4,
        registrationsMerged: 1,
        fixturesConverted: 0,
        teamsCreated: 3,
        teamsMatched: 2,
        teamsLinked: 2,
        unresolved: 0,
        done: false,
        nextCursor: "fixtures:",
    })
    assert.equal(fixtures.phase, "fixtures")
    assert.equal(fixtures.done, true)
    assert.equal(fixtures.nextCursor, null)

    const [omen] = teamNamed(ctx, "omen")
    assert.equal(teamNamed(ctx, "omen").length, 1)
    assert.equal(omen.linkedGuildId, REAL_GUILD)
    assert.equal(omen.createdBy, migrations.COMPETITION_MIGRATION_ACTOR)
    const [circle] = teamNamed(ctx, "the circle")
    assert.equal(circle.linkedGuildId, null)
    // Valkyria already existed and keeps its curated fields.
    const [valkyria] = teamNamed(ctx, "valkyria")
    assert.equal(valkyria._id, "teamDirectory:valkyria")
    assert.equal(valkyria.revision, 3)
    // The Wardogs competition gets its own Wardogs team for the same workspace.
    const [dogsOmen] = teamNamed(ctx, "omen", "wardogs")
    assert.equal(dogsOmen.linkedGuildId, REAL_GUILD)

    const registrations = Object.fromEntries(
        ctx.db.tables.competitionTeams.map((row) => [row._id, row])
    )
    assert.equal(registrations["competitionTeams:omen"].teamId, omen._id)
    assert.equal(
        registrations["competitionTeams:valkyria"].teamId,
        "teamDirectory:valkyria"
    )
    assert.equal(registrations["competitionTeams:circle"].teamId, circle._id)
    assert.equal(registrations["competitionTeams:circle"].withdrawn, true)
    assert.equal(registrations["competitionTeams:dogs"].teamId, dogsOmen._id)
    // The unmerged alias resolved to the same team and was folded into it.
    assert.equal(registrations["competitionTeams:alias"], undefined)
    // Legacy references stay as provenance.
    assert.equal(registrations["competitionTeams:omen"].guildId, "guilds:omen")
    assert.ok(
        ctx.db.tables.teamDirectoryAudit.every(
            (row) =>
                row.actor === migrations.COMPETITION_MIGRATION_ACTOR &&
                row.operation === "create"
        )
    )
})

test("fixtures are converted with the same mapping; unresolvable references are reported and left alone", async () => {
    const ctx = setup()
    const [, fixtures] = await runToCompletion(ctx)
    assert.equal(fixtures.fixturesConverted, 2)
    assert.equal(fixtures.unresolved, 1)
    const byId = Object.fromEntries(
        ctx.db.tables.competitionFixtures.map((row) => [row._id, row])
    )
    const [omen] = teamNamed(ctx, "omen")
    const [circle] = teamNamed(ctx, "the circle")
    assert.deepEqual(
        [
            byId["competitionFixtures:1"].sideATeamId,
            byId["competitionFixtures:1"].sideBTeamId,
        ],
        [omen._id, "teamDirectory:valkyria"]
    )
    assert.deepEqual(
        [
            byId["competitionFixtures:2"].sideATeamId,
            byId["competitionFixtures:2"].sideBTeamId,
        ],
        [circle._id, omen._id]
    )
    assert.equal(byId["competitionFixtures:2"].teamAId, "guilds:ghost-circle")
    // The resolvable side is converted; the deleted opponent stays legacy.
    assert.equal(byId["competitionFixtures:3"].sideATeamId, circle._id)
    assert.equal(byId["competitionFixtures:3"].sideBTeamId, undefined)
    // Public standings now read global teams.
    const shown = await invoke(competitions.getPublic, ctx, {
        secret,
        slug: "ecl-2026",
    })
    assert.deepEqual(
        shown.divisions[0].teams.map((row: { id: string }) => row.id),
        [omen._id, "teamDirectory:valkyria", circle._id]
    )
    assert.deepEqual(
        shown.divisions[0].fixtures.map(
            (row: { teamAId: string; teamBId: string }) => [
                row.teamAId,
                row.teamBId,
            ]
        ),
        [
            [omen._id, "teamDirectory:valkyria"],
            [circle._id, omen._id],
            // The known team keeps its catalogue identity next to a deleted opponent.
            [circle._id, "guild:guilds:deleted"],
        ]
    )
})

test("re-running the migration changes nothing and creates no duplicate teams", async () => {
    const ctx = setup()
    await runToCompletion(ctx)
    const teams = structuredClone(ctx.db.tables.teamDirectory)
    const registrations = structuredClone(ctx.db.tables.competitionTeams)
    const fixtures = structuredClone(ctx.db.tables.competitionFixtures)
    const audits = ctx.db.tables.teamDirectoryAudit.length
    const [first, second] = await runToCompletion(ctx)
    assert.equal(first.registrationsAdopted, 0)
    assert.equal(first.registrationsMerged, 0)
    assert.equal(first.teamsCreated, 0)
    assert.equal(second.fixturesConverted, 0)
    // Only the reference that cannot be resolved is looked at again.
    assert.equal(second.unresolved, 1)
    assert.deepEqual(ctx.db.tables.teamDirectory, teams)
    assert.deepEqual(ctx.db.tables.competitionTeams, registrations)
    assert.deepEqual(ctx.db.tables.competitionFixtures, fixtures)
    assert.equal(ctx.db.tables.teamDirectoryAudit.length, audits)
})

test("a ghost processed before its real workspace still ends linked to the workspace", async () => {
    const ctx = testContext()
    ctx.db.seed("competitions", {
        _id: "competitions:c",
        gameId: "hell_let_loose",
        slug: "c-cup",
        name: "C",
        season: "1",
        format: { kind: "league_with_playoffs", standings: "ecl_cap_score" },
        createdAt: NOW,
        updatedAt: NOW,
    })
    ctx.db.seed("guilds", { _id: "guilds:ghost", name: "Yoko" })
    ctx.db.seed("guilds", {
        _id: "guilds:real",
        name: "Yoko",
        discordId: REAL_GUILD,
    })
    for (const guildId of ["guilds:ghost", "guilds:real"])
        ctx.db.seed("competitionTeams", {
            _id: `competitionTeams:${guildId}`,
            competitionId: "competitions:c",
            guildId,
            withdrawn: false,
            createdAt: NOW,
            updatedAt: NOW,
        })
    const [teams] = await runToCompletion(ctx)
    assert.equal(teams.teamsCreated, 1)
    assert.equal(teams.teamsLinked, 1)
    assert.equal(ctx.db.tables.teamDirectory.length, 1)
    assert.equal(ctx.db.tables.teamDirectory[0].linkedGuildId, REAL_GUILD)
    assert.equal(ctx.db.tables.teamDirectory[0].revision, 2)
    assert.equal(ctx.db.tables.competitionTeams.length, 1)
})

test("large competitions are converted in scheduled batches", async () => {
    const ctx = testContext()
    ctx.db.seed("competitions", {
        _id: "competitions:big",
        gameId: "wardogs",
        slug: "big-cup",
        name: "Big",
        season: "1",
        format: { kind: "league_with_playoffs", standings: "ecl_cap_score" },
        createdAt: NOW,
        updatedAt: NOW,
    })
    for (let index = 0; index < 120; index++) {
        ctx.db.seed("guilds", {
            _id: `guilds:g${index}`,
            name: `Clan ${index}`,
        })
        ctx.db.seed("competitionTeams", {
            _id: `competitionTeams:g${index}`,
            competitionId: "competitions:big",
            guildId: `guilds:g${index}`,
            withdrawn: false,
            createdAt: NOW,
            updatedAt: NOW,
        })
    }
    const results = await runToCompletion(ctx)
    assert.deepEqual(
        results.map((row) => [row.phase, row.registrationsAdopted, row.done]),
        [
            ["teams", 100, false],
            ["teams", 20, false],
            ["fixtures", 0, true],
        ]
    )
    assert.equal(ctx.db.tables.teamDirectory.length, 120)
    assert.ok(
        ctx.db.tables.teamDirectory.every((row) => row.gameId === "wardogs")
    )
})

test("an unknown cursor is rejected", async () => {
    await assert.rejects(
        invoke(migrations.adoptGlobalTeams, testContext(), {
            cursor: "elsewhere:1",
        }),
        /Invalid migration cursor/
    )
})

test("same-name clans that played each other keep separate teams and no fixture becomes a self-match", async () => {
    const ctx = setup()
    ctx.db.seed("guilds", {
        _id: "guilds:wolves-real",
        name: "Wolves",
        discordId: "223456789012345678",
        botInside: true,
    })
    ctx.db.seed("guilds", {
        _id: "guilds:wolves-ghost",
        name: "wolves ",
        botInside: false,
    })
    for (const guildId of ["guilds:wolves-real", "guilds:wolves-ghost"])
        ctx.db.seed("competitionTeams", {
            _id: `competitionTeams:${guildId.slice(7)}`,
            competitionId: "competitions:ecl",
            guildId,
            divisionId: "competitionDivisions:d1",
            withdrawn: false,
            createdAt: NOW,
            updatedAt: NOW,
        })
    ctx.db.seed("competitionFixtures", {
        _id: "competitionFixtures:wolves",
        competitionId: "competitions:ecl",
        divisionId: "competitionDivisions:d1",
        phase: "league",
        teamAId: "guilds:wolves-real",
        teamBId: "guilds:wolves-ghost",
        scoreA: 3,
        scoreB: 2,
        status: "final",
        createdAt: NOW,
        updatedAt: NOW,
    })
    await runToCompletion(ctx)
    const wolves = ctx.db.tables.competitionTeams.filter((row) =>
        String(row.guildId).startsWith("guilds:wolves")
    )
    assert.equal(wolves.length, 2)
    assert.notEqual(wolves[0]!.teamId, wolves[1]!.teamId)
    const fixture = ctx.db.tables.competitionFixtures.find(
        (row) => row._id === "competitionFixtures:wolves"
    )!
    assert.notEqual(fixture.sideATeamId, fixture.sideBTeamId)
    assert.deepEqual(
        new Set([fixture.sideATeamId, fixture.sideBTeamId]),
        new Set(wolves.map((row) => row.teamId))
    )
    // No converted fixture anywhere has a team playing itself.
    for (const row of ctx.db.tables.competitionFixtures)
        if (row.sideATeamId) assert.notEqual(row.sideATeamId, row.sideBTeamId)
    // The aliases that never met are still folded into one team.
    assert.equal(
        ctx.db.tables.competitionTeams.filter(
            (row) => row.guildId === "guilds:omen-alias"
        ).length,
        0
    )
})
