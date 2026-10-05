import assert from "node:assert/strict"
import test from "node:test"

import { discordCommandsRoutes } from "./discord-commands-route"

const ORIGIN = "https://logi.example"
type Access = { guildId: string }

function setup(options: { admin?: boolean } = {}) {
    const calls: Array<[string, unknown]> = []
    const routes = discordCommandsRoutes<Access>({
        isWriteOrigin: (request) => request.headers.get("origin") === ORIGIN,
        access: async () =>
            options.admin === false ? null : { guildId: "100000000000000000" },
        registration: async (access) => {
            calls.push(["registration", access.guildId])
            return { registeredAt: 1, commandCount: 8 }
        },
        save: async (_access, input) => {
            calls.push(["save", input])
        },
        reregister: async () => {
            calls.push(["reregister", null])
            return { requestedAt: 5 }
        },
        convertLegacy: async () => {
            calls.push(["convert", null])
            return { converted: 2, alreadyThere: 0, skipped: 1, failed: 0 }
        },
    })
    const post = (body: unknown, origin: string | null = ORIGIN) =>
        routes.POST(
            new Request(`${ORIGIN}/api/servers/s/discord-commands`, {
                method: "POST",
                headers: {
                    "content-type": "application/json",
                    ...(origin ? { origin } : {}),
                },
                body: typeof body === "string" ? body : JSON.stringify(body),
            }),
            { serverId: "s" }
        )
    return { routes, calls, post }
}

const validSave = {
    action: "save",
    commandSettings: {
        player: { audience: "clanMembers", roleIds: ["100000000000000005"] },
    },
    statsSettings: {
        enabled: true,
        games: { hell_let_loose: true, wardogs: false },
    },
}

test("a clan admin saves the page, re-registers and converts old servers", async () => {
    const f = setup()
    assert.equal((await f.post(validSave)).status, 200)
    const reregister = await f.post({ action: "reregister" })
    assert.deepEqual(await reregister.json(), { requestedAt: 5 })
    const convert = await f.post({ action: "convertLegacy" })
    assert.deepEqual(await convert.json(), {
        converted: 2,
        alreadyThere: 0,
        skipped: 1,
        failed: 0,
    })
    assert.deepEqual(
        f.calls.map(([name]) => name),
        ["save", "reregister", "convert"]
    )
    assert.equal(convert.headers.get("cache-control"), "no-store")
})

test("writes from another origin or by a non-admin are refused before anything runs", async () => {
    const foreign = setup()
    assert.equal(
        (await foreign.post(validSave, "https://evil.test")).status,
        403
    )
    assert.equal((await foreign.post(validSave, null)).status, 403)
    const member = setup({ admin: false })
    assert.equal((await member.post(validSave)).status, 403)
    assert.equal(
        (await member.routes.GET(new Request(ORIGIN), { serverId: "s" }))
            .status,
        403
    )
    assert.deepEqual([...foreign.calls, ...member.calls], [])
})

test("invalid bodies are rejected: unknown actions, foreign fields, broken settings", async () => {
    const f = setup()
    for (const body of [
        "{not json",
        { action: "deploy" },
        { action: "reregister", force: true },
        { ...validSave, commandSettings: { stats: { enabled: false } } },
        { ...validSave, commandSettings: { help: { channelIds: ["#x"] } } },
        { ...validSave, statsSettings: { enabled: true } },
    ])
        assert.equal((await f.post(body)).status, 400, JSON.stringify(body))
    assert.equal(
        (await f.post({ action: "save", padding: "x".repeat(20_000) })).status,
        400
    )
    assert.deepEqual(f.calls, [])
})

test("GET returns the registration status for the card", async () => {
    const f = setup()
    const response = await f.routes.GET(new Request(ORIGIN), { serverId: "s" })
    assert.deepEqual(await response.json(), {
        registeredAt: 1,
        commandCount: 8,
    })
})
