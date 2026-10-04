import {
    matchTeamsEditability,
    projectMatchTeams,
    refreshMatchTeamSnapshot,
    resolveMatchTeams,
    validateMatchTeamInputs,
    validatePreservedMatchTeams,
    type DirectoryTeamLookup,
    type MatchTeamAssignment,
} from "./match-teams"
import assert from "node:assert/strict"
import test from "node:test"

const now = "2026-10-04T12:00:00.000Z"
const lookup = (
    id: string,
    overrides: Partial<DirectoryTeamLookup> = {}
): DirectoryTeamLookup => ({
    id,
    guildId: "guild",
    gameId: "hell_let_loose",
    name: `Team ${id}`,
    shortCode: id.toUpperCase(),
    logoAssetId: `asset-${id}`,
    logoUrl: `https://logi/api/image-assets/${id}.png`,
    revision: 2,
    archivedAt: null,
    ...overrides,
})
const teams = new Map(
    [
        lookup("a"),
        lookup("b"),
        lookup("c", { gameId: "wardogs" }),
        lookup("gone", { archivedAt: now }),
        lookup("foreign", { guildId: "other" }),
    ].map((team) => [team.id, team])
)

test("slot, side and duplicate rules follow the game", () => {
    assert.equal(
        validateMatchTeamInputs("hell_let_loose", [
            { teamId: "a", slot: "a", side: "Allies" },
            { teamId: "b", slot: "b", side: null },
        ]),
        null
    )
    assert.equal(
        validateMatchTeamInputs("hell_let_loose", [
            { teamId: "a", slot: "c", side: null },
        ]),
        "invalid_match_teams"
    )
    assert.equal(
        validateMatchTeamInputs("hell_let_loose", [
            { teamId: "a", slot: "a", side: "Valkyra" },
        ]),
        "invalid_match_teams"
    )
    assert.equal(
        validateMatchTeamInputs("wardogs", [
            { teamId: "a", slot: "a", side: "Valkyra" },
            { teamId: "b", slot: "b", side: "Valkyra" },
        ]),
        "invalid_match_teams"
    )
    assert.equal(
        validateMatchTeamInputs("wardogs", [
            { teamId: "a", slot: "a", side: null },
            { teamId: "a", slot: "b", side: null },
        ]),
        "invalid_match_teams"
    )
    assert.equal(
        validateMatchTeamInputs("wardogs", [
            { teamId: "a", slot: "a", side: "Valkyra" },
            { teamId: "b", slot: "c", side: "Lonestar" },
        ]),
        null
    )
})

test("new selections need an active same-game, same-workspace team and capture a snapshot", () => {
    const resolved = resolveMatchTeams({
        guildId: "guild",
        gameId: "hell_let_loose",
        inputs: [
            { teamId: "b", slot: "b", side: "Axis" },
            { teamId: "a", slot: "a", side: null },
        ],
        previous: undefined,
        teams,
        now,
    })
    assert.ok(resolved.ok)
    assert.deepEqual(
        resolved.assignments.map((entry) => entry.slot),
        ["a", "b"]
    )
    assert.deepEqual(resolved.assignments[0]!.snapshot, {
        name: "Team a",
        shortCode: "A",
        logoAssetId: "asset-a",
        logoUrl: "https://logi/api/image-assets/a.png",
        teamRevision: 2,
        capturedAt: now,
    })
    for (const [teamId, error] of [
        ["missing", "team_not_found"],
        ["foreign", "team_not_found"],
        ["gone", "team_archived"],
        ["c", "team_game_mismatch"],
    ] as const)
        assert.deepEqual(
            resolveMatchTeams({
                guildId: "guild",
                gameId: "hell_let_loose",
                inputs: [{ teamId, slot: "a", side: null }],
                previous: undefined,
                teams,
                now,
            }),
            { ok: false, error }
        )
})

test("an existing assignment keeps its snapshot through slot/side edits and archival", () => {
    const previous: MatchTeamAssignment[] = [
        {
            teamId: "gone",
            slot: "a",
            side: null,
            snapshot: {
                name: "Old name",
                shortCode: null,
                logoAssetId: null,
                logoUrl: null,
                teamRevision: 1,
                capturedAt: "2026-01-01T00:00:00.000Z",
            },
        },
    ]
    const resolved = resolveMatchTeams({
        guildId: "guild",
        gameId: "hell_let_loose",
        inputs: [
            { teamId: "gone", slot: "b", side: "Axis" },
            { teamId: "a", slot: "a", side: "Allies" },
        ],
        previous,
        teams,
        now,
    })
    assert.ok(resolved.ok)
    assert.deepEqual(resolved.assignments[1], {
        teamId: "gone",
        slot: "b",
        side: "Axis",
        snapshot: previous[0]!.snapshot,
    })
    assert.equal(
        validatePreservedMatchTeams({
            gameId: "wardogs",
            assignments: resolved.assignments,
            teams,
        }),
        "team_game_mismatch"
    )
    assert.equal(
        validatePreservedMatchTeams({
            gameId: "wardogs",
            assignments: [
                { ...resolved.assignments[0]!, teamId: "c", side: "Axis" },
            ],
            teams,
        }),
        "invalid_match_teams"
    )
    assert.deepEqual(
        resolveMatchTeams({
            guildId: "guild",
            gameId: "hell_let_loose",
            inputs: [],
            previous,
            teams,
            now,
        }),
        { ok: true, assignments: [] }
    )
})

test("refresh re-captures only from an active entry and concluded matches are frozen", () => {
    const assignment: MatchTeamAssignment = {
        teamId: "a",
        slot: "a",
        side: null,
        snapshot: {
            name: "Stale",
            shortCode: null,
            logoAssetId: null,
            logoUrl: null,
            teamRevision: 1,
            capturedAt: "2026-01-01T00:00:00.000Z",
        },
    }
    const refreshed = refreshMatchTeamSnapshot({
        guildId: "guild",
        gameId: "hell_let_loose",
        assignment,
        team: teams.get("a"),
        now,
    })
    assert.ok(refreshed.ok)
    assert.equal(refreshed.assignment.snapshot.name, "Team a")
    assert.equal(refreshed.assignment.snapshot.teamRevision, 2)
    assert.deepEqual(
        refreshMatchTeamSnapshot({
            guildId: "guild",
            gameId: "hell_let_loose",
            assignment,
            team: teams.get("gone"),
            now,
        }),
        { ok: false, error: "team_archived" }
    )
    assert.equal(matchTeamsEditability({ kind: "training" }), "training_event")
    assert.equal(
        matchTeamsEditability({ kind: "match", status: "concluded" }),
        "match_concluded"
    )
    assert.equal(matchTeamsEditability({ status: "registration" }), null)
    assert.equal(projectMatchTeams(undefined), null)
    assert.deepEqual(projectMatchTeams([refreshed.assignment]), [
        {
            teamId: "a",
            slot: "a",
            side: null,
            name: "Team a",
            shortCode: "A",
            logoUrl: "https://logi/api/image-assets/a.png",
            teamRevision: 2,
            capturedAt: now,
        },
    ])
})
