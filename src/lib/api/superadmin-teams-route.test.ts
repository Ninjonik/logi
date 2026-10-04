import {
    parseSuperadminTeamsQuery,
    superadminTeamsHandlers,
    type SuperadminTeamsPorts,
} from "./superadmin-teams-route"
import assert from "node:assert/strict"
import test from "node:test"

const origin = "https://logi.test"
const url = (query = "") => `${origin}/api/superadmin/teams${query}`
const params = (query: string) => new URLSearchParams(query)

test("parses a catalogue page with defaults", () => {
    assert.deepEqual(parseSuperadminTeamsQuery(params("game=wardogs")), {
        kind: "list",
        gameId: "wardogs",
        archived: false,
        cursor: null,
        limit: 50,
    })
    assert.deepEqual(
        parseSuperadminTeamsQuery(
            params(
                "game=hell_let_loose&archived=true&search=%20Alpha%20&cursor=c1&limit=10"
            )
        ),
        {
            kind: "list",
            gameId: "hell_let_loose",
            archived: true,
            search: "Alpha",
            cursor: "c1",
            limit: 10,
        }
    )
})

test("parses a single-team read and rejects malformed queries", () => {
    assert.deepEqual(parseSuperadminTeamsQuery(params("teamId=team-1")), {
        kind: "get",
        teamId: "team-1",
    })
    for (const query of [
        "",
        "game=hell_let_loose_vietnam",
        "game=wardogs&limit=0",
        "game=wardogs&limit=101",
        "game=wardogs&archived=yes",
        `game=wardogs&search=${"x".repeat(65)}`,
        "teamId=",
    ])
        assert.equal(parseSuperadminTeamsQuery(params(query)), null, query)
    // A blank search is a plain page, not an empty search.
    assert.equal(
        "search" in
            (parseSuperadminTeamsQuery(params("game=wardogs&search=%20")) ??
                {}),
        false
    )
})

type Access = { secret: string }
function fakePorts(overrides: Partial<SuperadminTeamsPorts<Access>> = {}) {
    const calls: { mutation: string; payload: unknown }[] = []
    const ports: SuperadminTeamsPorts<Access> = {
        access: async () => ({ secret: "s" }),
        get: async (_access, teamId) =>
            teamId === "team-1" ? { id: "team-1" } : null,
        list: async (_access, query) => ({ items: [], query }),
        command: async (_access, mutation, payload) => {
            calls.push({ mutation, payload })
            return { ok: true, revision: 2 }
        },
        ...overrides,
    }
    return { ports, calls }
}
const post = (body: unknown, init: { origin?: string | null } = {}) =>
    new Request(url(), {
        method: "POST",
        headers: {
            "content-type": "application/json",
            ...(init.origin === null ? {} : { origin: init.origin ?? origin }),
        },
        body: typeof body === "string" ? body : JSON.stringify(body),
    })

test("GET denies non-superadmins before reading", async () => {
    let read = false
    const { ports } = fakePorts({
        access: async () => null,
        list: async () => {
            read = true
            return {}
        },
    })
    const response = await superadminTeamsHandlers(ports).GET(
        new Request(url("?game=wardogs"))
    )
    assert.equal(response.status, 403)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.equal(read, false)
})

test("GET reads one team, a page, a 404 and a 400", async () => {
    const handlers = superadminTeamsHandlers(fakePorts().ports)
    const one = await handlers.GET(new Request(url("?teamId=team-1")))
    assert.equal(one.status, 200)
    assert.deepEqual(await one.json(), { team: { id: "team-1" } })
    const missing = await handlers.GET(new Request(url("?teamId=team-9")))
    assert.equal(missing.status, 404)
    const page = await handlers.GET(
        new Request(url("?game=wardogs&archived=true"))
    )
    assert.equal(page.status, 200)
    assert.equal(
        ((await page.json()) as { query: { archived: boolean } }).query
            .archived,
        true
    )
    const bad = await handlers.GET(new Request(url("?game=chess")))
    assert.equal(bad.status, 400)
    assert.deepEqual(await bad.json(), { error: "invalid_query" })
})

test("GET answers 503 when Convex throws", async () => {
    const { ports } = fakePorts({
        list: async () => {
            throw new Error("down")
        },
    })
    const response = await superadminTeamsHandlers(ports).GET(
        new Request(url("?game=wardogs"))
    )
    assert.equal(response.status, 503)
})

