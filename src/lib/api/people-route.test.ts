import { PEOPLE_RESOURCES } from "@/domain/api/people-summaries"
import { GET } from "@/app/api/v1/clan/[[...path]]/route"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const fixture = JSON.parse(
    readFileSync("docs/integrations/website/v0.14/fixtures.json", "utf8")
)
test("people HTTP boundaries require independent grants, exact scope and signed reset-aware cursors", async (t) => {
    process.env.NEXT_PUBLIC_CONVEX_URL = "https://offline-test.convex.cloud"
    process.env.INTERNAL_AUTH_SECRET = "synthetic-people-secret"
    let legacy = false,
        revoked = false,
        generation = "0",
        reads = 0
    const rows: Record<string, unknown> = {
        "member-summaries": fixture.member,
        "roster-summaries": fixture.roster,
        "player-stat-summaries": fixture.statistics,
    }
    t.mock.method(
        globalThis,
        "fetch",
        async (_url: unknown, init?: RequestInit) => {
            const request = JSON.parse(String(init?.body)),
                args = request.args[0]
            let value: unknown
            if (request.path === "publicApi:checkRateLimit")
                value = { allowed: true, remaining: 299, resetAt: 0 }
            else if (request.path === "publicApi:authenticateKey")
                value = revoked
                    ? null
                    : {
                          guildId: fixture.member.guildId,
                          ...(legacy
                              ? {}
                              : {
                                    readAccess: {
                                        resources: [...PEOPLE_RESOURCES],
                                        gameIds: ["wardogs"],
                                    },
                                }),
                      }
            else if (request.path === "peopleSummaries:list") {
                reads++
                value =
                    args.cursor && args.peopleScopeVersion !== generation
                        ? { resetRequired: true }
                        : {
                              items: args.cursor ? [] : [rows[args.resource]],
                              limit: 1,
                              nextCursor: args.cursor ? null : "native-page-2",
                              peopleScopeVersion: generation,
                              resetRequired: false,
                          }
            } else if (request.path === "peopleSummaries:get") {
                reads++
                value = args.id === fixture.member.id ? fixture.member : null
            } else if (request.path === "integrationChanges:readChanges") {
                reads++
                value =
                    !args.startNow && args.peopleScopeVersion !== generation
                        ? { resetRequired: true }
                        : {
                              items: [],
                              revision: "1",
                              hasMore: false,
                              peopleScopeVersion: generation,
                              resetRequired: false,
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
    for (const resource of PEOPLE_RESOURCES) {
        const response = await call(resource, "game=wardogs&limit=10")
        assert.equal(response.status, 200)
        assert.equal(response.headers.get("cache-control"), "no-store")
        const first = await response.json()
        assert.deepEqual(Object.keys(first.page).sort(), [
            "limit",
            "nextCursor",
        ])
        assert.equal(first.page.limit, 1)
        assert.ok(first.page.nextCursor)
        const second = await call(
            resource,
            `game=wardogs&cursor=${encodeURIComponent(first.page.nextCursor)}`
        )
        assert.deepEqual((await second.json()).data, [])
        assert.equal(
            (
                await call(
                    resource,
                    `game=wardogs&cursor=${encodeURIComponent(first.page.nextCursor)}`,
                    "different-reader"
                )
            ).status,
            400
        )
        assert.equal((await call(resource, "game=hell_let_loose")).status, 403)
        assert.equal(
            (await call(resource, "game=wardogs&game=wardogs")).status,
            400
        )
        assert.equal(
            (await call(resource, "game=wardogs&subject=910000000000000002"))
                .status,
            400
        )
        assert.equal(
            (await call(resource, "game=wardogs&limit=11")).status,
            400
        )
        generation = String(Number(generation) + 1)
        assert.equal(
            (
                await call(
                    resource,
                    `game=wardogs&cursor=${encodeURIComponent(first.page.nextCursor)}`
                )
            ).status,
            410
        )
    }
    assert.equal(
        (await call(`member-summaries/${fixture.member.id}`, "game=wardogs"))
            .status,
        200
    )
    assert.equal(
        (await call("member-summaries/unknown", "game=wardogs")).status,
        404
    )
    const first = await call(
        "changes",
        "game=wardogs&resources=member-summaries,roster-summaries,player-stat-summaries&start=now"
    )
    const cursor = (await first.json()).page.nextCursor
    assert.equal(
        (
            await call(
                "changes",
                `game=wardogs&resources=member-summaries,roster-summaries,player-stat-summaries&cursor=${cursor}`
            )
        ).status,
        200
    )
    generation = String(Number(generation) + 1)
    assert.equal(
        (
            await call(
                "changes",
                `game=wardogs&resources=member-summaries,roster-summaries,player-stat-summaries&cursor=${cursor}`
            )
        ).status,
        410
    )
    const before = reads
    legacy = true
    for (const resource of PEOPLE_RESOURCES)
        assert.equal((await call(resource, "game=wardogs")).status, 403)
    assert.equal(reads, before)
    revoked = true
    assert.equal((await call("member-summaries", "game=wardogs")).status, 401)
})
