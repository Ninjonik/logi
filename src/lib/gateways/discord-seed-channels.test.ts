import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

import {
    createSeedRole,
    SeedRolePermissionError,
    verifySeedChannels,
} from "./discord-seed-channels"

const GUILD = "100000000000000000"
const BOT = "100000000000000009"
const BOT_ROLE = "100000000000000010"
const SEED_CHANNEL = "111111111111111111"
const CONTROL_CHANNEL = "222222222222222222"
const ROLE = "333333333333333333"
const VIEW = 1 << 10
const PUBLISH = String(VIEW | (1 << 11) | (1 << 14) | (1 << 15) | (1 << 16))
const MANAGE_ROLES = String(BigInt(PUBLISH) | (BigInt(1) << BigInt(28)))

const settings = {
    seedChannelId: SEED_CHANNEL,
    controlChannelId: CONTROL_CHANNEL,
    seedRoleId: ROLE,
    roleSelfService: true,
}

function discord(
    t: TestContext,
    overrides: Record<string, { status: number; body?: unknown }> = {}
) {
    const previous = process.env.DISCORD_BOT_TOKEN
    process.env.DISCORD_BOT_TOKEN = "placeholder-token"
    t.after(() => {
        if (previous === undefined) delete process.env.DISCORD_BOT_TOKEN
        else process.env.DISCORD_BOT_TOKEN = previous
    })
    const routes: Record<string, { status: number; body?: unknown }> = {
        "/users/@me": { status: 200, body: { id: BOT } },
        [`/guilds/${GUILD}/roles`]: {
            status: 200,
            body: [
                {
                    id: GUILD,
                    permissions: String(VIEW),
                    position: 0,
                    mentionable: false,
                    managed: false,
                },
                {
                    id: BOT_ROLE,
                    permissions: MANAGE_ROLES,
                    position: 5,
                    mentionable: false,
                    managed: true,
                },
                {
                    id: ROLE,
                    permissions: "0",
                    position: 2,
                    mentionable: true,
                    managed: false,
                },
            ],
        },
        [`/guilds/${GUILD}/members/${BOT}`]: {
            status: 200,
            body: { roles: [BOT_ROLE], communication_disabled_until: null },
        },
        [`/channels/${SEED_CHANNEL}`]: {
            status: 200,
            body: {
                id: SEED_CHANNEL,
                guild_id: GUILD,
                type: 0,
                permission_overwrites: [],
            },
        },
        [`/channels/${CONTROL_CHANNEL}`]: {
            status: 200,
            body: {
                id: CONTROL_CHANNEL,
                guild_id: GUILD,
                type: 0,
                permission_overwrites: [
                    { id: GUILD, type: 0, allow: "0", deny: String(VIEW) },
                    { id: BOT_ROLE, type: 0, allow: String(VIEW), deny: "0" },
                ],
            },
        },
        ...overrides,
    }
    const requested: string[] = []
    t.mock.method(
        globalThis,
        "fetch",
        async (input: string | URL, init?: RequestInit) => {
            const path = String(input).replace(
                "https://discord.com/api/v10",
                ""
            )
            requested.push(path)
            assert.equal(
                new Headers(init?.headers).get("authorization"),
                "Bot placeholder-token"
            )
            const route = routes[path]
            if (!route) throw new Error(`unexpected ${path}`)
            return new Response(JSON.stringify(route.body ?? {}), {
                status: route.status,
            })
        }
    )
    return requested
}

test("the board's channels pass: #seed can ping @Seed, #spravci is private", async (t) => {
    discord(t)
    assert.deepEqual(await verifySeedChannels(GUILD, settings), {
        seedChannel: { canPublish: true, canMentionRole: true },
        controlChannel: { canPublish: true, private: true },
        role: { exists: true, canManage: true },
        problems: [],
    })
})

