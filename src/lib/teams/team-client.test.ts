import {
    fetchTeamPage,
    fetchTeamRecord,
    matchTeamSaveErrorCode,
    requestMatchTeamRefresh,
    teamListUrl,
    TeamReadError,
    teamReadErrorCode,
    uploadTeamLogo,
} from "./team-client"
import type { TeamRecord } from "@/domain/teams/team"
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
    description: "Sunday league side.",
    links: ["https://red.example"],
    revision: 2,
    updatedAt: "2026-10-01T00:00:00.000Z",
    logoAssetId: null,
    linkedGuildId: null,
    mergedIntoTeamId: null,
    archivedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
} satisfies TeamRecord
const isRead = (code: string) => (error: unknown) =>
    error instanceof TeamReadError && error.code === code

test("list URLs scope one game and send only non-default filters", () => {
    assert.equal(
        teamListUrl("srv 1", { gameId: "wardogs" }),
        "/api/servers/srv%201/teams?game=wardogs"
    )
    const url = new URL(
        teamListUrl("srv", {
            gameId: "hell_let_loose",
            search: `  ${"x".repeat(70)} `,
            cursor: "abc",
            limit: 25,
        }),
        "https://logi.test"
    )
    assert.equal(url.searchParams.has("archived"), false)
    assert.equal(url.searchParams.get("search")?.length, 64)
    assert.equal(url.searchParams.get("cursor"), "abc")
    assert.equal(url.searchParams.get("limit"), "25")
    assert.equal(
        new URL(
            teamListUrl("srv", { gameId: "wardogs", search: "   " }),
            "https://logi.test"
        ).searchParams.has("search"),
        false
    )
})

test("unknown or missing read error codes read as unavailable", () => {
    assert.equal(teamReadErrorCode({ error: "forbidden" }), "forbidden")
    assert.equal(teamReadErrorCode({ error: "rate_limited" }), "rate_limited")
    assert.equal(teamReadErrorCode({ error: "Something odd." }), "unavailable")
    assert.equal(
        teamReadErrorCode({ error: "duplicate_name" }),
        "unavailable",
        "write errors are not part of the read vocabulary"
    )
    assert.equal(teamReadErrorCode(null), "unavailable")
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

test("catalogue pages and records are validated before use", async () => {
    let calls = stubFetch(() => json({ items: [record], nextCursor: "next" }))
    const page = await fetchTeamPage("srv", { gameId: "wardogs" })
    assert.equal(page.items[0]?.name, "Red Wolves")
    assert.deepEqual(page.items[0]?.links, ["https://red.example"])
    assert.equal(page.nextCursor, "next")
    assert.equal(calls[0]?.url, "/api/servers/srv/teams?game=wardogs")
    assert.equal(calls[0]?.init?.cache, "no-store")

    stubFetch(() => json({ error: "forbidden" }, 403))
    await assert.rejects(
        fetchTeamPage("srv", { gameId: "wardogs" }),
        isRead("forbidden")
    )
    stubFetch(() => json({ error: "rate_limited" }, 429))
    await assert.rejects(
        fetchTeamPage("srv", { gameId: "wardogs" }),
        isRead("rate_limited")
    )
    stubFetch(() => json({ items: [{ id: "x" }], nextCursor: null }))
    await assert.rejects(
        fetchTeamPage("srv", { gameId: "wardogs" }),
        isRead("unavailable")
    )

    calls = stubFetch(() => json({ team: record }))
    assert.equal((await fetchTeamRecord("srv", "team 1"))?.id, "team_1")
    assert.equal(calls[0]?.url, "/api/servers/srv/teams?teamId=team%201")
    // A merged entry stays readable so saved selections keep their history.
    stubFetch(() =>
        json({
            team: {
                ...record,
                archivedAt: "2026-10-03T00:00:00.000Z",
                mergedIntoTeamId: "team_2",
            },
        })
    )
    assert.equal(
        (await fetchTeamRecord("srv", "team_1"))?.mergedIntoTeamId,
        "team_2"
    )
    stubFetch(() => json({ error: "not_found" }, 404))
    assert.equal(await fetchTeamRecord("srv", "gone"), null)
    stubFetch(() => json({ error: "unavailable" }, 503))
    await assert.rejects(
        fetchTeamRecord("srv", "team_1"),
        isRead("unavailable")
    )
})

test("logo uploads use the shared image client, keep its retry hint and refuse other kinds", async () => {
    let calls = stubFetch(() => json({}))
    assert.deepEqual(
        await uploadTeamLogo(
            "srv",
            new Blob(["<svg/>"], { type: "image/svg+xml" })
        ),
        { ok: false, error: "unsupported_type", retryAfterMs: null }
    )
    assert.deepEqual(
        await uploadTeamLogo(
            "srv",
            new Blob([new Uint8Array(2 * 1024 * 1024 + 1)], {
                type: "image/png",
            })
        ),
        { ok: false, error: "too_large", retryAfterMs: null }
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
    assert.equal(calls[0]?.init?.method, "POST")
    assert.deepEqual(calls[0]?.init?.headers, { "Content-Type": "image/png" })
    assert.equal(calls[0]?.init?.body, file)

    stubFetch(() => json({ error: "upload_limited", retryAfterMs: 5000 }, 429))
    assert.deepEqual(await uploadTeamLogo("srv", file), {
        ok: false,
        error: "upload_limited",
        retryAfterMs: 5000,
    })
    stubFetch(() => json({ error: "bad_dimensions" }, 400))
    assert.deepEqual(await uploadTeamLogo("srv", file), {
        ok: false,
        error: "bad_dimensions",
        retryAfterMs: null,
    })
    stubFetch(() => json({ asset: { ...asset, kind: "panel-banner" } }))
    assert.deepEqual(await uploadTeamLogo("srv", file), {
        ok: false,
        error: "unavailable",
        retryAfterMs: null,
    })
    const injected: string[] = []
    const fetcher = (async (input: RequestInfo | URL) => {
        injected.push(String(input))
        return json({ asset })
    }) as typeof fetch
    assert.deepEqual(await uploadTeamLogo("srv 1", file, fetcher), {
        ok: true,
        asset,
    })
    assert.deepEqual(injected, [
        "/api/servers/srv%201/image-assets?kind=team-logo",
    ])
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
    stubFetch(() => json({ error: "rate_limited" }, 429))
    assert.deepEqual(await requestMatchTeamRefresh("srv", "evt", "team_1"), {
        ok: false,
        code: "rate_limited",
    })
    stubFetch(() => json({ ok: true, matchTeams: [{ teamId: "x" }] }))
    assert.deepEqual(await requestMatchTeamRefresh("srv", "evt", "team_1"), {
        ok: false,
        code: "unavailable",
    })
    stubFetch(() => {
        throw new TypeError("network down")
    })
    assert.deepEqual(await requestMatchTeamRefresh("srv", "evt", "team_1"), {
        ok: false,
        code: "unavailable",
    })
})
