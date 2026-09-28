import assert from "node:assert/strict"
import test from "node:test"

import { GET } from "@/app/api/v1/clan/[[...path]]/route"

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
                case "publicApi:authenticateKey":
                    value = {
                        guildId: "guild-a",
                        readAccess: {
                            resources: ["event-summaries", "match-summaries"],
                            gameIds: ["wardogs"],
                        },
                    }
                    break
                case "publicApi:getClanResourcePage":
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
                case "publicApi:getClanResource":
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
