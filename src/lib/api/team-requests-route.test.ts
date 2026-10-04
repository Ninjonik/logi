import {
    parseTeamRequestsQuery,
    TEAM_REQUEST_BODY_MAX,
    teamRequestCommandResponse,
    teamRequestCommandSchema,
    teamRequestErrorStatus,
    teamRequestsDashboardHandlers,
} from "./team-requests-route"
import assert from "node:assert/strict"
import test from "node:test"

const query = (search: string) =>
    parseTeamRequestsQuery(new URLSearchParams(search))
const KEY = "0b3c9e4a-8f4e-4b1c-9c37-1b2a3c4d5e6f"

test("list queries default to the first page of 20 and accept a cursor", () => {
    assert.deepEqual(query(""), { cursor: null, limit: 20 })
    assert.deepEqual(query("cursor=abc&limit=50"), {
        cursor: "abc",
        limit: 50,
    })
    for (const bad of [
        "limit=0",
        "limit=51",
        "limit=2.5",
        "limit=many",
        "cursor=",
        `cursor=${"c".repeat(4097)}`,
    ])
        assert.equal(query(bad), null, bad)
})

test("submissions are normalized with the domain schema before reaching Convex", () => {
    const create = teamRequestCommandSchema.safeParse({
        action: "submit",
        input: {
            kind: "create",
            gameId: "wardogs",
            proposal: {
                name: "  Red   Wolves ",
                links: ["https://red.example/"],
            },
            note: "  Plays on Sundays ",
            idempotencyKey: KEY,
        },
    })
    assert.ok(create.success)
    assert.deepEqual(create.data, {
        action: "submit",
        input: {
            kind: "create",
            gameId: "wardogs",
            proposal: {
                name: "Red Wolves",
                shortCode: null,
                logoAssetId: null,
                description: null,
                links: ["https://red.example/"],
            },
            note: "Plays on Sundays",
            idempotencyKey: KEY,
        },
    })
    const update = teamRequestCommandSchema.safeParse({
        action: "submit",
        input: {
            kind: "update",
            teamId: "team_1",
            proposal: { name: "Red Wolves", shortCode: "RW" },
            idempotencyKey: KEY,
        },
    })
    assert.ok(update.success)
    assert.equal(
        update.data.action === "submit" && update.data.input.kind,
        "update"
    )
    assert.deepEqual(
        teamRequestCommandSchema.parse({
            action: "cancel",
            requestId: "teamRequests:1",
        }),
        { action: "cancel", requestId: "teamRequests:1" }
    )
})

test("malformed, unsafe or injected commands are rejected", () => {
    const proposal = { name: "Red Wolves" }
    for (const body of [
        null,
        {},
        { action: "approve", requestId: "r1" },
        { action: "cancel" },
        { action: "cancel", requestId: "" },
        { action: "cancel", requestId: "x".repeat(65) },
        { action: "cancel", requestId: "r1", guildId: "other" },
        {
            action: "submit",
            input: {
                kind: "create",
                gameId: "hell_let_loose_vietnam",
                proposal,
                idempotencyKey: KEY,
            },
        },
        {
            action: "submit",
            input: {
                kind: "create",
                gameId: "wardogs",
                proposal,
                idempotencyKey: "short",
            },
        },
        {
            action: "submit",
            input: {
                kind: "create",
                gameId: "wardogs",
                proposal: { ...proposal, links: ["http://insecure.example"] },
                idempotencyKey: KEY,
            },
        },
        {
            action: "submit",
            input: {
                kind: "create",
                gameId: "wardogs",
                proposal: {
                    ...proposal,
                    links: [
                        "https://a.example",
                        "https://b.example",
                        "https://c.example",
                        "https://d.example",
                    ],
                },
                idempotencyKey: KEY,
            },
        },
        {
            action: "submit",
            input: {
                kind: "update",
                proposal,
                idempotencyKey: KEY,
            },
        },
        {
            action: "submit",
            input: {
                kind: "create",
                gameId: "wardogs",
                proposal: { ...proposal, linkedGuildId: "123" },
                idempotencyKey: KEY,
            },
        },
        {
            action: "submit",
            input: {
                kind: "create",
                gameId: "wardogs",
                proposal,
                note: "x".repeat(501),
                idempotencyKey: KEY,
            },
        },
    ])
        assert.equal(
            teamRequestCommandSchema.safeParse(body).success,
            false,
            JSON.stringify(body)
        )
})