test("a deleted, foreign or voice channel cannot carry a message", async (t) => {
    discord(t, {
        [`/channels/${SEED_CHANNEL}`]: { status: 404 },
        [`/channels/${CONTROL_CHANNEL}`]: {
            status: 200,
            body: {
                id: CONTROL_CHANNEL,
                guild_id: "100000000000000099",
                type: 0,
                permission_overwrites: [],
            },
        },
    })
    const report = await verifySeedChannels(GUILD, settings)
    assert.equal(report.seedChannel?.canPublish, false)
    assert.equal(report.controlChannel?.canPublish, false)
    assert.ok(report.problems.includes("seed_channel_unpublishable"))
    assert.ok(report.problems.includes("control_channel_unpublishable"))
})

test("a timed-out bot can publish nowhere", async (t) => {
    discord(t, {
        [`/guilds/${GUILD}/members/${BOT}`]: {
            status: 200,
            body: {
                roles: [BOT_ROLE],
                communication_disabled_until: "2999-01-01T00:00:00.000Z",
            },
        },
    })
    const report = await verifySeedChannels(GUILD, settings)
    assert.deepEqual(report.problems.sort(), [
        "control_channel_unpublishable",
        "seed_channel_unpublishable",
    ])
})

test("Discord outages and a missing token fail instead of passing silently", async (t) => {
    discord(t, { [`/guilds/${GUILD}/roles`]: { status: 500 } })
    await assert.rejects(verifySeedChannels(GUILD, settings), /unavailable/)
    delete process.env.DISCORD_BOT_TOKEN
    await assert.rejects(verifySeedChannels(GUILD, settings), /not configured/)
})

test("unset channels are not fetched", async (t) => {
    const requested = discord(t)
    const report = await verifySeedChannels(GUILD, {
        seedChannelId: null,
        controlChannelId: null,
        seedRoleId: null,
        roleSelfService: false,
    })
    assert.deepEqual(report.problems, [])
    assert.equal(
        requested.some((path) => path.startsWith("/channels/")),
        false
    )
})

test("Vytvořit roli Seed makes a mentionable role without permissions, or reuses one (P5-22)", async (t) => {
    const previous = process.env.DISCORD_BOT_TOKEN
    process.env.DISCORD_BOT_TOKEN = "placeholder-token"
    t.after(() => {
        if (previous === undefined) delete process.env.DISCORD_BOT_TOKEN
        else process.env.DISCORD_BOT_TOKEN = previous
    })
    let existing: Array<Record<string, unknown>> = [
        {
            id: GUILD,
            name: "@everyone",
            permissions: String(VIEW),
            position: 0,
            mentionable: false,
            managed: false,
        },
    ]
    let refuse = false
    const posted: unknown[] = []
    t.mock.method(
        globalThis,
        "fetch",
        async (input: string | URL, init?: RequestInit) => {
            const path = String(input).replace(
                "https://discord.com/api/v10",
                ""
            )
            assert.equal(path, `/guilds/${GUILD}/roles`)
            if (init?.method === "POST") {
                if (refuse) return new Response("{}", { status: 403 })
                const body = JSON.parse(String(init.body)) as unknown
                posted.push(body)
                return new Response(
                    JSON.stringify({ id: ROLE, name: "Seed" }),
                    { status: 200 }
                )
            }
            return new Response(JSON.stringify(existing), { status: 200 })
        }
    )
    assert.deepEqual(await createSeedRole(GUILD), {
        id: ROLE,
        name: "Seed",
        created: true,
    })
    assert.deepEqual(posted, [
        { name: "Seed", permissions: "0", mentionable: true, hoist: false },
    ])
    existing = [
        ...existing,
        {
            id: "444444444444444444",
            name: "seed",
            permissions: "0",
            position: 1,
            mentionable: true,
            managed: false,
        },
    ]
    assert.deepEqual(await createSeedRole(GUILD), {
        id: "444444444444444444",
        name: "seed",
        created: false,
    })
    assert.equal(posted.length, 1, "a second click reuses the role")
    existing = existing.slice(0, 1)
    refuse = true
    await assert.rejects(createSeedRole(GUILD), SeedRolePermissionError)
})
