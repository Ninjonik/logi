import {
    TEAM_MUTATION_FOR,
    parseTeamsQuery,
    teamCommandResponse,
    teamCommandSchema,
    teamErrorStatus,
} from "./teams-dashboard-route"
import assert from "node:assert/strict"
import test from "node:test"

const query = (search: string) => parseTeamsQuery(new URLSearchParams(search))

test("list queries default to active entries, page 50 and no search", () => {
    assert.deepEqual(query("game=wardogs"), {
        kind: "list",
        gameId: "wardogs",
        archived: false,
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(
        query(
            "game=hell_let_loose&archived=true&search=%20Red%20&cursor=abc&limit=10"
        ),
        {
            kind: "list",
            gameId: "hell_let_loose",
            archived: true,
            search: "Red",
            cursor: "abc",
            limit: 10,
        }
    )
    // Whitespace-only search is dropped rather than sent as a blank term.
    assert.equal("search" in (query("game=wardogs&search=%20%20") ?? {}), false)
})

test("list queries reject unsupported games, bad flags and out-of-range limits", () => {
    assert.equal(query(""), null)
    assert.equal(query("game=hell_let_loose_vietnam"), null)
    assert.equal(query("game=wardogs&archived=yes"), null)
    assert.equal(query("game=wardogs&limit=0"), null)
    assert.equal(query("game=wardogs&limit=101"), null)
    assert.equal(query("game=wardogs&limit=5.5"), null)
    assert.equal(query(`game=wardogs&search=${"x".repeat(65)}`), null)
})

test("a teamId lookup wins over list parameters and must be a usable ID", () => {
    assert.deepEqual(query("teamId=team_1&game=wardogs"), {
        kind: "get",
        teamId: "team_1",
    })
    assert.equal(query("teamId="), null)
    assert.equal(query(`teamId=${"x".repeat(65)}`), null)
})

test("commands are validated with the domain schemas before reaching Convex", () => {
    const create = teamCommandSchema.safeParse({
        action: "create",
        input: {
            gameId: "wardogs",
            name: "  Red   Wolves ",
            idempotencyKey: "0b3c9e4a-8f4e-4b1c-9c37-1b2a3c4d5e6f",
        },
    })
    assert.ok(create.success)
    assert.equal(create.data.action, "create")
    if (create.data.action === "create") {
        assert.equal(create.data.input.name, "Red Wolves")
        assert.equal(create.data.input.shortCode, null)
        assert.equal(create.data.input.logoAssetId, null)
    }
    assert.equal(TEAM_MUTATION_FOR[create.data.action], "teams:create")

    const update = teamCommandSchema.safeParse({
        action: "update",
        teamId: "team_1",
        input: { expectedRevision: 2, logoAssetId: null },
    })
    assert.ok(update.success)
    assert.equal(
        teamCommandSchema.safeParse({
            action: "update",
            teamId: "team_1",
            input: { expectedRevision: 2 },
        }).success,
        false,
        "an update must change at least one field"
    )
    for (const action of ["archive", "restore"] as const) {
        assert.ok(
            teamCommandSchema.safeParse({
                action,
                teamId: "team_1",
                input: { expectedRevision: 1 },
            }).success
        )
        assert.equal(TEAM_MUTATION_FOR[action], `teams:${action}`)
    }
    for (const body of [
        null,
        { action: "delete", teamId: "team_1", input: { expectedRevision: 1 } },
        { action: "archive", input: { expectedRevision: 1 } },
        { action: "archive", teamId: "team_1", input: { expectedRevision: 0 } },
        {
            action: "create",
            input: { gameId: "wardogs", name: "x", idempotencyKey: "short" },
        },
        {
            action: "create",
            input: {
                gameId: "wardogs",
                name: "x",
                idempotencyKey: "0b3c9e4a-8f4e-4b1c-9c37-1b2a3c4d5e6f",
                secret: "injected",
            },
        },
    ]) {
        assert.equal(teamCommandSchema.safeParse(body).success, false)
    }
})

test("command errors map to conflict, missing or bad-request statuses with existingId passthrough", () => {
    for (const conflict of [
        "duplicate_name",
        "revision_conflict",
        "idempotency_conflict",
        "archived",
        "not_archived",
    ])
        assert.equal(teamErrorStatus(conflict), 409, conflict)
    assert.equal(teamErrorStatus("not_found"), 404)
    for (const bad of [
        "invalid_team",
        "game_disabled",
        "asset_unavailable",
        "limit_reached",
        "anything_else",
    ])
        assert.equal(teamErrorStatus(bad), 400, bad)

    assert.deepEqual(
        teamCommandResponse({ error: "duplicate_name", existingId: "team_9" }),
        { body: { error: "duplicate_name", existingId: "team_9" }, status: 409 }
    )
    assert.deepEqual(teamCommandResponse({ error: "not_found" }), {
        body: { error: "not_found" },
        status: 404,
    })
    const success = { ok: true, teamId: "team_1", revision: 1, replayed: false }
    assert.deepEqual(teamCommandResponse(success), {
        body: success,
        status: 200,
    })
})
