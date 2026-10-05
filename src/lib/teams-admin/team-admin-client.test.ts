import {
    adminTeamListUrl,
    fetchAdminTeam,
    fetchAdminTeamPage,
    fetchAdminTeamUsage,
    fetchTeamRequest,
    fetchTeamRequestContext,
    fetchTeamRequestQueue,
    sendAdminTeamCommand,
    sendTeamRequestDecision,
    TeamAdminReadError,
    teamAdminErrorCode,
    teamRequestAdminErrorCode,
    teamRequestQueueUrl,
    uploadPlatformTeamLogo,
} from "./team-admin-client"
import assert from "node:assert/strict"
import test from "node:test"

type Call = { url: string; init?: RequestInit }
function fakeFetch(respond: (call: Call) => Response | Promise<Response>): {
    fetcher: typeof fetch
    calls: Call[]
} {
    const calls: Call[] = []
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
        const call = { url: String(input), init }
        calls.push(call)
        return respond(call)
    }) as typeof fetch
    return { fetcher, calls }
}
const json = (body: unknown, status = 200, headers: HeadersInit = {}) =>
    Response.json(body, { status, headers })

const record = {
    id: "team-1",
    gameId: "wardogs",
    name: "Alpha",
    shortCode: null,
    logoUrl: null,
    description: null,
    links: [],
    revision: 1,
    updatedAt: "2026-10-01T00:00:00.000Z",
    logoAssetId: null,
    linkedGuildId: null,
    mergedIntoTeamId: null,
    archivedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
}
const requestRecord = {
    id: "req-1",
    guildId: "123456789012345678",
    workspaceName: "Clan",
    requestedBy: "100000000000000001",
    kind: "create",
    gameId: "wardogs",
    teamId: null,
    teamName: null,
    proposal: {
        name: "Bravo",
        shortCode: null,
        logoAssetId: null,
        logoUrl: null,
        description: null,
        links: [],
    },
    note: null,
    status: "pending",
    reason: null,
    resultTeamId: null,
    decidedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    notification: "none",
}

test("list and queue URLs omit defaults and blank searches", () => {
    assert.equal(
        adminTeamListUrl({ gameId: "wardogs", archived: false, search: "  " }),
        "/api/superadmin/teams?game=wardogs"
    )
    assert.equal(
        adminTeamListUrl({
            gameId: "hell_let_loose",
            archived: true,
            search: " Alpha ",
            cursor: "c1",
            limit: 20,
        }),
        "/api/superadmin/teams?game=hell_let_loose&archived=true&search=Alpha&cursor=c1&limit=20"
    )
    assert.equal(
        teamRequestQueueUrl({ status: "pending", cursor: "c", limit: 20 }),
        "/api/superadmin/team-requests?status=pending&cursor=c&limit=20"
    )
})

test("a lifecycle state replaces the archived flag in list URLs", () => {
    assert.equal(
        adminTeamListUrl({
            gameId: "wardogs",
            archived: true,
            state: "merged",
        }),
        "/api/superadmin/teams?game=wardogs&state=merged"
    )
})

test("usage and request context reads are batched, parsed and skipped when empty", async () => {
    const usage = {
        teamId: "t1",
        competitions: [],
        competitionCount: 0,
        pendingRequests: 1,
        pendingRequestId: "r1",
    }
    const context = {
        requestId: "r1",
        requester: { name: "Hráč 05", avatarUrl: null },
        similarTeams: [{ id: "t2", name: "DEF", shortCode: null }],
    }
    const { fetcher, calls } = fakeFetch(({ url }) =>
        url.includes("usage=")
            ? json({ items: [usage] })
            : json({ items: [context] })
    )
    assert.deepEqual(await fetchAdminTeamUsage(["t1", "t 2"], { fetcher }), [
        usage,
    ])
    assert.deepEqual(await fetchTeamRequestContext(["r1"], { fetcher }), [
        context,
    ])
    assert.deepEqual(
        calls.map((call) => call.url),
        [
            "/api/superadmin/teams?usage=t1,t%202",
            "/api/superadmin/team-requests?context=r1",
        ]
    )
    assert.deepEqual(await fetchAdminTeamUsage([], { fetcher }), [])
    assert.deepEqual(await fetchTeamRequestContext([], { fetcher }), [])
    assert.equal(calls.length, 2)
    const broken = fakeFetch(() => json({ items: [{ teamId: 1 }] }))
    await assert.rejects(
        fetchAdminTeamUsage(["t1"], { fetcher: broken.fetcher }),
        (error) =>
            error instanceof TeamAdminReadError && error.code === "unavailable"
    )
    const denied = fakeFetch(() => json({ error: "forbidden" }, 403))
    await assert.rejects(
        fetchTeamRequestContext(["r1"], { fetcher: denied.fetcher }),
        (error) =>
            error instanceof TeamAdminReadError && error.code === "forbidden"
    )
})

test("error codes narrow to the known vocabularies", () => {
    assert.equal(
        teamAdminErrorCode({ error: "invalid_merge" }),
        "invalid_merge"
    )
    assert.equal(teamAdminErrorCode({ error: "weird" }), "unavailable")
    assert.equal(teamAdminErrorCode(null), "unavailable")
    assert.equal(
        teamRequestAdminErrorCode({ error: "not_pending" }),
        "not_pending"
    )
    assert.equal(teamRequestAdminErrorCode({ error: 1 }), "unavailable")
})

