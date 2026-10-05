import {
    parseTeamsQuery,
    teamsDashboardHandlers,
} from "./teams-dashboard-route"
import assert from "node:assert/strict"
import test from "node:test"

const query = (search: string) => parseTeamsQuery(new URLSearchParams(search))

test("list queries read one game's active catalogue with page 50 and no search by default", () => {
    assert.deepEqual(query("game=wardogs"), {
        kind: "list",
        gameId: "wardogs",
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(
        query("game=hell_let_loose&search=%20Red%20&cursor=abc&limit=10"),
        {
            kind: "list",
            gameId: "hell_let_loose",
            search: "Red",
            cursor: "abc",
            limit: 10,
        }
    )
    // Whitespace-only search is dropped rather than sent as a blank term.
    assert.equal("search" in (query("game=wardogs&search=%20%20") ?? {}), false)
    // Workspaces cannot ask for archived entries; the old flag is not forwarded.
    assert.equal(
        "archived" in (query("game=wardogs&archived=true") ?? {}),
        false
    )
})

test("list queries reject unsupported games and out-of-range limits", () => {
    assert.equal(query(""), null)
    assert.equal(query("game=hell_let_loose_vietnam"), null)
    assert.equal(query("game=wardogs&limit=0"), null)
    assert.equal(query("game=wardogs&limit=101"), null)
    assert.equal(query("game=wardogs&limit=5.5"), null)
    assert.equal(query(`game=wardogs&search=${"x".repeat(65)}`), null)
    assert.equal(query(`game=wardogs&cursor=${"c".repeat(4097)}`), null)
})

test("a teamId lookup wins over list parameters and must be a usable ID", () => {
    assert.deepEqual(query("teamId=team_1&game=wardogs"), {
        kind: "get",
        teamId: "team_1",
    })
    assert.equal(query("teamId="), null)
    assert.equal(query(`teamId=${"x".repeat(65)}`), null)
})

function dashboardFixture(
    options: { limited?: boolean; failing?: boolean } = {}
) {
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
            return options.limited
                ? { allowed: false, retryAfterSeconds: 4.5 }
                : { allowed: true, retryAfterSeconds: 0 }
        },
        get: async (_access, teamId) => {
            calls.push({ get: teamId })
            if (options.failing) throw new Error("convex down")
            return teamId === "teamDirectory:1" ? { id: teamId } : null
        },
        list: async (_access, listQuery) => {
            calls.push({ list: listQuery })
            if (options.failing) throw new Error("convex down")
            return { items: [], nextCursor: null }
        },
    })
    const get = (search: string) =>
        new Request(`https://logi.test/api/servers/server-1/teams?${search}`)
    return { calls, handlers, get }
}

test("catalogue reads consume the actor's workspace bucket before Convex", async () => {
    const f = dashboardFixture()
    const list = await f.handlers.GET(f.get("game=wardogs"), "server-1")
    assert.equal(list.status, 200)
    assert.equal(list.headers.get("cache-control"), "no-store")
    assert.deepEqual(await list.json(), { items: [], nextCursor: null })
    const one = await f.handlers.GET(
        f.get("teamId=teamDirectory:1"),
        "server-1"
    )
    assert.deepEqual(await one.json(), { team: { id: "teamDirectory:1" } })
    const gone = await f.handlers.GET(
        f.get("teamId=teamDirectory:2"),
        "server-1"
    )
    assert.equal(gone.status, 404)
    assert.deepEqual(await gone.json(), { error: "not_found" })
    const invalid = await f.handlers.GET(f.get("game=vietnam"), "server-1")
    assert.equal(invalid.status, 400)
    assert.deepEqual(await invalid.json(), { error: "invalid_team" })
    const bucket = { rateLimit: "teams:910000000000000001:123456789" }
    assert.deepEqual(f.calls, [
        { access: "server-1" },
        bucket,
        {
            list: {
                kind: "list",
                gameId: "wardogs",
                cursor: null,
                limit: 50,
            },
        },
        { access: "server-1" },
        bucket,
        { get: "teamDirectory:1" },
        { access: "server-1" },
        bucket,
        { get: "teamDirectory:2" },
        { access: "server-1" },
        bucket,
    ])
})

test("a limited actor gets 429 with Retry-After; a denied actor never consumes the bucket", async () => {
    const limited = dashboardFixture({ limited: true })
    const response = await limited.handlers.GET(
        limited.get("game=wardogs"),
        "server-1"
    )
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("retry-after"), "5")
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.deepEqual(await response.json(), { error: "rate_limited" })
    assert.equal(
        limited.calls.length,
        2,
        "nothing reaches Convex while limited"
    )

    const f = dashboardFixture()
    const denied = await f.handlers.GET(f.get("game=wardogs"), "server-2")
    assert.equal(denied.status, 403)
    assert.deepEqual(await denied.json(), { error: "forbidden" })
    assert.deepEqual(f.calls, [{ access: "server-2" }])
})

test("a failing Convex read answers 503 without leaking the error", async () => {
    const f = dashboardFixture({ failing: true })
    for (const search of ["game=wardogs", "teamId=teamDirectory:1"]) {
        const response = await f.handlers.GET(f.get(search), "server-1")
        assert.equal(response.status, 503)
        assert.deepEqual(await response.json(), { error: "unavailable" })
    }
})

test("the workspace catalogue route offers no write handler", () => {
    const f = dashboardFixture()
    assert.deepEqual(Object.keys(f.handlers), ["GET"])
})