test("POST requires the same origin and a superadmin", async () => {
    const { ports, calls } = fakePorts()
    const handlers = superadminTeamsHandlers(ports)
    const command = {
        action: "archive",
        teamId: "team-1",
        input: { expectedRevision: 1 },
    }
    assert.equal(
        (await handlers.POST(post(command, { origin: null }))).status,
        403
    )
    assert.equal(
        (await handlers.POST(post(command, { origin: "https://evil.test" })))
            .status,
        403
    )
    const denied = superadminTeamsHandlers(
        fakePorts({ access: async () => null }).ports
    )
    assert.equal((await denied.POST(post(command))).status, 403)
    assert.equal(calls.length, 0)
})

test("POST validates and forwards every catalogue action", async () => {
    const { ports, calls } = fakePorts()
    const handlers = superadminTeamsHandlers(ports)
    const commands = [
        {
            action: "create",
            input: {
                gameId: "wardogs",
                name: "  Alpha   Squad ",
                idempotencyKey: "key-12345678",
                links: ["https://alpha.example"],
                linkedGuildId: "123456789012345678",
            },
        },
        {
            action: "update",
            teamId: "team-1",
            input: { expectedRevision: 2, description: "New" },
        },
        { action: "archive", teamId: "team-1", input: { expectedRevision: 3 } },
        { action: "restore", teamId: "team-1", input: { expectedRevision: 4 } },
        {
            action: "merge",
            teamId: "team-1",
            input: {
                expectedRevision: 5,
                targetTeamId: "team-2",
                targetRevision: 1,
            },
        },
    ]
    for (const command of commands)
        assert.equal((await handlers.POST(post(command))).status, 200)
    assert.deepEqual(
        calls.map((call) => call.mutation),
        [
            "teams:create",
            "teams:update",
            "teams:archive",
            "teams:restore",
            "teams:merge",
        ]
    )
    // The forwarded create is the parsed, normalized domain input.
    assert.deepEqual(calls[0]?.payload, {
        input: {
            gameId: "wardogs",
            name: "Alpha Squad",
            shortCode: null,
            logoAssetId: null,
            description: null,
            links: ["https://alpha.example"],
            linkedGuildId: "123456789012345678",
            idempotencyKey: "key-12345678",
        },
    })
    assert.deepEqual(calls[4]?.payload, {
        teamId: "team-1",
        input: {
            expectedRevision: 5,
            targetTeamId: "team-2",
            targetRevision: 1,
        },
    })
})

test("POST rejects invalid bodies before Convex", async () => {
    const { ports, calls } = fakePorts()
    const handlers = superadminTeamsHandlers(ports)
    const invalid = [
        "{not json",
        { action: "delete", teamId: "team-1" },
        { action: "update", teamId: "team-1", input: { expectedRevision: 1 } },
        {
            action: "create",
            input: {
                gameId: "wardogs",
                name: "A",
                idempotencyKey: "key-12345678",
                links: ["http://insecure.example"],
            },
        },
        {
            action: "create",
            input: {
                gameId: "wardogs",
                name: "A",
                idempotencyKey: "key-12345678",
                description: "x".repeat(501),
            },
        },
        {
            action: "merge",
            teamId: "team-1",
            input: { expectedRevision: 1, targetTeamId: "team-2" },
        },
        {
            action: "archive",
            teamId: "team-1",
            input: { expectedRevision: 1 },
            extra: true,
        },
    ]
    for (const body of invalid) {
        const response = await handlers.POST(post(body))
        assert.equal(response.status, 400, JSON.stringify(body))
        assert.deepEqual(await response.json(), { error: "invalid_team" })
    }
    const huge = await handlers.POST(
        post({
            action: "archive",
            teamId: "team-1",
            input: { expectedRevision: 1 },
            pad: "x".repeat(20_000),
        })
    )
    assert.equal(huge.status, 400)
    assert.equal(calls.length, 0)
})

test("POST maps command errors and thrown failures", async () => {
    const results: unknown[] = [
        { error: "duplicate_name", existingId: "team-2" },
        { error: "revision_conflict" },
        { error: "not_found" },
        { error: "invalid_merge" },
    ]
    const { ports } = fakePorts({
        command: async () => {
            const next = results.shift()
            if (!next) throw new Error("down")
            return next
        },
    })
    const handlers = superadminTeamsHandlers(ports)
    const body = {
        action: "archive",
        teamId: "team-1",
        input: { expectedRevision: 1 },
    }
    const duplicate = await handlers.POST(post(body))
    assert.equal(duplicate.status, 409)
    assert.deepEqual(await duplicate.json(), {
        error: "duplicate_name",
        existingId: "team-2",
    })
    assert.equal((await handlers.POST(post(body))).status, 409)
    assert.equal((await handlers.POST(post(body))).status, 404)
    assert.equal((await handlers.POST(post(body))).status, 400)
    const thrown = await handlers.POST(post(body))
    assert.equal(thrown.status, 503)
    assert.deepEqual(await thrown.json(), { error: "unavailable" })
})
