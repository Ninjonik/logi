import {
    websiteEventCommandHandlers,
    type WebsiteEventRoutePorts,
} from "./website-event-command-route"
import { websiteEventPolicyHandlers } from "./website-event-policy-route"
import { createHash } from "node:crypto"
import assert from "node:assert/strict"
import { test } from "node:test"

const origin = "https://logi.invalid"
const service = "synthetic-service-key-0001"
const actor = "a".repeat(43)
const fields = {
    kind: "match",
    name: "Synthetic event",
    registrationEnd: "2030-01-01T17:00:00Z",
    meetingStart: "2030-01-01T18:00:00Z",
    gameStart: "2030-01-01T18:30:00Z",
    gameEnd: "2030-01-01T20:00:00Z",
}
const command = { operation: "create", event: fields }
const receipt = {
    eventId: "event-one",
    receiptId: "receipt-one",
    revision: "123",
    operation: "create",
    gameId: "wardogs",
    guildId: "123456789012345678",
    replayed: false,
}
const sha = (input: string) => createHash("sha256").update(input).digest("hex")
function fixture() {
    const calls: unknown[] = []
    const ports: WebsiteEventRoutePorts = {
        rateLimit: async (bucket) => {
            calls.push({ bucket })
            return { allowed: true, retryAfterSeconds: 1 }
        },
        execute: async (input) => {
            calls.push(input)
            return { data: receipt }
        },
        editor: async (input) => {
            calls.push(input)
            return {
                data: {
                    eventId: receipt.eventId,
                    guildId: receipt.guildId,
                    gameId: receipt.gameId,
                    revision: receipt.revision,
                    event: fields,
                    matchTeams: null,
                    canEdit: true,
                    canCancel: true,
                },
            }
        },
    }
    const request = (
        body: unknown = command,
        headers: HeadersInit = {},
        query = "game=wardogs"
    ) =>
        new Request(`${origin}/api/v1/clan/event-commands?${query}`, {
            method: "POST",
            headers: {
                authorization: `Bearer ${service}`,
                "X-Logi-Actor-Token": actor,
                "Idempotency-Key": "synthetic-operation-01",
                "Content-Type": "application/json",
                ...headers,
            },
            body: JSON.stringify(body),
        })
    return { ports, calls, request, http: websiteEventCommandHandlers(ports) }
}

test("HTTP command hashes credentials and returns only the closed receipt with no-store", async () => {
    const f = fixture()
    const result = await f.http.POST(f.request())
    assert.equal(result.status, 201)
    assert.equal(result.headers.get("cache-control"), "no-store")
    assert.deepEqual(await result.json(), { data: receipt })
    assert.deepEqual(f.calls, [
        { bucket: `website-event-command:${sha(service)}` },
        {
            keyHash: sha(service),
            actorTokenHash: sha(actor),
            gameId: "wardogs",
            idempotencyKey: "synthetic-operation-01",
            command,
        },
    ])
    assert.equal(JSON.stringify(f.calls).includes(service), false)
    assert.equal(JSON.stringify(f.calls).includes(actor), false)
})

test("HTTP editor uses the same actor credentials and strips no fields by silent coercion", async () => {
    const f = fixture()
    const result = await f.http.GET(f.request(), "event-one")
    assert.equal(result.status, 200)
    assert.equal((await result.json()).data.event.name, fields.name)
    f.ports.editor = async () => ({
        data: { ...receipt, serverPassword: "private" },
    })
    const rejected = await f.http.GET(f.request(), "event-one")
    assert.equal(rejected.status, 503)
    assert.equal((await rejected.text()).includes("private"), false)
})

