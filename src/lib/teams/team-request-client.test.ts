import {
    cancelTeamRequest,
    fetchTeamRequestPage,
    submitTeamRequest,
    TEAM_REQUEST_CLIENT_ERRORS,
    teamRequestErrorCode,
    teamRequestErrorMessage,
    teamRequestListUrl,
} from "./team-request-client"
import type {
    TeamRequestRecord,
    TeamRequestSubmit,
} from "@/domain/teams/team-request"
import { getDictionary } from "@/i18n/dictionaries"
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

const request: TeamRequestRecord = {
    id: "teamRequests:1",
    guildId: "910000000000000001",
    workspaceName: "Alpha Clan",
    requestedBy: "123456789",
    kind: "create",
    gameId: "wardogs",
    teamId: null,
    teamName: null,
    proposal: {
        name: "Red Wolves",
        shortCode: "RW",
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
    createdAt: "2026-10-04T10:00:00.000Z",
    notification: "none",
}
const input: TeamRequestSubmit = {
    kind: "create",
    gameId: "wardogs",
    proposal: {
        name: "Red Wolves",
        shortCode: null,
        logoAssetId: null,
        description: null,
        links: [],
    },
    note: null,
    idempotencyKey: "0b3c9e4a-8f4e-4b1c-9c37-1b2a3c4d5e6f",
}

test("list URLs carry only a cursor and limit", () => {
    assert.equal(
        teamRequestListUrl("srv 1"),
        "/api/servers/srv%201/team-requests"
    )
    assert.equal(
        teamRequestListUrl("srv", { cursor: "next page", limit: 20 }),
        "/api/servers/srv/team-requests?cursor=next+page&limit=20"
    )
    assert.equal(
        teamRequestListUrl("srv", { cursor: null }),
        "/api/servers/srv/team-requests"
    )
})

test("request pages are validated and failures keep their code", async () => {
    const calls = stubFetch(() =>
        json({ items: [request], nextCursor: "next" })
    )
    assert.deepEqual(await fetchTeamRequestPage("srv"), {
        ok: true,
        items: [request],
        nextCursor: "next",
    })
    assert.equal(calls[0]?.init?.cache, "no-store")
    stubFetch(() => json({ items: [{ id: "x" }], nextCursor: null }))
    assert.deepEqual(await fetchTeamRequestPage("srv"), {
        ok: false,
        code: "unavailable",
    })
    stubFetch(() => json({ error: "forbidden" }, 403))
    assert.deepEqual(await fetchTeamRequestPage("srv"), {
        ok: false,
        code: "forbidden",
    })
    stubFetch(() => {
        throw new TypeError("network down")
    })
    assert.deepEqual(await fetchTeamRequestPage("srv"), {
        ok: false,
        code: "unavailable",
    })
})

test("a submission posts the submit command and reports a replay", async () => {
    const calls = stubFetch(() =>
        json({ ok: true, requestId: "teamRequests:1", replayed: true })
    )
    assert.deepEqual(await submitTeamRequest("srv", input), {
        ok: true,
        requestId: "teamRequests:1",
        replayed: true,
    })
    assert.equal(calls[0]?.url, "/api/servers/srv/team-requests")
    assert.equal(calls[0]?.init?.method, "POST")
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
        action: "submit",
        input,
    })
})

test("submission failures surface request, catalogue and transport codes", async () => {
    for (const [status, error] of [
        [400, "limit_reached"],
        [409, "idempotency_conflict"],
        [400, "team_archived"],
        [400, "asset_unavailable"],
        [404, "not_found"],
        [429, "rate_limited"],
        [403, "forbidden"],
    ] as const) {
        stubFetch(() => json({ error }, status))
        assert.deepEqual(await submitTeamRequest("srv", input), {
            ok: false,
            code: error,
        })
    }
    stubFetch(() => json({ error: "Internal stack trace" }, 500))
    assert.deepEqual(await submitTeamRequest("srv", input), {
        ok: false,
        code: "unavailable",
    })
    stubFetch(() => json({ ok: true }))
    assert.deepEqual(
        await submitTeamRequest("srv", input),
        { ok: false, code: "unavailable" },
        "a success without a request ID is not trusted"
    )
    stubFetch(() => {
        throw new TypeError("network down")
    })
    assert.deepEqual(await submitTeamRequest("srv", input), {
        ok: false,
        code: "unavailable",
    })
})

test("cancelling posts the cancel command", async () => {
    const calls = stubFetch(() => json({ ok: true }))
    assert.deepEqual(await cancelTeamRequest("srv", "teamRequests:1"), {
        ok: true,
    })
    assert.deepEqual(JSON.parse(String(calls[0]?.init?.body)), {
        action: "cancel",
        requestId: "teamRequests:1",
    })
    stubFetch(() => json({ error: "not_pending" }, 409))
    assert.deepEqual(await cancelTeamRequest("srv", "teamRequests:1"), {
        ok: false,
        code: "not_pending",
    })
})

test("error codes outside the vocabulary read as unavailable", () => {
    assert.equal(teamRequestErrorCode({ error: "not_pending" }), "not_pending")
    assert.equal(
        teamRequestErrorCode({ error: "invalid_merge" }),
        "invalid_merge"
    )
    assert.equal(teamRequestErrorCode({ error: "nope" }), "unavailable")
    assert.equal(teamRequestErrorCode(undefined), "unavailable")
})

for (const locale of ["en", "cs", "de"] as const) {
    test(`every request error code has a ${locale} message`, () => {
        const dictionary = getDictionary(locale)
        for (const code of TEAM_REQUEST_CLIENT_ERRORS) {
            const message = teamRequestErrorMessage(dictionary, code)
            assert.ok(message.length > 0, `${locale} ${code}`)
        }
        // Request-specific meanings win over the catalogue's for shared codes.
        assert.equal(
            teamRequestErrorMessage(dictionary, "limit_reached"),
            dictionary.teamRequests.errors.limit_reached
        )
        assert.equal(
            teamRequestErrorMessage(dictionary, "asset_unavailable"),
            dictionary.teams.errors.asset_unavailable
        )
    })
}
