import assert from "node:assert/strict"
import test from "node:test"

import {
    discordPanelsRoutes,
    type DiscordPanelsRoutePorts,
} from "./discord-panels-route"

type Access = { guildId: string }
const channelId = "123456789012345678"

function routes(overrides: Partial<DiscordPanelsRoutePorts<Access>> = {}) {
    const calls: Array<[string, unknown]> = []
    const ports: DiscordPanelsRoutePorts<Access> = {
        isWriteOrigin: (request) =>
            request.headers.get("origin") === "https://logi.app",
        access: async (serverId) =>
            serverId === "guilds:1" ? { guildId: "100000000000000099" } : null,
        read: async () => ({ panels: [] }),
        save: async (_access, input) => {
            calls.push(["save", input])
            return { status: "saved", id: "p1", revision: 2, sent: input.send }
        },
        act: async (_access, input) => {
            calls.push(["act", input])
            return { status: "accepted", action: input.action, requestedAt: 5 }
        },
        test: async (_access, input) => {
            calls.push(["test", input])
            return { status: "ok", summary: {} }
        },
        checkChannel: async (_access, id) => {
            calls.push(["channel", id])
            return { everyoneCanView: false }
        },
        saveServer: async (_access, input) => {
            calls.push(["server", input])
            return { status: "saved", slug: "vlci-1", joinUrl: null }
        },
        leaguePreview: async (_access, count) => {
            calls.push(["league", count])
            return { standings: null, fixtures: null }
        },
        refreshControl: async (_access, connectionId) => {
            calls.push(["control", connectionId])
            return connectionId === "hll-1"
                ? { status: "accepted" }
                : { status: "not_found" }
        },
        renderPreviewImage: async (input) => {
            calls.push(["image", input.kind])
            return new Uint8Array([137, 80, 78, 71])
        },
        ...overrides,
    }
    return { handlers: discordPanelsRoutes(ports), calls }
}

const request = (body: unknown, origin = "https://logi.app", method = "POST") =>
    new Request("https://logi.app/api/servers/guilds:1/discord-panels", {
        method,
        headers: { origin, "content-type": "application/json" },
        body: typeof body === "string" ? body : JSON.stringify(body),
    })
const params = { serverId: "guilds:1" }

test("reads need clan admin access", async () => {
    const { handlers } = routes()
    assert.equal(
        (await handlers.GET(new Request("https://x"), { serverId: "guilds:2" }))
            .status,
        403
    )
    const ok = await handlers.GET(new Request("https://x"), params)
    assert.equal(ok.status, 200)
    assert.equal(ok.headers.get("cache-control"), "no-store")
})

test("writes from another origin are refused before the body is read", async () => {
    const { handlers, calls } = routes()
    const response = await handlers.POST(
        request(
            { settings: { kind: "calendar", channelId } },
            "https://evil.example"
        ),
        params
    )
    assert.equal(response.status, 403)
    assert.equal(calls.length, 0)
})

test("saving validates the panel settings and maps refusals to statuses", async () => {
    const { handlers, calls } = routes()
    const saved = await handlers.POST(
        request({ settings: { kind: "calendar", channelId }, send: true }),
        params
    )
    assert.equal(saved.status, 200)
    assert.deepEqual(await saved.json(), {
        status: "saved",
        id: "p1",
        revision: 2,
        sent: true,
    })
    assert.equal(calls.length, 1)
    const invalid = await handlers.POST(
        request({ settings: { kind: "server", channelId } }),
        params
    )
    assert.equal(invalid.status, 400)
    const body = (await invalid.json()) as { error: string; issues: unknown[] }
    assert.equal(body.error, "invalid_settings")
    assert.ok(body.issues.length > 0)
    assert.equal(
        (await handlers.POST(request("{not json"), params)).status,
        400
    )
    assert.equal(
        (await handlers.POST(request({ settings: {}, extra: true }), params))
            .status,
        400
    )
    const conflict = routes({
        save: async () => ({ status: "invalid", reason: "conflict" }),
    })
    assert.equal(
        (
            await conflict.handlers.POST(
                request({ settings: { kind: "calendar", channelId } }),
                params
            )
        ).status,
        409
    )
})

test("actions are accepted with 202, refused with their reason", async () => {
    const { handlers } = routes()
    const accepted = await handlers.action(request({ action: "refresh" }), {
        ...params,
        panelId: "p1",
    })
    assert.equal(accepted.status, 202)
    assert.equal(
        (
            await handlers.action(request({ action: "explode" }), {
                ...params,
                panelId: "p1",
            })
        ).status,
        400
    )
    assert.equal(
        (
            await handlers.action(request({ action: "refresh" }), {
                ...params,
                panelId: "../x",
            })
        ).status,
        404
    )
    const rejected = routes({
        act: async () => ({ status: "rejected", reason: "not_sent" }),
    })
    const response = await rejected.handlers.action(
        request({ action: "refresh" }),
        { ...params, panelId: "p1" }
    )
    assert.equal(response.status, 409)
    assert.deepEqual(await response.json(), { error: "not_sent" })
})

