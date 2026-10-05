import {
    decideTeamArchive,
    decideTeamCreate,
    decideTeamMerge,
    decideTeamRestore,
    decideTeamUpdate,
    normalizeTeamName,
    projectTeam,
    TEAM_DIRECTORY_LIMIT,
    teamCreateSchema,
    teamInitials,
    teamUpdateSchema,
    type TeamEntity,
} from "./team"
import assert from "node:assert/strict"
import test from "node:test"

const now = "2026-10-04T12:00:00.000Z"
const team: TeamEntity = {
    id: "team-1",
    gameId: "hell_let_loose",
    name: "Valkyria",
    shortCode: "VLK",
    logoAssetId: null,
    description: null,
    links: [],
    linkedGuildId: null,
    mergedIntoTeamId: null,
    normalizedName: "valkyria",
    archivedAt: null,
    revision: 3,
    createdAt: now,
    updatedAt: now,
}

test("normalization folds compatibility forms, whitespace and case but keeps accents", () => {
    assert.equal(normalizeTeamName("  Ｖalkyria   Česká  "), "valkyria česká")
    assert.notEqual(normalizeTeamName("Česká"), normalizeTeamName("Ceská"))
    assert.equal(normalizeTeamName("ǅ Team"), normalizeTeamName("dž team"))
})

test("labels are trimmed and collapsed; control characters and empty values are rejected", () => {
    const parsed = teamCreateSchema.parse({
        gameId: "wardogs",
        name: "  Team\tLonestar  ",
        shortCode: null,
        idempotencyKey: "retry-key-0001",
    })
    assert.equal(parsed.name, "Team Lonestar")
    assert.equal(parsed.logoAssetId, null)
    for (const name of [
        "",
        "   ",
        "bad\u0000name",
        "line\nbreak",
        "x".repeat(121),
    ])
        assert.equal(
            teamCreateSchema.safeParse({
                gameId: "wardogs",
                name,
                idempotencyKey: "retry-key-0001",
            }).success,
            false,
            JSON.stringify(name)
        )
    assert.equal(
        teamCreateSchema.safeParse({
            gameId: "hell_let_loose_vietnam",
            name: "Valid",
            idempotencyKey: "retry-key-0001",
        }).success,
        false
    )
    assert.equal(
        teamCreateSchema.safeParse({
            gameId: "wardogs",
            name: "Valid",
            shortCode: "TOO-LONG-SHORT-CODE",
            idempotencyKey: "retry-key-0001",
        }).success,
        false
    )
})

test("creating rejects exact duplicates per game and respects the catalogue limit", () => {
    const input = teamCreateSchema.parse({
        gameId: "wardogs",
        name: "Manticore",
        idempotencyKey: "retry-key-0001",
    })
    assert.deepEqual(input.links, [])
    assert.equal(input.description, null)
    assert.equal(input.linkedGuildId, null)
    assert.deepEqual(
        decideTeamCreate({
            input,
            existing: { id: "old", archivedAt: now },
            count: 1,
            now,
        }),
        { ok: false, error: "duplicate_name", existingId: "old" }
    )
    assert.deepEqual(
        decideTeamCreate({
            input,
            existing: null,
            count: TEAM_DIRECTORY_LIMIT,
            now,
        }),
        { ok: false, error: "limit_reached" }
    )
    const created = decideTeamCreate({ input, existing: null, count: 2, now })
    assert.ok(created.ok)
    assert.equal(created.team.revision, 1)
    assert.equal(created.team.normalizedName, "manticore")
    assert.equal(created.team.archivedAt, null)
    assert.equal(created.team.mergedIntoTeamId, null)
})

test("descriptions, links and linked workspaces are bounded and validated", () => {
    const base = {
        gameId: "hell_let_loose",
        name: "Valid",
        idempotencyKey: "retry-key-0001",
    }
    const parsed = teamCreateSchema.parse({
        ...base,
        description: "  Line one\nLine two  ",
        links: ["https://valkyria.example", "https://discord.gg/abc"],
        linkedGuildId: "123456789012345678",
    })
    assert.equal(parsed.description, "Line one\nLine two")
    assert.equal(parsed.links.length, 2)
    for (const extra of [
        { description: "x".repeat(501) },
        { description: "bad\u0007" },
        { links: ["http://insecure.example"] },
        { links: ["https://user:secret@example.com"] },
        { links: ["https://a.example", "https://a.example"] },
        {
            links: [
                "https://a.example",
                "https://b.example",
                "https://c.example",
                "https://d.example",
            ],
        },
        { linkedGuildId: "not-a-guild" },
    ])
        assert.equal(
            teamCreateSchema.safeParse({ ...base, ...extra }).success,
            false,
            JSON.stringify(extra)
        )
})