test("HTTP team selections pass through as IDs only; refresh is a 200 receipt and the editor round-trips assignments", async () => {
    const f = fixture()
    const matchTeams = [
        { teamId: "teamDirectory:alpha", slot: "a", side: "Valkyra" },
        { teamId: "teamDirectory:bravo", slot: "c", side: null },
    ]
    const create = { operation: "create", event: { ...fields, matchTeams } }
    assert.equal((await f.http.POST(f.request(create))).status, 201)
    assert.deepEqual(
        (f.calls[1] as { command: unknown }).command,
        create,
        "assignments are forwarded unchanged"
    )
    const refresh = {
        operation: "refresh_match_team",
        eventId: "event-one",
        expectedRevision: "123",
        teamId: "teamDirectory:alpha",
    }
    f.ports.execute = async (input) => {
        f.calls.push(input)
        return { data: { ...receipt, operation: "refresh_match_team" } }
    }
    const refreshed = await f.http.POST(f.request(refresh))
    assert.equal(refreshed.status, 200)
    assert.equal((await refreshed.json()).data.operation, "refresh_match_team")
    for (const body of [
        // Clients never send snapshots or a fourth slot.
        {
            ...create,
            event: {
                ...fields,
                matchTeams: [
                    { ...matchTeams[0], snapshot: { name: "Forged" } },
                ],
            },
        },
        {
            ...create,
            event: {
                ...fields,
                matchTeams: [
                    ...matchTeams,
                    { teamId: "teamDirectory:c", slot: "b", side: null },
                    { teamId: "teamDirectory:d", slot: "a", side: null },
                ],
            },
        },
        { ...refresh, teamId: undefined },
        { ...refresh, event: fields },
    ]) {
        const g = fixture()
        assert.equal((await g.http.POST(g.request(body))).status, 400)
        assert.equal(g.calls.length, 1, "only the rate limit was consulted")
    }
    // Entries that fail the schema are team-assignment errors, like the
    // dashboard's; a failure elsewhere in the body stays invalid_request.
    const withTeams = (entries: unknown) => ({
        ...create,
        event: { ...fields, matchTeams: entries },
    })
    for (const [body, code] of [
        [withTeams([{ ...matchTeams[0], slot: "d" }]), "invalid_match_teams"],
        [withTeams([{ ...matchTeams[0], side: "" }]), "invalid_match_teams"],
        [
            withTeams([{ ...matchTeams[0], side: "x".repeat(33) }]),
            "invalid_match_teams",
        ],
        [
            withTeams([{ ...matchTeams[0], teamId: "t".repeat(65) }]),
            "invalid_match_teams",
        ],
        [
            withTeams([
                ...matchTeams,
                { teamId: "teamDirectory:c", slot: "b", side: null },
                { teamId: "teamDirectory:d", slot: "a", side: null },
            ]),
            "invalid_match_teams",
        ],
        [withTeams("alpha"), "invalid_match_teams"],
        [
            {
                ...withTeams([{ ...matchTeams[0], slot: "d" }]),
                event: {
                    ...fields,
                    name: "",
                    matchTeams: [{ ...matchTeams[0], slot: "d" }],
                },
            },
            "invalid_request",
        ],
        [{ ...refresh, teamId: "" }, "invalid_request"],
    ] as const) {
        const g = fixture()
        const response = await g.http.POST(g.request(body))
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error: { code } })
        assert.equal(g.calls.length, 1, "only the rate limit was consulted")
    }
    const summary = {
        teamId: "teamDirectory:alpha",
        slot: "a",
        side: "Valkyra",
        name: "Alpha",
        shortCode: "ALP",
        logoUrl: null,
        teamRevision: 2,
        capturedAt: "2026-10-04T10:00:00.000Z",
    }
    f.ports.editor = async () => ({
        data: {
            eventId: receipt.eventId,
            guildId: receipt.guildId,
            gameId: receipt.gameId,
            revision: receipt.revision,
            event: { ...fields, matchTeams: [matchTeams[0]] },
            matchTeams: [summary],
            canEdit: true,
            canCancel: true,
        },
    })
    const editor = await (await f.http.GET(f.request(), "event-one")).json()
    assert.deepEqual(editor.data.event.matchTeams, [matchTeams[0]])
    assert.deepEqual(editor.data.matchTeams, [summary])
    f.ports.editor = async () => ({
        data: {
            ...editor.data,
            matchTeams: [{ ...summary, logoAssetId: "imageAssets:private" }],
        },
    })
    assert.equal(
        (await f.http.GET(f.request(), "event-one")).status,
        503,
        "asset identifiers never leave through the editor"
    )
})

