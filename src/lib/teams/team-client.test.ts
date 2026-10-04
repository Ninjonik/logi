import {
    fetchTeamPage,
    fetchTeamRecord,
    matchTeamSaveErrorCode,
    requestMatchTeamRefresh,
    restoreTeam,
    sendTeamCommand,
    teamErrorCode,
    teamListUrl,
    TeamRequestError,
    uploadErrorCode,
    uploadTeamLogo,
} from "./team-client"
import { afterEach, test } from "node:test"
import assert from "node:assert/strict"

type Call = { url: string; init?: RequestInit }
const realFetch = globalThis.fetch
afterEach(() => {
    globalThis.fetch = realFetch
})
function stubFetch(respond: (call: Call) => Response | Promise<Response>) {
    const calls: Call[] = []
    globalThis.fetch = (async (
        input: RequestInfo | URL,
        init?: RequestInit
    ) => {
        const call = { url: String(input), init }
        calls.push(call)
        return await respond(call)
    }) as typeof fetch
    return calls
}
const json = (body: unknown, status = 200) => Response.json(body, { status })
const record = {
    id: "team_1",
    gameId: "wardogs",
    name: "Red Wolves",
    shortCode: "RW",
    logoUrl: null,
    revision: 2,
    updatedAt: "2026-10-01T00:00:00.000Z",
    logoAssetId: null,
    archivedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
}

test("list URLs scope one game and send only non-default filters", () => {
    assert.equal(
        teamListUrl("srv 1", { gameId: "wardogs", archived: false }),
        "/api/servers/srv%201/teams?game=wardogs"
    )
    const url = new URL(
        teamListUrl("srv", {
            gameId: "hell_let_loose",
            archived: true,
            search: `  ${"x".repeat(70)} `,
            cursor: "abc",
            limit: 25,
        }),
        "https://logi.test"
    )
    assert.equal(url.searchParams.get("archived"), "true")
    assert.equal(url.searchParams.get("search")?.length, 64)
    assert.equal(url.searchParams.get("cursor"), "abc")
    assert.equal(url.searchParams.get("limit"), "25")
    assert.equal(
        new URL(
            teamListUrl("srv", {
                gameId: "wardogs",
                archived: false,
                search: "   ",
            }),
            "https://logi.test"
        ).searchParams.has("search"),
        false
    )
})

test("unknown or missing error codes read as unavailable", () => {
    assert.equal(teamErrorCode({ error: "duplicate_name" }), "duplicate_name")
    assert.equal(teamErrorCode({ error: "Something odd." }), "unavailable")
    assert.equal(teamErrorCode(null), "unavailable")
    assert.equal(uploadErrorCode({ error: "too_large" }), "too_large")
    assert.equal(uploadErrorCode({ error: 5 }), "unavailable")
    assert.equal(
        matchTeamSaveErrorCode({ error: "team_archived" }),
        "team_archived"
    )
    assert.equal(
        matchTeamSaveErrorCode({ error: "unavailable" }),
        null,
        "generic save failures keep the existing save message"
    )
    assert.equal(matchTeamSaveErrorCode({ error: "Event not found." }), null)
})

test("directory pages and records are validated before use", async () => {
    stubFetch(() => json({ items: [record], nextCursor: "next" }))
    const page = await fetchTeamPage("srv", {
        gameId: "wardogs",
        archived: false,
    })
    assert.equal(page.items[0]?.name, "Red Wolves")
    assert.equal(page.nextCursor, "next")

    stubFetch(() => json({ error: "forbidden" }, 403))
    await assert.rejects(
        fetchTeamPage("srv", { gameId: "wardogs", archived: false }),
        (error: unknown) =>
            error instanceof TeamRequestError && error.code === "forbidden"
    )
    stubFetch(() => json({ items: [{ id: "x" }], nextCursor: null }))
    await assert.rejects(
        fetchTeamPage("srv", { gameId: "wardogs", archived: false }),
        (error: unknown) =>
            error instanceof TeamRequestError && error.code === "unavailable"
    )

    const calls = stubFetch(() => json({ team: record }))
    assert.equal((await fetchTeamRecord("srv", "team 1"))?.id, "team_1")
    assert.equal(calls[0]?.url, "/api/servers/srv/teams?teamId=team%201")
    stubFetch(() => json({ error: "not_found" }, 404))
    assert.equal(await fetchTeamRecord("srv", "gone"), null)
})

test("commands post JSON and surface conflicts with the existing ID", async () => {
    const calls = stubFetch(() =>
        json({ ok: true, teamId: "team_1", revision: 1, replayed: true })
    )
    const created = await sendTeamCommand("srv", {
        action: "create",
        input: {
            gameId: "wardogs",
            name: "Red Wolves",
            shortCode: null,
            logoAssetId: null,
            idempotencyKey: "0b3c9e4a-8f4e-4b1c-9c37-1b2a3c4d5e6f",
        },
    })
    assert.deepEqual(created, { ok: true, teamId: "team_1" })
    assert.equal(calls[0]?.init?.method, "POST")
    assert.equal(
        JSON.parse(String(calls[0]?.init?.body)).input.idempotencyKey,
        "0b3c9e4a-8f4e-4b1c-9c37-1b2a3c4d5e6f"
    )

    stubFetch(() =>
        json({ error: "duplicate_name", existingId: "team_9" }, 409)
    )
    assert.deepEqual(
        await sendTeamCommand("srv", {
            action: "update",
            teamId: "team_1",
            input: { expectedRevision: 2, name: "Blue" },
        }),
        { ok: false, code: "duplicate_name", existingId: "team_9" }
    )
    stubFetch(() => {
        throw new TypeError("network down")
    })
    assert.deepEqual(
        await sendTeamCommand("srv", {
            action: "archive",
            teamId: "team_1",
            input: { expectedRevision: 2 },
        }),
        { ok: false, code: "unavailable", existingId: null }
    )
})