test("merge needs both current revisions, the same game and an active target", () => {
    const target: TeamEntity = {
        ...team,
        id: "team-2",
        name: "Valkyria Main",
        normalizedName: "valkyria main",
        revision: 5,
    }
    const input = {
        expectedRevision: 3,
        targetTeamId: "team-2",
        targetRevision: 5,
    }
    const merged = decideTeamMerge({ source: team, target, input, now })
    assert.ok(merged.ok)
    assert.equal(merged.source.mergedIntoTeamId, "team-2")
    assert.equal(merged.source.archivedAt, now)
    assert.equal(merged.source.revision, 4)
    assert.equal(merged.target.revision, 6)
    assert.deepEqual(
        decideTeamMerge({ source: team, target: null, input, now }),
        { ok: false, error: "not_found" }
    )
    assert.deepEqual(
        decideTeamMerge({
            source: team,
            target,
            input: { ...input, targetRevision: 4 },
            now,
        }),
        { ok: false, error: "revision_conflict" }
    )
    for (const [source, other] of [
        [team, { ...target, id: "team-1" }],
        [team, { ...target, gameId: "wardogs" as const }],
        [team, { ...target, archivedAt: now }],
        [{ ...team, mergedIntoTeamId: "team-9" }, target],
    ] as const)
        assert.deepEqual(
            decideTeamMerge({ source, target: other, input, now }),
            { ok: false, error: "invalid_merge" }
        )
})

test("updates need the current revision, an active record and a free name", () => {
    const rename = teamUpdateSchema.parse({
        expectedRevision: 3,
        name: "Valkyria II",
    })
    assert.deepEqual(
        decideTeamUpdate({
            team,
            input: { ...rename, expectedRevision: 2 },
            conflicting: null,
            now,
        }),
        { ok: false, error: "revision_conflict" }
    )
    assert.deepEqual(
        decideTeamUpdate({
            team: { ...team, archivedAt: now },
            input: rename,
            conflicting: null,
            now,
        }),
        { ok: false, error: "archived" }
    )
    assert.deepEqual(
        decideTeamUpdate({
            team,
            input: rename,
            conflicting: { id: "other" },
            now,
        }),
        { ok: false, error: "duplicate_name", existingId: "other" }
    )
    const applied = decideTeamUpdate({
        team,
        input: teamUpdateSchema.parse({ expectedRevision: 3, shortCode: null }),
        conflicting: { id: team.id },
        now,
    })
    assert.ok(applied.ok)
    assert.equal(applied.patch.name, "Valkyria")
    assert.equal(applied.patch.shortCode, null)
    assert.equal(applied.patch.logoAssetId, null)
    assert.equal(applied.patch.revision, 4)
    assert.equal(
        teamUpdateSchema.safeParse({ expectedRevision: 3 }).success,
        false
    )
})

test("archive and restore flip state once and bump the revision", () => {
    const archived = decideTeamArchive({
        team,
        input: { expectedRevision: 3 },
        now,
    })
    assert.ok(archived.ok)
    assert.equal(archived.patch.archivedAt, now)
    assert.equal(archived.patch.revision, 4)
    assert.deepEqual(
        decideTeamArchive({
            team: { ...team, archivedAt: now, revision: 4 },
            input: { expectedRevision: 4 },
            now,
        }),
        { ok: false, error: "archived" }
    )
    assert.deepEqual(
        decideTeamRestore({ team, input: { expectedRevision: 3 }, now }),
        { ok: false, error: "not_archived" }
    )
    const restored = decideTeamRestore({
        team: { ...team, archivedAt: now, revision: 4 },
        input: { expectedRevision: 4 },
        now,
    })
    assert.ok(restored.ok)
    assert.equal(restored.patch.archivedAt, null)
    assert.equal(restored.patch.revision, 5)
})

test("website DTOs null absent values and never expose actors or asset identifiers", () => {
    assert.deepEqual(
        projectTeam({ ...team, logoAssetId: "asset" }, "https://logi/x.png"),
        {
            id: "team-1",
            gameId: "hell_let_loose",
            name: "Valkyria",
            shortCode: "VLK",
            logoUrl: "https://logi/x.png",
            description: null,
            links: [],
            revision: 3,
            updatedAt: now,
        }
    )
    assert.equal(projectTeam(team, "https://stale").logoUrl, null)
    assert.equal(teamInitials("Team Lonestar", null), "TL")
    assert.equal(teamInitials("Valkyria", "vlk"), "VLK")
})
