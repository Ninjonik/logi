import assert from "node:assert/strict"
import test from "node:test"

import {
    matchTeamRefreshHandler,
    type MatchTeamRefreshPorts,
} from "./match-team-refresh-route"

const origin = "https://logi.invalid"
const params = { serverId: "guilds:one", eventId: "events:one" }
const assignment = {
    teamId: "teamDirectory:alpha",
    slot: "a",
    side: "Allies",
    snapshot: {
        name: "Alpha Prime",
        shortCode: "APX",
        logoAssetId: "imageAssets:b",
        logoUrl: "https://logi.test/api/image-assets/b.png",
        teamRevision: 2,
        capturedAt: "2026-10-04T10:00:00.000Z",
    },
}

function fixture(result: unknown = { ok: true, matchTeams: [assignment] }) {
    const calls: unknown[] = []
    const revalidated: unknown[] = []
    const ports: MatchTeamRefreshPorts = {
        access: async (serverId) => {
            calls.push({ access: serverId })
            return {
                serverRecordId: "guilds:record",
                guildId: "910000000000000001",
                actor: "123456789",
            }
        },
        rateLimit: async (bucket) => {
            calls.push({ rateLimit: bucket })
            return { allowed: true, retryAfterSeconds: 0 }
        },
        refresh: async (input) => {
            calls.push(input)
            if (result instanceof Error) throw result
            return result
        },
        revalidate: (...args) => revalidated.push(args),
    }
    const request = (
        body: unknown = { action: "refresh", teamId: assignment.teamId },
        headers: HeadersInit = { origin }
    ) =>
        new Request(
            `${origin}/api/servers/guilds:one/events/events:one/match-teams`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json", ...headers },
                body: typeof body === "string" ? body : JSON.stringify(body),
            }
        )
    return {
        calls,
        ports,
        revalidated,
        request,
        post: (req: Request) => matchTeamRefreshHandler(ports)(req, params),
    }
}

test("refresh forwards the admin's server record, event, team and actor and returns the stored assignments", async () => {
    const f = fixture()
    const response = await f.post(f.request())
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.deepEqual(await response.json(), {
        ok: true,
        matchTeams: [assignment],
    })
    assert.deepEqual(f.calls, [
        { access: "guilds:one" },
        { rateLimit: "teams:910000000000000001:123456789" },
        {
            serverRecordId: "guilds:record",
            eventId: "events:one",
            teamId: assignment.teamId,
            actor: "123456789",
        },
    ])
    assert.deepEqual(f.revalidated, [["guilds:one", "events:one"]])
})

test("refresh rejects cross-origin, non-admin and malformed requests before Convex", async () => {
    const crossOrigin: HeadersInit[] = [
        { origin: "https://foreign.invalid" },
        {},
    ]
    for (const headers of crossOrigin) {
        const f = fixture()
        const response = await f.post(f.request(undefined, headers))
        assert.equal(response.status, 403)
        assert.deepEqual(f.calls, [])
    }
    const denied = fixture()
    denied.ports.access = async () => null
    assert.deepEqual(await (await denied.post(denied.request())).json(), {
        error: "forbidden",
    })
    for (const body of [
        { action: "replace", teamId: assignment.teamId },
        { action: "refresh" },
        { action: "refresh", teamId: "" },
        { action: "refresh", teamId: assignment.teamId, snapshot: {} },
        "not json",
        { action: "refresh", teamId: "x".repeat(5000) },
    ]) {
        const f = fixture()
        const response = await f.post(f.request(body))
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error: "invalid_request" })
        assert.equal(
            f.calls.length,
            2,
            "only access and the rate limit were consulted"
        )
    }
})

test("team rule violations are 400 codes; unknown outcomes and malformed results are 503", async () => {
    for (const code of [
        "invalid_match_teams",
        "team_not_found",
        "team_archived",
        "team_game_mismatch",
        "match_concluded",
        "training_event",
    ]) {
        const f = fixture({ error: code })
        const response = await f.post(f.request())
        assert.equal(response.status, 400)
        assert.deepEqual(await response.json(), { error: code })
        assert.deepEqual(f.revalidated, [])
    }
    for (const result of [
        new Error("Event not found."),
        { error: "Unauthorized." },
        { ok: true },
        { ok: true, matchTeams: [{ ...assignment, slot: "d" }] },
        null,
    ]) {
        const f = fixture(result)
        const response = await f.post(f.request())
        assert.equal(response.status, 503)
        assert.deepEqual(await response.json(), { error: "unavailable" })
        assert.deepEqual(f.revalidated, [])
    }
})

test("a limited actor gets 429 with Retry-After before the body is read or Convex is called", async () => {
    const f = fixture()
    f.ports.rateLimit = async (bucket) => {
        f.calls.push({ rateLimit: bucket })
        return { allowed: false, retryAfterSeconds: 12.2 }
    }
    const response = await f.post(f.request())
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("retry-after"), "13")
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.deepEqual(await response.json(), { error: "rate_limited" })
    assert.deepEqual(f.calls, [
        { access: "guilds:one" },
        { rateLimit: "teams:910000000000000001:123456789" },
    ])
    assert.deepEqual(f.revalidated, [])
})
