import {
    parseTeamRequestQueueQuery,
    superadminTeamRequestsHandlers,
    type SuperadminTeamRequestsPorts,
    type TeamRequestDecideBody,
} from "./superadmin-team-requests-route"
import assert from "node:assert/strict"
import test from "node:test"

const origin = "https://logi.test"
const url = (query = "") => `${origin}/api/superadmin/team-requests${query}`
const params = (query: string) => new URLSearchParams(query)

test("parses the queue with the pending default and explicit filters", () => {
    assert.deepEqual(parseTeamRequestQueueQuery(params("")), {
        kind: "queue",
        status: "pending",
        cursor: null,
        limit: 20,
    })
    assert.deepEqual(
        parseTeamRequestQueueQuery(
            params("status=rejected&cursor=c2&limit=50")
        ),
        { kind: "queue", status: "rejected", cursor: "c2", limit: 50 }
    )
    assert.deepEqual(parseTeamRequestQueueQuery(params("requestId=req-1")), {
        kind: "get",
        requestId: "req-1",
    })
    for (const query of [
        "status=open",
        "limit=0",
        "limit=51",
        "limit=abc",
        "requestId=",
        `requestId=${"r".repeat(65)}`,
    ])
        assert.equal(parseTeamRequestQueueQuery(params(query)), null, query)
})

