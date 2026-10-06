import assert from "node:assert/strict"
import test from "node:test"

import type { SeedActionResult } from "@/application/discord-seed/action-result"
import { boardSeedSettings } from "@/infrastructure/testing/in-memory-seed"
import type { SeedChannelReport } from "@/domain/discord-seed/channels"

import {
    discordSeedRoutes,
    type DiscordSeedRoutePorts,
} from "./discord-seed-route"

const origin = "https://logi.invalid"
const base = "http://127.0.0.1:3000/api/servers/guilds:one/discord-seed"
const params = {
    serverId: "guilds:one",
    connectionId: "gameDataConnections:vlci1",
}
const NOW = Date.parse("2026-10-10T19:05:00.000Z")
type Access = { guildId: string; actor: string }

const okChannels: SeedChannelReport = {
    seedChannel: { canPublish: true, canMentionRole: true },
    controlChannel: { canPublish: true, private: true },
    role: { exists: true, canManage: true },
    problems: [],
}

function fixture(
    overrides: Partial<DiscordSeedRoutePorts<Access>> = {},
    admin = true
) {
    const calls: unknown[] = []
    const ports: DiscordSeedRoutePorts<Access> = {
        isWriteOrigin: (request) => request.headers.get("origin") === origin,
        access: async (serverId) => {
            calls.push({ access: serverId })
            return admin
                ? { guildId: "910000000000000001", actor: "admin" }
                : null
        },
        read: async (access, connectionId) => {
            calls.push({ read: connectionId })
            return { servers: [], selected: null }
        },
        save: async (access, input) => {
            calls.push({ save: input })
            return { status: "saved", revision: 2 }
        },
        verifyChannels: async () => okChannels,
        start: async (access, input) => {
            calls.push({ start: input })
            return {
                status: "started",
                runId: "run-1",
                startedAt: new Date(NOW).toISOString(),
                channelId: "111111111111111111",
                pinged: true,
            }
        },
        stop: async (access, input) => {
            calls.push({ stop: input })
            return { status: "stopped", runId: "run-1" }
        },
        createRole: async (access) => {
            calls.push({ createRole: access.guildId })
            return { id: "333333333333333333", name: "Seed", created: true }
        },
        now: () => NOW,
        ...overrides,
    }
    const routes = discordSeedRoutes(ports)
    const request = (
        method: string,
        body?: unknown,
        headers: HeadersInit = { origin },
        url = `${base}/${params.connectionId}`
    ) =>
        new Request(url, {
            method,
            headers: { "content-type": "application/json", ...headers },
            body: body === undefined ? undefined : JSON.stringify(body),
        })
    return { routes, calls, request }
}
const planBody = (settings: unknown = boardSeedSettings()) => ({
    expectedRevision: 1,
    settings,
})

test("reading the page needs a clan admin and passes the selected server", async () => {
    const { routes, calls, request } = fixture()
    const response = await routes.GET(
        request(
            "GET",
            undefined,
            {},
            `${base}?server=gameDataConnections:vlci1`
        ),
        params
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "no-store")
    assert.deepEqual(calls.at(-1), { read: "gameDataConnections:vlci1" })
    const denied = fixture({}, false)
    assert.equal(
        (await denied.routes.GET(denied.request("GET"), params)).status,
        403
    )
    assert.equal(
        (
            await routes.GET(
                request("GET", undefined, {}, `${base}?server=../../x`),
                params
            )
        ).status,
        400
    )
})

test("writes from another origin or a non-admin are refused before the body is read", async () => {
    for (const method of ["PUT", "POST"] as const) {
        const foreign = fixture()
        const handler =
            method === "PUT" ? foreign.routes.PUT : foreign.routes.POST
        const response = await handler(
            foreign.request(method, planBody(), {
                origin: "https://evil.invalid",
            }),
            params
        )
        assert.equal(response.status, 403)
        assert.deepEqual(foreign.calls, [], "no admin lookup, no body read")
        const notAdmin = fixture({}, false)
        assert.equal(
            (
                await (
                    method === "PUT"
                        ? notAdmin.routes.PUT
                        : notAdmin.routes.POST
                )(notAdmin.request(method, { action: "stop" }), params)
            ).status,
            403
        )
    }
})

