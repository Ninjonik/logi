import assert from "node:assert/strict"
import test from "node:test"

import { projectHealth, projectSnapshot } from "@/domain/game-data/policy"
import { clanResultSummarySchema } from "@/domain/api/result-summaries"
import { GET, POST } from "@/app/api/v1/clan/[[...path]]/route"

test("summary HTTP routes preserve page filters, detail identity and no-store", async (t) => {
    const previous = {
        url: process.env.NEXT_PUBLIC_CONVEX_URL,
        secret: process.env.INTERNAL_AUTH_SECRET,
    }
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://offline-test.convex.cloud"
    process.env.INTERNAL_AUTH_SECRET = "synthetic-test-secret"
    t.after(() => {
        if (previous.url === undefined)
            delete process.env.NEXT_PUBLIC_CONVEX_URL
        else process.env.NEXT_PUBLIC_CONVEX_URL = previous.url
        if (previous.secret === undefined)
            delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous.secret
    })
    const eventSummary = {
        id: "fixture-event",
        guildId: "guild-a",
        gameId: "wardogs",
        title: "Fixture",
        kind: "match",
        status: null,
        startsAt: null,
        endsAt: "2030-01-01T02:00:00.000Z",
        updatedAt: null,
        matchTeams: null,
    }
    const matchSummary = {
        id: "fixture-event",
        eventId: "fixture-event",
        guildId: "guild-a",
        gameId: "wardogs",
        title: "Fixture",
        updatedAt: null,
        resultState: "unknown",
        result: null,
        matchTeams: null,
    }
    t.mock.method(
        globalThis,
        "fetch",
        async (_input: unknown, init?: RequestInit) => {
            const request = JSON.parse(String(init?.body)) as {
                path: string
                args: Array<Record<string, unknown>>
            }
            let value: unknown
            switch (request.path) {
                case "publicApi:checkRateLimit":
                    value = { allowed: true, remaining: 299, resetAt: 0 }
                    break
                case "apiKeyAuth:authenticateKey":
                    value = {
                        guildId: "guild-a",
                        readAccess: {
                            resources: ["event-summaries", "match-summaries"],
                            gameIds: ["wardogs"],
                        },
                    }
                    break
                case "publicApiReads:getClanResourcePage":
                    assert.deepEqual(
                        {
                            resource: request.args[0].resource,
                            game: request.args[0].game,
                            cursor: request.args[0].cursor,
                            limit: request.args[0].limit,
                            updatedSince: request.args[0].updatedSince,
                        },
                        {
                            resource: "event-summaries",
                            game: "wardogs",
                            cursor: "fixture-cursor",
                            limit: 1,
                            updatedSince: "2026-09-28T10:00:00Z",
                        }
                    )
                    value = {
                        items: [eventSummary],
                        nextCursor: "fixture-next",
                        limit: 1,
                    }
                    break
                case "publicApiReads:getClanResource":
                    assert.equal(request.args[0].resource, "match-summaries")
                    assert.equal(request.args[0].id, "fixture-event")
                    value = matchSummary
                    break
                default:
                    throw new Error(
                        `Unexpected offline Convex request: ${request.path}`
                    )
            }
            return Response.json({ status: "success", value })
        }
    )
    const collection = await GET(
        new Request(
            "https://logi.test/api/v1/clan/event-summaries?game=wardogs&cursor=fixture-cursor&limit=1&updatedSince=2026-09-28T10:00:00Z",
            { headers: { authorization: "Bearer fixture" } }
        ),
        { params: Promise.resolve({ path: ["event-summaries"] }) }
    )
    assert.equal(collection.status, 200)
    assert.equal(collection.headers.get("Cache-Control"), "no-store")
    assert.deepEqual(await collection.json(), {
        data: [eventSummary],
        page: { nextCursor: "fixture-next", limit: 1 },
    })
    const detail = await GET(
        new Request(
            "https://logi.test/api/v1/clan/match-summaries/fixture-event",
            { headers: { authorization: "Bearer fixture" } }
        ),
        {
            params: Promise.resolve({
                path: ["match-summaries", "fixture-event"],
            }),
        }
    )
    assert.equal(detail.status, 200)
    assert.equal(detail.headers.get("Cache-Control"), "no-store")
    assert.deepEqual(await detail.json(), { data: matchSummary })
    const denied = await GET(
        new Request("https://logi.test/api/v1/clan/events?game=wardogs", {
            headers: { authorization: "Bearer fixture" },
        }),
        { params: Promise.resolve({ path: ["events"] }) }
    )
    assert.equal(denied.status, 403)
})