test("the test fetch, channel check and server details validate their input", async () => {
    const { handlers, calls } = routes()
    assert.equal(
        (
            await handlers.testFetch(
                request({ connectionId: "gameDataConnections:1" }),
                params
            )
        ).status,
        200
    )
    assert.equal(
        (await handlers.channelCheck(request({ channelId: "general" }), params))
            .status,
        400
    )
    assert.equal(
        (await handlers.channelCheck(request({ channelId }), params)).status,
        200
    )
    const serverParams = { ...params, connectionId: "gameDataConnections:1" }
    assert.equal(
        (
            await handlers.server(
                request({ address: "not an address" }, undefined, "PUT"),
                serverParams
            )
        ).status,
        400
    )
    assert.equal(
        (
            await handlers.server(
                request({ password: "a\u0000b" }, undefined, "PUT"),
                serverParams
            )
        ).status,
        400
    )
    const saved = await handlers.server(
        request(
            { address: "203.0.113.24:7777", password: "tajne123" },
            undefined,
            "PUT"
        ),
        serverParams
    )
    assert.equal(saved.status, 200)
    assert.doesNotMatch(JSON.stringify(await saved.json()), /tajne123/)
    assert.deepEqual(calls.at(-1), [
        "server",
        {
            connectionId: "gameDataConnections:1",
            address: "203.0.113.24:7777",
            password: "tajne123",
        },
    ])
    const noKey = routes({
        saveServer: async () => ({ status: "encryption_unavailable" }),
    })
    assert.equal(
        (
            await noKey.handlers.server(
                request({ password: "tajne123" }, undefined, "PUT"),
                serverParams
            )
        ).status,
        503
    )
})

test("backend failures are a plain 503 without internal details", async () => {
    const { handlers } = routes({
        read: async () => {
            throw new Error("Convex: secret mismatch at deployment xyz")
        },
    })
    const response = await handlers.GET(new Request("https://x"), params)
    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: "unavailable" })
})

test("the League preview reads 1 to 10 fixtures for clan admins", async () => {
    const { handlers, calls } = routes()
    const url = (count: string) =>
        new Request(
            `https://logi.app/api/servers/guilds:1/discord-panels/league-preview?count=${count}`
        )
    assert.equal((await handlers.leaguePreview(url("6"), params)).status, 200)
    assert.deepEqual(calls.at(-1), ["league", 6])
    assert.equal((await handlers.leaguePreview(url("0"), params)).status, 400)
    assert.equal((await handlers.leaguePreview(url("11"), params)).status, 400)
    assert.equal(
        (await handlers.leaguePreview(url("6"), { serverId: "guilds:2" }))
            .status,
        403
    )
})

test("a control message refresh needs the dashboard origin and a known server", async () => {
    const { handlers, calls } = routes()
    const refused = await handlers.control(
        request({ action: "refresh" }, "https://evil.example"),
        { ...params, connectionId: "hll-1" }
    )
    assert.equal(refused.status, 403)
    assert.equal(calls.length, 0)
    const accepted = await handlers.control(request({ action: "refresh" }), {
        ...params,
        connectionId: "hll-1",
    })
    assert.equal(accepted.status, 202)
    const unknown = await handlers.control(request({ action: "refresh" }), {
        ...params,
        connectionId: "hll-9",
    })
    assert.equal(unknown.status, 404)
    const invalid = await handlers.control(request({ action: "pause" }), {
        ...params,
        connectionId: "hll-1",
    })
    assert.equal(invalid.status, 400)
})

test("preview images render only validated models over built-in art", async () => {
    const { handlers, calls } = routes()
    const model = {
        version: 1,
        language: "cs",
        accentColor: "#e8a33d",
        clanTag: "VLK",
        clanName: "Vlci",
        subtitle: "Vlci #1 · Public · Hell Let Loose",
        background: {
            kind: "builtin",
            game: "hell_let_loose",
            mapKey: "foy",
        },
    }
    const ok = await handlers.previewImage(
        request({ kind: "banner", model }),
        params
    )
    assert.equal(ok.status, 200)
    assert.equal(ok.headers.get("content-type"), "image/png")
    assert.deepEqual(calls.at(-1), ["image", "banner"])
    const asset = await handlers.previewImage(
        request({
            kind: "banner",
            model: {
                ...model,
                background: { kind: "asset", publicId: "abc", crop: "center" },
            },
        }),
        params
    )
    assert.equal(asset.status, 400)
    const foreign = await handlers.previewImage(
        request({ kind: "banner", model }, "https://evil.example"),
        params
    )
    assert.equal(foreign.status, 403)
})