test("HTTP boundary rejects missing actor, ambiguous scope, unsafe keys, and body authority fields", async () => {
    for (const [headers, query, body, expected] of [
        [{ "X-Logi-Actor-Token": "" }, "game=wardogs", command, 401],
        [{ authorization: "" }, "game=wardogs", command, 401],
        [{}, "game=wardogs&game=hell_let_loose", command, 400],
        [{}, "game=wardogs&guildId=foreign", command, 400],
        [{}, "game=unknown", command, 400],
        [{ "Idempotency-Key": "short" }, "game=wardogs", command, 400],
        [{}, "game=wardogs", { ...command, actorId: "spoof" }, 400],
        [
            {},
            "game=wardogs",
            { ...command, event: { ...fields, serverPassword: "private" } },
            400,
        ],
        [{ "Content-Type": "text/plain" }, "game=wardogs", command, 400],
        [{ "Content-Length": "16385" }, "game=wardogs", command, 400],
        [
            {},
            "game=wardogs",
            {
                ...command,
                event: { ...fields, description: "x".repeat(17000) },
            },
            400,
        ],
    ] as const) {
        const f = fixture()
        const response = await f.http.POST(f.request(body, headers, query))
        assert.equal(response.status, expected)
        assert.equal(
            f.calls.filter(
                (call) => typeof call === "object" && call && "command" in call
            ).length,
            0
        )
    }
})

test("HTTP service errors are stable and never echo adapter diagnostics or credentials", async () => {
    for (const [code, status] of Object.entries({
        invalid_request: 400,
        invalid_match_teams: 400,
        unauthorized: 401,
        insufficient_scope: 403,
        policy_denied: 403,
        membership_denied: 403,
        not_found: 404,
        revision_conflict: 409,
        idempotency_conflict: 409,
        invalid_state: 409,
        membership_stale: 503,
    })) {
        const f = fixture()
        f.ports.execute = async () => ({
            error: { code, message: `${service} ${actor}` },
        })
        const response = await f.http.POST(f.request())
        assert.equal(response.status, status)
        assert.deepEqual(await response.json(), { error: { code } })
    }
    const f = fixture()
    f.ports.execute = async () => {
        throw new Error(service)
    }
    assert.deepEqual(await (await f.http.POST(f.request())).json(), {
        error: { code: "unavailable" },
    })
    f.ports.execute = async () => ({ data: { ...receipt, token: actor } })
    assert.equal((await f.http.POST(f.request())).status, 503)
})

test("HTTP rate limit returns Retry-After without invoking the command", async () => {
    const f = fixture()
    f.ports.rateLimit = async () => ({ allowed: false, retryAfterSeconds: 4.2 })
    const response = await f.http.POST(f.request())
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("retry-after"), "5")
    assert.deepEqual(await response.json(), { error: { code: "rate_limited" } })
    assert.deepEqual(f.calls, [])
})

test("policy setup behind a proxy requires same-origin cookie session and forwards immutable workspace binding", async () => {
    const calls: unknown[] = []
    const policy = {
        enabled: true,
        games: [{ gameId: "wardogs", roleIds: ["123456789012345678"] }],
    }
    const input = {
        applicationRecordId: "app-one",
        apiKeyId: "key-one",
        policy,
    }
    let signedIn = true
    const http = websiteEventPolicyHandlers({
        origin,
        session: async () => (signedIn ? { sid: "sid-one" } : null),
        configure: async (...args) => {
            calls.push(args)
            return { data: { ...policy, version: "1" } }
        },
        list: async (...args) => {
            calls.push(args)
            return { data: [{ apiKeyId: "key-one", ...policy, version: "1" }] }
        },
    })
    const request = (headers: HeadersInit = {}) =>
        new Request(
            "http://127.0.0.1:3000/api/servers/workspace-one/website-event-policies",
            {
                method: "POST",
                headers: {
                    origin,
                    "Content-Type": "application/json",
                    ...headers,
                },
                body: JSON.stringify(input),
            }
        )
    assert.equal(
        (
            await http.POST(
                request({ origin: "https://foreign.invalid" }),
                "workspace-one"
            )
        ).status,
        403
    )
    assert.equal(
        (await http.POST(request({ origin: "" }), "workspace-one")).status,
        403
    )
    assert.equal(
        (
            await http.POST(
                request({ "sec-fetch-site": "cross-site" }),
                "workspace-one"
            )
        ).status,
        403
    )
    signedIn = false
    assert.equal((await http.POST(request(), "workspace-one")).status, 401)
    assert.deepEqual(calls, [])
    signedIn = true
    assert.equal((await http.POST(request(), "workspace-one")).status, 200)
    assert.deepEqual(calls, [["sid-one", "workspace-one", input]])
    assert.equal(
        (
            await http.GET(
                new Request(`${origin}/?applicationRecordId=app-one`),
                "workspace-one"
            )
        ).status,
        200
    )
    assert.deepEqual(calls[1], ["sid-one", "workspace-one", "app-one"])
})