test("reads parse records and surface error codes", async () => {
    const { fetcher } = fakeFetch(({ url }) => {
        if (url.includes("teamId=team-1")) return json({ team: record })
        if (url.includes("teamId=gone"))
            return json({ error: "not_found" }, 404)
        if (url.includes("teamId=denied"))
            return json({ error: "forbidden" }, 403)
        return json({ items: [record], nextCursor: null })
    })
    assert.equal((await fetchAdminTeam("team-1", { fetcher }))?.name, "Alpha")
    assert.equal(await fetchAdminTeam("gone", { fetcher }), null)
    await assert.rejects(
        fetchAdminTeam("denied", { fetcher }),
        (error) =>
            error instanceof TeamAdminReadError && error.code === "forbidden"
    )
    const page = await fetchAdminTeamPage(
        { gameId: "wardogs", archived: false },
        { fetcher }
    )
    assert.equal(page.items.length, 1)
    const broken = fakeFetch(() => json({ items: "nope" }))
    await assert.rejects(
        fetchAdminTeamPage(
            { gameId: "wardogs", archived: false },
            { fetcher: broken.fetcher }
        ),
        (error) =>
            error instanceof TeamAdminReadError && error.code === "unavailable"
    )
})

test("commands post JSON and report codes with existing IDs", async () => {
    const { fetcher, calls } = fakeFetch(({ init }) => {
        const body = JSON.parse(String(init?.body)) as { action: string }
        return body.action === "create"
            ? json({ ok: true, teamId: "team-2", revision: 1 })
            : json({ error: "duplicate_name", existingId: "team-3" }, 409)
    })
    assert.deepEqual(
        await sendAdminTeamCommand(
            {
                action: "create",
                input: {
                    gameId: "wardogs",
                    name: "New",
                    shortCode: null,
                    logoAssetId: null,
                    description: null,
                    links: [],
                    linkedGuildId: null,
                    idempotencyKey: "key-12345678",
                },
            },
            fetcher
        ),
        { ok: true, teamId: "team-2" }
    )
    assert.deepEqual(
        await sendAdminTeamCommand(
            {
                action: "update",
                teamId: "team-1",
                input: { expectedRevision: 1, name: "Taken" },
            },
            fetcher
        ),
        { ok: false, code: "duplicate_name", existingId: "team-3" }
    )
    assert.equal(calls[0]?.init?.method, "POST")
    const offline = fakeFetch(() => {
        throw new TypeError("offline")
    })
    assert.deepEqual(
        await sendAdminTeamCommand(
            {
                action: "archive",
                teamId: "team-1",
                input: { expectedRevision: 1 },
            },
            offline.fetcher
        ),
        { ok: false, code: "unavailable", existingId: null }
    )
})

test("request reads and decisions use the moderation route", async () => {
    const { fetcher, calls } = fakeFetch(({ url, init }) => {
        if (init?.method === "POST")
            return json({ ok: true, status: "merged", teamId: "team-1" })
        if (url.includes("requestId=req-1"))
            return json({ request: requestRecord })
        if (url.includes("requestId=gone"))
            return json({ error: "not_found" }, 404)
        return json({ items: [requestRecord], nextCursor: "next" })
    })
    assert.equal((await fetchTeamRequest("req-1", { fetcher }))?.id, "req-1")
    assert.equal(await fetchTeamRequest("gone", { fetcher }), null)
    const page = await fetchTeamRequestQueue({ status: "pending" }, { fetcher })
    assert.equal(page.nextCursor, "next")
    assert.deepEqual(
        await sendTeamRequestDecision(
            "req-1",
            { decision: "merge", targetTeamId: "team-1" },
            fetcher
        ),
        { ok: true, teamId: "team-1" }
    )
    assert.deepEqual(JSON.parse(String(calls.at(-1)?.init?.body)), {
        requestId: "req-1",
        decision: { decision: "merge", targetTeamId: "team-1" },
    })
    const conflict = fakeFetch(() => json({ error: "not_pending" }, 409))
    assert.deepEqual(
        await sendTeamRequestDecision(
            "req-1",
            { decision: "reject", reason: "No" },
            conflict.fetcher
        ),
        { ok: false, code: "not_pending", existingId: null }
    )
})

test("platform logo uploads go to the superadmin route", async () => {
    const asset = {
        id: "asset-1",
        kind: "team-logo",
        contentType: "image/png",
        width: 512,
        height: 512,
        bytes: 10,
        url: "https://logi.test/i/a.png",
        createdAt: "2026-10-01T00:00:00.000Z",
    }
    const { fetcher, calls } = fakeFetch(() => json({ asset }))
    const file = new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" })
    const uploaded = await uploadPlatformTeamLogo(file, fetcher)
    assert.equal(uploaded.ok && uploaded.asset.id, "asset-1")
    assert.equal(calls[0]?.url, "/api/superadmin/image-assets?kind=team-logo")
    const banner = fakeFetch(() =>
        json({ asset: { ...asset, kind: "panel-banner" } })
    )
    assert.deepEqual(await uploadPlatformTeamLogo(file, banner.fetcher), {
        ok: false,
        error: "unavailable",
        retryAfterMs: null,
    })
    const limited = fakeFetch(() =>
        json({ error: "upload_limited", retryAfterMs: 4000 }, 429)
    )
    assert.deepEqual(await uploadPlatformTeamLogo(file, limited.fetcher), {
        ok: false,
        error: "upload_limited",
        retryAfterMs: 4000,
    })
    const untouched = fakeFetch(() => json({}))
    assert.deepEqual(
        await uploadPlatformTeamLogo(
            new Blob(["x"], { type: "image/gif" }),
            untouched.fetcher
        ),
        { ok: false, error: "unsupported_type", retryAfterMs: null }
    )
    assert.equal(untouched.calls.length, 0)
})