test("errors map to conflict, missing or bad-request statuses with existingId passthrough", () => {
    assert.equal(teamRequestErrorStatus("idempotency_conflict"), 409)
    assert.equal(teamRequestErrorStatus("not_pending"), 409)
    assert.equal(teamRequestErrorStatus("not_found"), 404)
    for (const bad of [
        "invalid_request",
        "limit_reached",
        "team_archived",
        "team_game_mismatch",
        "asset_unavailable",
        "anything_else",
    ])
        assert.equal(teamRequestErrorStatus(bad), 400, bad)
    assert.deepEqual(
        teamRequestCommandResponse({
            error: "idempotency_conflict",
            existingId: "teamDirectory:9",
        }),
        {
            body: {
                error: "idempotency_conflict",
                existingId: "teamDirectory:9",
            },
            status: 409,
        }
    )
    const ok = { ok: true, requestId: "teamRequests:1", replayed: false }
    assert.deepEqual(teamRequestCommandResponse(ok), { body: ok, status: 200 })
})

function fixture(options: { limited?: boolean; failing?: boolean } = {}) {
    const calls: unknown[] = []
    const access = {
        secret: "s",
        guildId: "910000000000000001",
        actor: { subject: "123456789" },
    }
    const handlers = teamRequestsDashboardHandlers({
        origin: "https://logi.test",
        access: async (serverId) => {
            calls.push({ access: serverId })
            return serverId === "server-1" ? access : null
        },
        rateLimit: async (bucket) => {
            calls.push({ rateLimit: bucket })
            return options.limited
                ? { allowed: false, retryAfterSeconds: 1.2 }
                : { allowed: true, retryAfterSeconds: 0 }
        },
        list: async (_access, listQuery) => {
            calls.push({ list: listQuery })
            if (options.failing) throw new Error("convex down")
            return { items: [], nextCursor: null }
        },
        submit: async (_access, input) => {
            calls.push({ submit: input })
            if (options.failing) throw new Error("convex down")
            return input.proposal.name === "Taken"
                ? { error: "limit_reached" }
                : { ok: true, requestId: "teamRequests:1", replayed: false }
        },
        cancel: async (_access, requestId) => {
            calls.push({ cancel: requestId })
            return requestId === "teamRequests:done"
                ? { error: "not_pending" }
                : requestId === "teamRequests:other"
                  ? { error: "not_found" }
                  : { ok: true }
        },
    })
    const origin = "https://logi.test"
    const url = `${origin}/api/servers/server-1/team-requests`
    const post = (body: unknown, headers: HeadersInit = { origin }) =>
        new Request(url, {
            method: "POST",
            headers: { "content-type": "application/json", ...headers },
            body: typeof body === "string" ? body : JSON.stringify(body),
        })
    const get = (search = "") => new Request(`${url}?${search}`)
    return { calls, handlers, post, get }
}
const submitBody = (name = "Alpha") => ({
    action: "submit",
    input: {
        kind: "create",
        gameId: "wardogs",
        proposal: { name },
        idempotencyKey: "create-alpha-0001",
    },
})
const bucket = { rateLimit: "teams:910000000000000001:123456789" }

test("reads, submissions and cancellations share the team bucket and pass normalized input", async () => {
    const f = fixture()
    const list = await f.handlers.GET(f.get("cursor=next"), "server-1")
    assert.equal(list.status, 200)
    assert.equal(list.headers.get("cache-control"), "no-store")
    const submitted = await f.handlers.POST(f.post(submitBody()), "server-1")
    assert.equal(submitted.status, 200)
    assert.deepEqual(await submitted.json(), {
        ok: true,
        requestId: "teamRequests:1",
        replayed: false,
    })
    const cancelled = await f.handlers.POST(
        f.post({ action: "cancel", requestId: "teamRequests:1" }),
        "server-1"
    )
    assert.deepEqual(await cancelled.json(), { ok: true })
    assert.deepEqual(f.calls, [
        { access: "server-1" },
        bucket,
        { list: { cursor: "next", limit: 20 } },
        { access: "server-1" },
        bucket,
        {
            submit: {
                kind: "create",
                gameId: "wardogs",
                proposal: {
                    name: "Alpha",
                    shortCode: null,
                    logoAssetId: null,
                    description: null,
                    links: [],
                },
                note: null,
                idempotencyKey: "create-alpha-0001",
            },
        },
        { access: "server-1" },
        bucket,
        { cancel: "teamRequests:1" },
    ])
})

