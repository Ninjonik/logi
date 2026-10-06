import { GET } from "@/app/api/v1/clan/[[...path]]/route"
import assert from "node:assert/strict"
import test from "node:test"

test("change HTTP bootstrap, signed cursor, atomic detail and explicit reset", async (t) => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://offline-test.convex.cloud"
    process.env.INTERNAL_AUTH_SECRET = "synthetic-change-secret"
    let reset = false,
        reads = 0
    t.mock.method(
        globalThis,
        "fetch",
        async (_input: unknown, init?: RequestInit) => {
            const request = JSON.parse(String(init?.body)),
                args = request.args[0]
            let value: unknown
            if (request.path === "publicApi:checkRateLimit")
                value = { allowed: true, remaining: 299, resetAt: 0 }
            else if (request.path === "apiKeyAuth:authenticateKey")
                value = {
                    guildId: "guild-a",
                    readAccess: {
                        resources: ["event-summaries"],
                        gameIds: ["wardogs"],
                    },
                }
            else if (request.path === "integrationChanges:readChanges") {
                reads++
                assert.equal(args.gameId, "wardogs")
                value = reset
                    ? { resetRequired: true }
                    : {
                          items: [],
                          revision: "10",
                          hasMore: false,
                          resetRequired: false,
                      }
            } else if (request.path === "integrationChanges:readSyncRecord") {
                reads++
                value = {
                    id: args.id,
                    guildId: "guild-a",
                    gameId: "wardogs",
                    resource: "event-summaries",
                    revision: "11",
                    operation: "remove",
                    data: null,
                }
            } else throw new Error(`Unexpected offline call ${request.path}`)
            return Response.json({ status: "success", value })
        }
    )
    const call = (path: string, query: string, key = "synthetic-reader") =>
        GET(
            new Request(`https://logi.test/api/v1/clan/${path}?${query}`, {
                headers: { Authorization: `Bearer ${key}` },
            }),
            { params: Promise.resolve({ path: path.split("/") }) }
        )
    const bootstrap = await call(
        "changes",
        "game=wardogs&resources=event-summaries&start=now"
    )
    assert.equal(bootstrap.status, 200)
    assert.equal(bootstrap.headers.get("cache-control"), "no-store")
    const body = await bootstrap.json()
    assert.ok(body.page.nextCursor)
    const query = `game=wardogs&resources=event-summaries&cursor=${encodeURIComponent(body.page.nextCursor)}`
    assert.equal((await call("changes", query)).status, 200)
    assert.equal((await call("changes", query, "different-key")).status, 400)
    assert.equal((await call("changes", query + "tampered")).status, 400)
    assert.equal(
        (
            await call(
                "changes",
                "game=wardogs&resources=match-summaries&start=now"
            )
        ).status,
        403
    )
    const before = reads
    assert.equal(
        (await call("sync-records/event-summaries/one", "game=hell_let_loose"))
            .status,
        403
    )
    assert.equal(reads, before)
    assert.equal(
        (await call("sync-records/event-summaries/one", "game=wardogs")).status,
        200
    )
    assert.equal(
        (await call("sync-records/event-summaries/%E0%A4", "game=wardogs"))
            .status,
        400
    )
    reset = true
    const expired = await call("changes", query)
    assert.equal(expired.status, 410)
    assert.equal((await expired.json()).error.code, "reset_required")
})
test("membership feed HTTP binds its cursor to one subject and carries policy reset state", async (t) => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://offline-test.convex.cloud"
    process.env.INTERNAL_AUTH_SECRET = "synthetic-change-secret"
    const subject = "222222222222222222"
    let reset = false,
        reads = 0
    t.mock.method(
        globalThis,
        "fetch",
        async (_url: unknown, init?: RequestInit) => {
            const request = JSON.parse(String(init?.body)),
                args = request.args[0]
            let value: unknown
            if (request.path === "publicApi:checkRateLimit")
                value = { allowed: true, remaining: 299, resetAt: 0 }
            else if (request.path === "apiKeyAuth:authenticateKey")
                value = {
                    guildId: "guild-a",
                    readAccess: {
                        resources: ["membership-summaries"],
                        gameIds: ["wardogs"],
                    },
                }
            else if (request.path === "integrationChanges:readChanges") {
                reads++
                assert.equal(args.discordUserId, subject)
                if (!args.startNow)
                    assert.equal(args.membershipScopeVersion, "1:2")
                value = reset
                    ? { resetRequired: true }
                    : {
                          items: [],
                          revision: "9",
                          membershipScopeVersion: "1:2",
                          hasMore: false,
                      }
            } else throw new Error("Unexpected offline call")
            return Response.json({ status: "success", value })
        }
    )
    const call = (query: string) =>
        GET(
            new Request(
                `https://logi.test/api/v1/clan/changes?game=wardogs&resources=membership-summaries&${query}`,
                { headers: { Authorization: "Bearer synthetic" } }
            ),
            { params: Promise.resolve({ path: ["changes"] }) }
        )
    assert.equal((await call("start=now")).status, 400)
    const bootstrap = await call(`start=now&subject=${subject}`),
        cursor = (await bootstrap.json()).page.nextCursor
    assert.equal(bootstrap.status, 200)
    assert.equal(
        (await call(`subject=${subject}&cursor=${cursor}`)).status,
        200
    )
    const before = reads
    assert.equal(
        (await call(`subject=333333333333333333&cursor=${cursor}`)).status,
        400
    )
    assert.equal(reads, before)
    reset = true
    assert.equal(
        (await call(`subject=${subject}&cursor=${cursor}`)).status,
        410
    )
})