test("logo uploads check type and size locally and send raw bytes", async () => {
    let calls = stubFetch(() => json({}))
    assert.deepEqual(
        await uploadTeamLogo(
            "srv",
            new Blob(["<svg/>"], { type: "image/svg+xml" })
        ),
        { ok: false, code: "unsupported_type" }
    )
    assert.deepEqual(
        await uploadTeamLogo(
            "srv",
            new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], {
                type: "image/png",
            })
        ),
        { ok: false, code: "too_large" }
    )
    assert.equal(calls.length, 0, "rejected files are never sent")

    const asset = {
        id: "asset_1",
        kind: "team-logo",
        contentType: "image/png",
        width: 512,
        height: 512,
        bytes: 2048,
        url: "https://cdn.logi.test/a.png",
        createdAt: "2026-10-01T00:00:00.000Z",
    }
    calls = stubFetch(() => json({ asset }))
    const file = new Blob([new Uint8Array([137, 80, 78, 71])], {
        type: "image/png",
    })
    assert.deepEqual(await uploadTeamLogo("srv", file), { ok: true, asset })
    assert.equal(calls[0]?.url, "/api/servers/srv/image-assets?kind=team-logo")
    assert.deepEqual(calls[0]?.init?.headers, { "content-type": "image/png" })
    assert.equal(calls[0]?.init?.body, file)

    stubFetch(() => json({ error: "upload_limited", retryAfterMs: 5000 }, 429))
    assert.deepEqual(await uploadTeamLogo("srv", file), {
        ok: false,
        code: "upload_limited",
    })
    stubFetch(() => json({ asset: { ...asset, kind: "panel-banner" } }))
    assert.deepEqual(await uploadTeamLogo("srv", file), {
        ok: false,
        code: "unavailable",
    })
})

test("snapshot refresh returns the stored assignments or a match-team code", async () => {
    const assignment = {
        teamId: "team_1",
        slot: "a",
        side: null,
        snapshot: {
            name: "Red Wolves",
            shortCode: "RW",
            logoAssetId: null,
            logoUrl: null,
            teamRevision: 3,
            capturedAt: "2026-10-02T00:00:00.000Z",
        },
    }
    const calls = stubFetch(() => json({ ok: true, matchTeams: [assignment] }))
    assert.deepEqual(await requestMatchTeamRefresh("srv", "evt 1", "team_1"), {
        ok: true,
        matchTeams: [assignment],
    })
    assert.equal(calls[0]?.url, "/api/servers/srv/events/evt%201/match-teams")
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
        action: "refresh",
        teamId: "team_1",
    })
    stubFetch(() => json({ error: "team_archived" }, 400))
    assert.deepEqual(await requestMatchTeamRefresh("srv", "evt", "team_1"), {
        ok: false,
        code: "team_archived",
    })
    stubFetch(() => json({ ok: true, matchTeams: [{ teamId: "x" }] }))
    assert.deepEqual(await requestMatchTeamRefresh("srv", "evt", "team_1"), {
        ok: false,
        code: "unavailable",
    })
})

test("a rate-limited directory request keeps its localizable code", async () => {
    stubFetch(() => json({ error: "rate_limited" }, 429))
    await assert.rejects(
        fetchTeamPage("srv", { gameId: "wardogs", archived: false }),
        (error: unknown) =>
            error instanceof TeamRequestError && error.code === "rate_limited"
    )
    assert.deepEqual(
        await sendTeamCommand("srv", {
            action: "archive",
            teamId: "team_1",
            input: { expectedRevision: 2 },
        }),
        { ok: false, code: "rate_limited", existingId: null }
    )
    assert.deepEqual(
        await requestMatchTeamRefresh("srv", "event_1", "team_1"),
        { ok: false, code: "rate_limited" }
    )
})

test("restoring a duplicate's archived team sends its revision and returns the re-read record", async () => {
    const archived = { ...record, archivedAt: "2026-10-02T00:00:00.000Z" }
    const calls = stubFetch((call) =>
        call.init?.method === "POST"
            ? json({ ok: true, revision: 3 })
            : json({ team: { ...record, revision: 3 } })
    )
    assert.deepEqual(await restoreTeam("srv", archived), {
        ok: true,
        team: { ...record, revision: 3 },
    })
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
        action: "restore",
        teamId: "team_1",
        input: { expectedRevision: 2 },
    })
    assert.equal(calls[1]?.url, "/api/servers/srv/teams?teamId=team_1")
    stubFetch(() => json({ error: "revision_conflict" }, 409))
    assert.deepEqual(await restoreTeam("srv", archived), {
        ok: false,
        code: "revision_conflict",
    })
    // A restore whose re-read still shows the team archived is not reported as success.
    stubFetch((call) =>
        call.init?.method === "POST"
            ? json({ ok: true, revision: 3 })
            : json({ team: archived })
    )
    assert.deepEqual(await restoreTeam("srv", archived), {
        ok: false,
        code: "unavailable",
    })
})
