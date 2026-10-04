import {
    TEAM_MUTATION_FOR,
    parseTeamsQuery,
    teamCommandResponse,
    teamCommandSchema,
    teamErrorStatus,
    teamsDashboardHandlers,
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

function dashboardFixture(limited = false) {
    const calls: unknown[] = []
    const access = {
        secret: "s",
        guildId: "910000000000000001",
        actor: { subject: "123456789" },
    }
    const handlers = teamsDashboardHandlers({
        access: async (serverId) => {
            calls.push({ access: serverId })
            return serverId === "server-1" ? access : null
        },
        rateLimit: async (bucket) => {
            calls.push({ rateLimit: bucket })
            return limited
                ? { allowed: false, retryAfterSeconds: 4.5 }
                : { allowed: true, retryAfterSeconds: 0 }
        },
        get: async (_access, teamId) => {
            calls.push({ get: teamId })
            return teamId === "teamDirectory:1" ? { id: teamId } : null
        },
        list: async (_access, query) => {
            calls.push({ list: query.gameId })
            return { items: [], nextCursor: null }
        },
        command: async (_access, mutation, payload) => {
            calls.push({ command: mutation, payload })
            return { error: "duplicate_name", existingId: "teamDirectory:9" }
        },
    })
    const origin = "https://logi.test"
    const post = (body: unknown, headers: HeadersInit = { origin }) =>
        new Request(`${origin}/api/servers/server-1/teams`, {
            method: "POST",
            headers: { "content-type": "application/json", ...headers },
            body: JSON.stringify(body),
        })
    const get = (query: string) =>
        new Request(`${origin}/api/servers/server-1/teams?${query}`)
    return { calls, handlers, post, get }
}
const createBody = {
    action: "create",
    input: {
        gameId: "wardogs",
        name: "Alpha",
        idempotencyKey: "create-alpha-0001",
    },
}

test("directory reads and writes consume the actor's workspace bucket before Convex", async () => {
    const f = dashboardFixture()
    const list = await f.handlers.GET(f.get("game=wardogs"), "server-1")
    assert.equal(list.status, 200)
    assert.equal(list.headers.get("cache-control"), "no-store")
    const one = await f.handlers.GET(
        f.get("teamId=teamDirectory:1"),
        "server-1"
    )
    assert.deepEqual(await one.json(), { team: { id: "teamDirectory:1" } })
    assert.equal(
        (await f.handlers.GET(f.get("teamId=teamDirectory:2"), "server-1"))
            .status,
        404
    )
    const conflict = await f.handlers.POST(f.post(createBody), "server-1")
    assert.equal(conflict.status, 409)
    assert.deepEqual(await conflict.json(), {
        error: "duplicate_name",
        existingId: "teamDirectory:9",
    })
    const bucket = { rateLimit: "teams:910000000000000001:123456789" }
    assert.deepEqual(f.calls, [
        { access: "server-1" },
        bucket,
        { list: "wardogs" },
        { access: "server-1" },
        bucket,
        { get: "teamDirectory:1" },
        { access: "server-1" },
        bucket,
        { get: "teamDirectory:2" },
        { access: "server-1" },
        bucket,
        {
            command: "teams:create",
            // The domain schema has normalized the input before Convex sees it.
            payload: {
                input: {
                    ...createBody.input,
                    shortCode: null,
                    logoAssetId: null,
                },
            },
        },
    ])
})

test("a limited actor gets 429 with Retry-After; denied and cross-origin calls never consume the bucket", async () => {
    const limited = dashboardFixture(true)
    for (const response of [
        await limited.handlers.GET(limited.get("game=wardogs"), "server-1"),
        await limited.handlers.POST(limited.post(createBody), "server-1"),
    ]) {
        assert.equal(response.status, 429)
        assert.equal(response.headers.get("retry-after"), "5")
        assert.equal(response.headers.get("cache-control"), "no-store")
        assert.deepEqual(await response.json(), { error: "rate_limited" })
    }
    assert.equal(
        limited.calls.some(
            (call) =>
                typeof call === "object" &&
                call &&
                !("access" in call) &&
                !("rateLimit" in call)
        ),
        false,
        "nothing reaches Convex while limited"
    )
    const f = dashboardFixture()
    assert.equal(
        (await f.handlers.GET(f.get("game=wardogs"), "server-2")).status,
        403
    )
    assert.equal(
        (
            await f.handlers.POST(
                f.post(createBody, { origin: "https://evil.test" }),
                "server-1"
            )
        ).status,
        403
    )
    assert.deepEqual(f.calls, [{ access: "server-2" }])
})