test("a valid plan is checked in Discord, then saved with its revision", async () => {
    const { routes, calls, request } = fixture()
    const response = await routes.PUT(request("PUT", planBody()), params)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
        revision: 2,
        channels: okChannels,
    })
    const save = calls.find(
        (call): call is { save: { expectedRevision: number } } =>
            typeof call === "object" && call !== null && "save" in call
    )
    assert.equal(save?.save.expectedRevision, 1)
})

test("verifyOnly reports the channel checks without saving", async () => {
    const { routes, calls, request } = fixture()
    const response = await routes.PUT(
        request("PUT", { ...planBody(), verifyOnly: true }),
        params
    )
    assert.deepEqual(await response.json(), { channels: okChannels })
    assert.equal(
        calls.some(
            (call) =>
                typeof call === "object" && call !== null && "save" in call
        ),
        false
    )
})

test("verifyOnly checks only the channels and role of an unfinished plan", async () => {
    const checked: unknown[] = []
    const { routes, request } = fixture({
        verifyChannels: async (access, settings) => {
            checked.push(settings)
            return okChannels
        },
    })
    const unfinished = { ...boardSeedSettings(), liveFrom: 1, startBelow: 90 }
    const response = await routes.PUT(
        request("PUT", { ...planBody(unfinished), verifyOnly: true }),
        params
    )
    assert.equal(response.status, 200)
    assert.deepEqual(checked, [
        {
            seedChannelId: unfinished.seedChannelId,
            controlChannelId: unfinished.controlChannelId,
            seedRoleId: unfinished.seedRoleId,
            roleSelfService: unfinished.roleSelfService,
        },
    ])
    const badChannel = await routes.PUT(
        request("PUT", {
            ...planBody({ ...unfinished, controlChannelId: "#spravci" }),
            verifyOnly: true,
        }),
        params
    )
    assert.equal(badChannel.status, 400)
    const outage = fixture({
        verifyChannels: async () => {
            throw new Error("discord down")
        },
    })
    const down = await outage.routes.PUT(
        outage.request("PUT", { ...planBody(), verifyOnly: true }),
        params
    )
    assert.equal(down.status, 503)
    assert.deepEqual(await down.json(), { error: "verification_unavailable" })
})

test("invalid bodies and plans are refused with codes", async () => {
    const { routes, request } = fixture()
    assert.equal(
        (await routes.PUT(request("PUT", { settings: {} }), params)).status,
        400
    )
    const plan = await routes.PUT(
        request("PUT", planBody(boardSeedSettings({ startBelow: 45 }))),
        params
    )
    assert.equal(plan.status, 400)
    assert.deepEqual(await plan.json(), {
        error: "invalid_plan",
        issues: [{ path: "startBelow", code: "start_below_not_under_live" }],
    })
    const oversized = await routes.PUT(
        request("PUT", { ...planBody(), padding: "x".repeat(9000) }),
        params
    )
    assert.equal(oversized.status, 400)
    assert.equal(
        (
            await routes.PUT(request("PUT", planBody()), {
                ...params,
                connectionId: "a/b",
            })
        ).status,
        404
    )
})

test("channel problems block the save; Discord outages answer 503", async () => {
    const problems = fixture({
        verifyChannels: async () => ({
            ...okChannels,
            controlChannel: { canPublish: true, private: false },
            problems: ["control_channel_public"],
        }),
    })
    const blocked = await problems.routes.PUT(
        problems.request("PUT", planBody()),
        params
    )
    assert.equal(blocked.status, 400)
    assert.equal((await blocked.json()).error, "channels")
    const outage = fixture({
        verifyChannels: async () => {
            throw new Error("Discord down")
        },
    })
    assert.equal(
        (await outage.routes.PUT(outage.request("PUT", planBody()), params))
            .status,
        503
    )
})

test("save conflicts and unknown servers map to 409 and 404", async () => {
    const conflict = fixture({
        save: async () => ({ status: "conflict", revision: 3 }),
    })
    const response = await conflict.routes.PUT(
        conflict.request("PUT", planBody()),
        params
    )
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: "conflict", revision: 3 })
    const missing = fixture({ save: async () => ({ status: "not_found" }) })
    assert.equal(
        (await missing.routes.PUT(missing.request("PUT", planBody()), params))
            .status,
        404
    )
})