type Access = { secret: string }
function fakePorts(
    overrides: Partial<SuperadminTeamRequestsPorts<Access>> = {}
) {
    const decided: TeamRequestDecideBody[] = []
    const ports: SuperadminTeamRequestsPorts<Access> = {
        origin: "https://logi.test",
        access: async () => ({ secret: "s" }),
        get: async (_access, requestId) =>
            requestId === "req-1" ? { id: "req-1" } : null,
        context: async (_access, requestIds) => ({ items: [], requestIds }),
        queue: async (_access, query) => ({
            items: [],
            nextCursor: null,
            query,
        }),
        decide: async (_access, body) => {
            decided.push(body)
            return { ok: true, status: body.decision.decision, teamId: null }
        },
        ...overrides,
    }
    return { ports, decided }
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

test("GET denies non-superadmins and reads requests or the queue", async () => {
    const denied = superadminTeamRequestsHandlers(
        fakePorts({ access: async () => null }).ports
    )
    assert.equal((await denied.GET(new Request(url()))).status, 403)

    const handlers = superadminTeamRequestsHandlers(fakePorts().ports)
    const one = await handlers.GET(new Request(url("?requestId=req-1")))
    assert.deepEqual(await one.json(), { request: { id: "req-1" } })
    assert.equal(one.headers.get("cache-control"), "no-store")
    assert.equal(
        (await handlers.GET(new Request(url("?requestId=req-9")))).status,
        404
    )
    const queue = await handlers.GET(new Request(url("?status=merged")))
    assert.equal(
        ((await queue.json()) as { query: { status: string } }).query.status,
        "merged"
    )
    const bad = await handlers.GET(new Request(url("?status=nope")))
    assert.equal(bad.status, 400)
    assert.deepEqual(await bad.json(), { error: "invalid_query" })
})

test("GET reads the moderation context of listed requests", async () => {
    assert.deepEqual(parseTeamRequestQueueQuery(params("context=r1,r2,r1")), {
        kind: "context",
        requestIds: ["r1", "r2"],
    })
    for (const query of [
        "context=",
        "context=r1,,r2",
        `context=${Array.from({ length: 51 }, (_, i) => `r${i}`).join(",")}`,
    ])
        assert.equal(parseTeamRequestQueueQuery(params(query)), null, query)
    const denied = superadminTeamRequestsHandlers(
        fakePorts({ access: async () => null }).ports
    )
    assert.equal(
        (await denied.GET(new Request(url("?context=r1")))).status,
        403
    )
    const handlers = superadminTeamRequestsHandlers(fakePorts().ports)
    const context = await handlers.GET(new Request(url("?context=r1")))
    assert.equal(context.status, 200)
    assert.deepEqual(await context.json(), { items: [], requestIds: ["r1"] })
})

test("GET answers 503 when Convex throws", async () => {
    const handlers = superadminTeamRequestsHandlers(
        fakePorts({
            queue: async () => {
                throw new Error("down")
            },
        }).ports
    )
    assert.equal((await handlers.GET(new Request(url()))).status, 503)
})

test("POST forwards each validated decision", async () => {
    const { ports, decided } = fakePorts()
    const handlers = superadminTeamRequestsHandlers(ports)
    const bodies = [
        { requestId: "req-1", decision: { decision: "approve" } },
        {
            requestId: "req-2",
            decision: {
                decision: "approve",
                targetRevision: 4,
                proposal: { name: " Bravo ", links: ["https://b.example"] },
            },
        },
        {
            requestId: "req-3",
            decision: { decision: "merge", targetTeamId: "team-1" },
        },
        {
            requestId: "req-4",
            decision: { decision: "reject", reason: "  Duplicate  " },
        },
    ]
    for (const body of bodies)
        assert.equal((await handlers.POST(post(body))).status, 200)
    assert.deepEqual(decided[1]?.decision, {
        decision: "approve",
        targetRevision: 4,
        proposal: {
            name: "Bravo",
            shortCode: null,
            logoAssetId: null,
            description: null,
            links: ["https://b.example"],
        },
    })
    assert.deepEqual(decided[3]?.decision, {
        decision: "reject",
        reason: "Duplicate",
    })
})

test("POST rejects cross-origin, forbidden and invalid decisions", async () => {
    const { ports, decided } = fakePorts()
    const handlers = superadminTeamRequestsHandlers(ports)
    const valid = { requestId: "req-1", decision: { decision: "approve" } }
    assert.equal(
        (await handlers.POST(post(valid, { origin: "https://evil.test" })))
            .status,
        403
    )
    assert.equal(
        (
            await superadminTeamRequestsHandlers(
                fakePorts({ access: async () => null }).ports
            ).POST(post(valid))
        ).status,
        403
    )
    for (const body of [
        "nope",
        { requestId: "req-1" },
        { requestId: "req-1", decision: { decision: "reject", reason: "  " } },
        {
            requestId: "req-1",
            decision: { decision: "reject", reason: "x".repeat(501) },
        },
        { requestId: "req-1", decision: { decision: "merge" } },
        { requestId: "", decision: { decision: "approve" } },
        { requestId: "req-1", decision: { decision: "approve" }, extra: 1 },
    ]) {
        const response = await handlers.POST(post(body))
        assert.equal(response.status, 400, JSON.stringify(body))
        assert.deepEqual(await response.json(), { error: "invalid_decision" })
    }
    assert.equal(decided.length, 0)
})

test("POST maps decision errors and thrown failures", async () => {
    const results: unknown[] = [
        { error: "not_pending" },
        { error: "duplicate_name", existingId: "team-7" },
        { error: "not_found" },
        { error: "team_game_mismatch" },
    ]
    const handlers = superadminTeamRequestsHandlers(
        fakePorts({
            decide: async () => {
                const next = results.shift()
                if (!next) throw new Error("down")
                return next
            },
        }).ports
    )
    const body = { requestId: "req-1", decision: { decision: "approve" } }
    assert.equal((await handlers.POST(post(body))).status, 409)
    const duplicate = await handlers.POST(post(body))
    assert.equal(duplicate.status, 409)
    assert.deepEqual(await duplicate.json(), {
        error: "duplicate_name",
        existingId: "team-7",
    })
    assert.equal((await handlers.POST(post(body))).status, 404)
    assert.equal((await handlers.POST(post(body))).status, 400)
    assert.equal((await handlers.POST(post(body))).status, 503)
})