test("reviewed result HTTP reads need their own grant; bearer keys cannot confirm", async (t) => {
    const oldUrl = process.env.NEXT_PUBLIC_CONVEX_URL
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://offline-test.convex.cloud"
    t.after(() => {
        if (oldUrl === undefined) delete process.env.NEXT_PUBLIC_CONVEX_URL
        else process.env.NEXT_PUBLIC_CONVEX_URL = oldUrl
    })
    let granted = true,
        reads = 0
    const summary = {
        id: "event",
        eventId: "event",
        guildId: "guild-a",
        gameId: "wardogs",
        title: "Fixture",
        updatedAt: null,
        resultState: "unknown",
        result: null,
    }
    t.mock.method(
        globalThis,
        "fetch",
        async (_input: unknown, init?: RequestInit) => {
            const request = JSON.parse(String(init?.body))
            let value: unknown
            if (request.path === "publicApi:checkRateLimit")
                value = { allowed: true, remaining: 299, resetAt: 0 }
            else if (request.path === "apiKeyAuth:authenticateKey")
                value = {
                    guildId: "guild-a",
                    readAccess: {
                        resources: granted
                            ? ["result-summaries"]
                            : ["match-summaries"],
                        gameIds: ["wardogs"],
                    },
                }
            else if (request.path === "publicApiReads:getClanResourcePage") {
                reads++
                assert.equal(request.args[0].resource, "result-summaries")
                assert.equal(request.args[0].game, "wardogs")
                value = { items: [summary], limit: 10, nextCursor: null }
            } else throw new Error(`Unexpected offline call: ${request.path}`)
            return Response.json({ status: "success", value })
        }
    )
    const headers = { authorization: "Bearer synthetic" }
    const params = { params: Promise.resolve({ path: ["result-summaries"] }) }
    const response = await GET(
        new Request(
            "https://logi.test/api/v1/clan/result-summaries?game=wardogs&limit=10",
            { headers }
        ),
        params
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.deepEqual(
        clanResultSummarySchema.parse((await response.json()).data[0]),
        summary
    )
    assert.equal(
        (
            await GET(
                new Request(
                    "https://logi.test/api/v1/clan/result-summaries?game=hell_let_loose",
                    { headers }
                ),
                params
            )
        ).status,
        403
    )
    granted = false
    assert.equal(
        (
            await GET(
                new Request(
                    "https://logi.test/api/v1/clan/result-summaries?game=wardogs",
                    { headers }
                ),
                params
            )
        ).status,
        403
    )
    assert.equal(reads, 1)
    assert.equal(
        (
            await POST(
                new Request(
                    "https://logi.test/api/v1/clan/result-summaries/event",
                    {
                        method: "POST",
                        headers,
                        body: JSON.stringify({
                            action: "confirm",
                            expectedRevision: 1,
                        }),
                    }
                ),
                {
                    params: Promise.resolve({
                        path: ["result-summaries", "event"],
                    }),
                }
            )
        ).status,
        404
    )
})

test("clan route rejects missing and malformed credentials through HTTP", async () => {
    for (const authorization of [undefined, "Basic value", "Bearer "]) {
        const response = await GET(
            new Request("https://logi.test/api/v1/clan/events", {
                ...(authorization ? { headers: { authorization } } : {}),
            }),
            { params: Promise.resolve({ path: ["events"] }) }
        )

        assert.equal(response.status, 401)
        assert.deepEqual(await response.json(), {
            error: {
                code: "missing_api_key",
                message: "Use Authorization: Bearer <API key>.",
            },
        })
    }
})

test("stored game data reaches the real HTTP route with scoped filters and nullable values", async (t) => {
    const previous = process.env.NEXT_PUBLIC_CONVEX_URL
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://offline-test.convex.cloud"
    t.after(() => {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_CONVEX_URL
        else process.env.NEXT_PUBLIC_CONVEX_URL = previous
    })
    const stored = {
        id: "connection",
        guildId: "guild-a",
        gameId: "wardogs",
        provider: "wardogs_rcon",
        enabled: true,
        generation: 1,
        fence: 0,
        leaseUntil: 0,
        lastAttemptAt: null,
        errorCategory: null,
        observation: null,
    }
    const values = {
        "server-snapshots": projectSnapshot(stored, Date.now()),
        "integration-health": projectHealth(stored, Date.now()),
    }
    let reads = 0
    let restricted = true
    t.mock.method(
        globalThis,
        "fetch",
        async (_input: unknown, init?: RequestInit) => {
            const request = JSON.parse(String(init?.body)) as {
                path: string
                args: Array<Record<string, unknown>>
            }
            let value: unknown
            if (request.path === "publicApi:checkRateLimit")
                value = { allowed: true, remaining: 200, resetAt: 0 }
            else if (request.path === "apiKeyAuth:authenticateKey")
                value = {
                    guildId: "guild-a",
                    readAccess: restricted
                        ? {
                              resources: Object.keys(values),
                              gameIds: ["wardogs"],
                          }
                        : undefined,
                }
            else if (request.path === "publicApiReads:getClanResourcePage") {
                assert.equal(request.args[0].game, "wardogs")
                const resource = request.args[0].resource as keyof typeof values
                assert.ok(resource in values)
                reads++
                value = {
                    items: [values[resource]],
                    nextCursor: null,
                    limit: 25,
                }
            } else if (request.path === "publicApiReads:getClanResource") {
                assert.equal(request.args[0].id, "connection")
                value = values[request.args[0].resource as keyof typeof values]
            } else assert.fail(`Unexpected external call: ${request.path}`)
            return Response.json({ status: "success", value })
        }
    )
    for (const resource of Object.keys(values) as Array<keyof typeof values>) {
        const response = await GET(
            new Request(
                `https://logi.test/api/v1/clan/${resource}?game=wardogs`,
                { headers: { authorization: "Bearer fixture" } }
            ),
            { params: Promise.resolve({ path: [resource] }) }
        )
        assert.equal(response.status, 200)
        assert.equal(response.headers.get("cache-control"), "no-store")
        assert.deepEqual(await response.json(), {
            data: [values[resource]],
            page: { nextCursor: null, limit: 25 },
        })
    }
    const forbidden = await GET(
        new Request(
            "https://logi.test/api/v1/clan/server-snapshots?game=hell_let_loose",
            { headers: { authorization: "Bearer fixture" } }
        ),
        { params: Promise.resolve({ path: ["server-snapshots"] }) }
    )
    assert.equal(forbidden.status, 403)
    assert.equal(reads, 2, "wrong-game reads never reach the database")
    restricted = false
    for (const resource of Object.keys(values)) {
        for (const detail of [false, true]) {
            const response = await GET(
                new Request(
                    `https://logi.test/api/v1/clan/${resource}${detail ? "/connection" : "?game=wardogs"}`,
                    { headers: { authorization: "Bearer legacy-fixture" } }
                ),
                {
                    params: Promise.resolve({
                        path: detail ? [resource, "connection"] : [resource],
                    }),
                }
            )
            assert.equal(response.status, 200)
            assert.equal(
                response.headers.get("cache-control"),
                "no-store",
                "provider health never uses the legacy 30-second HTTP cache"
            )
        }
    }
})

test("event writes drop a returned team selection before validation and forwarding", async (t) => {
    const previous = {
        url: process.env.NEXT_PUBLIC_CONVEX_URL,
        secret: process.env.INTERNAL_AUTH_SECRET,
    }
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://offline-test.convex.cloud"
    process.env.INTERNAL_AUTH_SECRET = "synthetic-test-secret"
    t.after(() => {
        if (previous.url === undefined)
            delete process.env.NEXT_PUBLIC_CONVEX_URL
        else process.env.NEXT_PUBLIC_CONVEX_URL = previous.url
        if (previous.secret === undefined)
            delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous.secret
    })
    const forwarded: Array<Record<string, unknown>> = []
    t.mock.method(
        globalThis,
        "fetch",
        async (_input: unknown, init?: RequestInit) => {
            const request = JSON.parse(String(init?.body))
            let value: unknown
            if (request.path === "publicApi:checkRateLimit")
                value = { allowed: true, remaining: 299, resetAt: 0 }
            else if (request.path === "apiKeyAuth:authenticateKey")
                value = { guildId: "guild-a" }
            else if (request.path === "publicApi:mutateClanEvent") {
                forwarded.push(request.args[0].event)
                value = { status: 201, body: '{"data":{"id":"event"}}' }
            } else throw new Error(`Unexpected offline call: ${request.path}`)
            return Response.json({ status: "success", value })
        }
    )
    // A stored selection as an event read returns it, snapshot included.
    const matchTeams = [
        {
            teamId: "teamDirectory:alpha",
            slot: "a",
            side: "Allies",
            snapshot: { name: "Alpha" },
        },
    ]
    const response = await POST(
        new Request("https://logi.test/api/v1/clan/events", {
            method: "POST",
            headers: {
                authorization: "Bearer fixture",
                "idempotency-key": "event-create-0001",
            },
            body: JSON.stringify({
                kind: "training",
                name: "Training",
                registrationEnd: "2030-01-01T18:00:00Z",
                meetingStart: "2030-01-01T19:00:00Z",
                pingClan: false,
                matchTeams,
            }),
        }),
        { params: Promise.resolve({ path: ["events"] }) }
    )
    assert.equal(response.status, 201)
    assert.equal(forwarded.length, 1)
    assert.equal(forwarded[0]!.name, "Training")
    assert.equal("matchTeams" in forwarded[0]!, false)
})