test("Seed teď and Ukončit seed are live actions with idempotent start keys", async () => {
    const { routes, calls, request } = fixture()
    const started = await routes.POST(
        request("POST", { action: "start", requestKey: "6f1c2b9e-0d4a" }),
        params
    )
    assert.equal(started.status, 200)
    assert.equal((await started.json()).status, "started")
    assert.deepEqual(calls.at(-1), {
        start: {
            connectionId: "gameDataConnections:vlci1",
            requestKey: "6f1c2b9e-0d4a",
        },
    })
    const stopped = await routes.POST(
        request("POST", { action: "stop" }),
        params
    )
    assert.deepEqual(await stopped.json(), {
        status: "stopped",
        runId: "run-1",
    })
    for (const body of [
        { action: "start" },
        { action: "start", requestKey: "short" },
        { action: "pause" },
        { action: "stop", extra: true },
    ])
        assert.equal(
            (await routes.POST(request("POST", body), params)).status,
            400,
            JSON.stringify(body)
        )
})

test("refusals keep their meaning: cooldown 429 with Retry-After, running and unavailable 409", async () => {
    const answer = (result: SeedActionResult) =>
        fixture({ start: async () => result })
    const cooldown = answer({
        status: "cooldown",
        retryAt: "2026-10-10T20:25:00.000Z",
    })
    const response = await cooldown.routes.POST(
        cooldown.request("POST", { action: "start", requestKey: "abcdefgh" }),
        params
    )
    assert.equal(response.status, 429)
    assert.equal(response.headers.get("retry-after"), String(80 * 60))
    for (const [result, status] of [
        [{ status: "running", runId: "run-1" }, 409],
        [{ status: "unavailable", reason: "already_live" }, 409],
        [{ status: "not_found" }, 404],
        [{ status: "duplicate", runId: "run-1" }, 200],
    ] as const) {
        const env = answer(result)
        assert.equal(
            (
                await env.routes.POST(
                    env.request("POST", {
                        action: "start",
                        requestKey: "abcdefgh",
                    }),
                    params
                )
            ).status,
            status
        )
    }
    const failing = fixture({
        stop: async () => {
            throw new Error("Convex unavailable")
        },
    })
    assert.equal(
        (
            await failing.routes.POST(
                failing.request("POST", { action: "stop" }),
                params
            )
        ).status,
        503
    )
})

test("Vytvořit roli Seed: dashboard origin and a clan admin only, then the role (P5-22)", async () => {
    const url = `${base}/role`
    const ok = fixture()
    const created = await ok.routes.ROLE(
        ok.request("POST", {}, { origin }, url),
        params
    )
    assert.equal(created.status, 201)
    assert.deepEqual(await created.json(), {
        role: { id: "333333333333333333", name: "Seed", created: true },
    })
    assert.deepEqual(ok.calls.at(-1), { createRole: "910000000000000001" })

    const foreign = fixture()
    assert.equal(
        (
            await foreign.routes.ROLE(
                foreign.request(
                    "POST",
                    {},
                    { origin: "https://evil.invalid" },
                    url
                ),
                params
            )
        ).status,
        403
    )
    assert.equal(foreign.calls.length, 0, "the origin is checked first")

    const member = fixture({}, false)
    assert.equal(
        (
            await member.routes.ROLE(
                member.request("POST", {}, { origin }, url),
                params
            )
        ).status,
        403
    )
    const odd = fixture()
    assert.equal(
        (
            await odd.routes.ROLE(
                odd.request("POST", { name: "Admin" }, { origin }, url),
                params
            )
        ).status,
        400
    )
    const reused = fixture({
        createRole: async () => ({
            id: "444444444444444444",
            name: "seed",
            created: false,
        }),
    })
    assert.equal(
        (
            await reused.routes.ROLE(
                reused.request("POST", {}, { origin }, url),
                params
            )
        ).status,
        200
    )
    const refused = fixture({
        createRole: async () => {
            throw new Error("missing_permission")
        },
    })
    const answer = await refused.routes.ROLE(
        refused.request("POST", {}, { origin }, url),
        params
    )
    assert.equal(answer.status, 409)
    assert.deepEqual(await answer.json(), { error: "role_permission" })
})