test("command errors keep their code with 409, 404 or 400", async () => {
    const f = fixture()
    const notPending = await f.handlers.POST(
        f.post({ action: "cancel", requestId: "teamRequests:done" }),
        "server-1"
    )
    assert.equal(notPending.status, 409)
    assert.deepEqual(await notPending.json(), { error: "not_pending" })
    const missing = await f.handlers.POST(
        f.post({ action: "cancel", requestId: "teamRequests:other" }),
        "server-1"
    )
    assert.equal(missing.status, 404)
    const limit = await f.handlers.POST(f.post(submitBody("Taken")), "server-1")
    assert.equal(limit.status, 400)
    assert.deepEqual(await limit.json(), { error: "limit_reached" })
})

test("invalid queries and bodies answer 400 invalid_request without reaching Convex", async () => {
    const f = fixture()
    for (const response of [
        await f.handlers.GET(f.get("limit=0"), "server-1"),
        await f.handlers.POST(f.post("{not json"), "server-1"),
        await f.handlers.POST(
            f.post({ action: "submit", input: { kind: "create" } }),
            "server-1"
        ),
        await f.handlers.POST(
            f.post({
                ...submitBody(),
                padding: "x".repeat(TEAM_REQUEST_BODY_MAX),
            }),
            "server-1"
        ),
    ]) {
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error: "invalid_request" })
    }
    assert.equal(
        f.calls.some(
            (call) =>
                typeof call === "object" &&
                call !== null &&
                ("list" in call || "submit" in call || "cancel" in call)
        ),
        false
    )
})

test("cross-origin, denied and limited callers are refused before Convex", async () => {
    const f = fixture()
    const crossOrigin = await f.handlers.POST(
        f.post(submitBody(), { origin: "https://evil.test" }),
        "server-1"
    )
    assert.equal(crossOrigin.status, 403)
    const missingOrigin = await f.handlers.POST(
        f.post(submitBody(), {}),
        "server-1"
    )
    assert.equal(missingOrigin.status, 403)
    assert.deepEqual(
        f.calls,
        [],
        "cross-origin writes never consume the bucket"
    )
    const denied = await f.handlers.GET(f.get(), "server-2")
    assert.equal(denied.status, 403)
    assert.deepEqual(f.calls, [{ access: "server-2" }])

    const limited = fixture({ limited: true })
    for (const response of [
        await limited.handlers.GET(limited.get(), "server-1"),
        await limited.handlers.POST(limited.post(submitBody()), "server-1"),
    ]) {
        assert.equal(response.status, 429)
        assert.equal(response.headers.get("retry-after"), "2")
        assert.deepEqual(await response.json(), { error: "rate_limited" })
    }
    assert.equal(limited.calls.length, 4, "only admission and the bucket ran")
})

test("a thrown Convex call answers 503 unavailable", async () => {
    const f = fixture({ failing: true })
    for (const response of [
        await f.handlers.GET(f.get(), "server-1"),
        await f.handlers.POST(f.post(submitBody()), "server-1"),
    ]) {
        assert.equal(response.status, 503)
        assert.deepEqual(await response.json(), { error: "unavailable" })
    }
})

test("behind a proxy the public site origin is accepted and the internal one refused", async () => {
    const f = fixture()
    const internal = (origin: string) =>
        new Request(
            "http://127.0.0.1:3000/api/servers/server-1/team-requests",
            {
                method: "POST",
                headers: { "content-type": "application/json", origin },
                body: JSON.stringify(submitBody()),
            }
        )
    assert.notEqual(
        (await f.handlers.POST(internal("https://logi.test"), "server-1"))
            .status,
        403
    )
    assert.equal(
        (await f.handlers.POST(internal("http://127.0.0.1:3000"), "server-1"))
            .status,
        403
    )
})
