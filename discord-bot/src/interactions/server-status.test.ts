import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

import {
    callerOf,
    configsOf,
    fakeInteraction,
    testGuildConfig,
    TEST_GUILD,
} from "../commands/fake-interaction"
import {
    handleServerStatusCommand,
    serverStatusInteractions,
    type ServerStatusPorts,
} from "./server-status"
import {
    invoke,
    testContext,
} from "../../../src/infrastructure/convex/testing/database"
import {
    createInteractionRegistry,
    type InteractionFeatureContext,
} from "./registry"
import type { CommandCaller } from "../../../src/domain/discord-commands/permissions"
import { listConnections } from "../../../convex/gameData"

const now = Date.parse("2026-09-29T12:00:00Z")
const SECRET = "dev-internal-auth-secret"
const ADMIN: CommandCaller = {
    isAdministrator: false,
    roleIds: ["100000000000000001"],
}
const MEMBER: CommandCaller = { isAdministrator: false, roleIds: [] }

function fixture(t: TestContext) {
    t.mock.method(Date, "now", () => now)
    const oldSources = process.env.LOGI_GAME_DATA_SOURCES
    process.env.LOGI_GAME_DATA_SOURCES = "[]"
    t.after(() => {
        if (oldSources === undefined) delete process.env.LOGI_GAME_DATA_SOURCES
        else process.env.LOGI_GAME_DATA_SOURCES = oldSources
    })
    const ctx = testContext()
    const seed = (id: string, gameId = "wardogs", tenant = TEST_GUILD) => {
        ctx.db.seed("gameDataConnections", {
            _id: `gameDataConnections:${id}`,
            sourceRef: `private-${id}`,
            guildId: tenant,
            gameId,
            provider: gameId === "wardogs" ? "wardogs_rcon" : "hll_crcon",
            enabled: true,
            errorCategory: null,
            lastAttemptAt: "2026-09-29T11:59:55Z",
            observation: {
                observedAt: "2026-09-29T11:59:50Z",
                providerUpdatedAt: null,
                displayName: id,
                state: "online",
                map: null,
                players: 0,
                capacity: 100,
                providerInstanceId: "private-instance-id",
                scores: [],
                capabilities: ["server_snapshot"],
            },
        })
        return ctx.db.tables.gameDataConnections.at(-1)!
    }
    const requests: unknown[] = []
    const ports = (
        overrides: Partial<ServerStatusPorts> = {}
    ): ServerStatusPorts => ({
        configs: configsOf(testGuildConfig()),
        readCaller: callerOf(ADMIN),
        connections: async (guildId) => {
            requests.push({ secret: SECRET, guildId })
            return invoke(listConnections, ctx, { secret: SECRET, guildId })
        },
        gameServersUrl: async (_guildId, language) =>
            `https://logi.example/${language}/dashboard/servers/guilds:a/settings/game-servers`,
        ...overrides,
    })
    async function run(
        options: { game?: string; guildId?: string | null } = {},
        overrides: Partial<ServerStatusPorts> = {}
    ) {
        const f = fakeInteraction<
            Parameters<typeof handleServerStatusCommand>[0]
        >({
            guildId:
                options.guildId === undefined ? TEST_GUILD : options.guildId,
            locale: "de",
            options: { getString: () => options.game ?? "wardogs" },
        })
        await handleServerStatusCommand(f.interaction, ports(overrides))
        const state = f.interaction as unknown as {
            deferred: boolean
            ephemeral: boolean
        }
        assert.equal(state.deferred, true, "acknowledged before any read")
        assert.equal(state.ephemeral, true, "always private")
        assert.ok(f.sent.length, "the command must answer")
        return { ...f, json: f.text() }
    }
    return { ctx, seed, run, requests }
}

test("reads only the invoking server and the chosen game, preserving zero (M3-21)", async (t) => {
    const f = fixture(t)
    f.seed("WDG test")
    f.seed("HLL hidden", "hell_let_loose")
    f.seed("Other guild hidden", "wardogs", "222222222222222222")
    const { json } = await f.run()
    assert.deepEqual(f.requests, [{ secret: SECRET, guildId: TEST_GUILD }])
    assert.match(json, /STAV HERNÍCH SERVERŮ · WARDOGS/)
    assert.match(json, /1 server klanu/)
    assert.match(json, /WDG test/)
    assert.match(json, /0 \/ 100 hráčů/)
    assert.match(json, /Herní servery v Logi/)
    assert.doesNotMatch(
        json,
        /HLL hidden|Other guild hidden|private-|gameDataConnections/
    )
    assert.match(json, /"allowedMentions":\{"parse":\[\]\}/)
})

test("a member without the manager group is refused freshly, before any stored read (M3-25, M3-B04)", async (t) => {
    const f = fixture(t)
    f.seed("WDG test")
    const { json } = await f.run(
        {},
        {
            readCaller: callerOf(MEMBER),
            configs: configsOf({
                ...testGuildConfig(),
                liveScoreChannelIds: { wardogs: "300000000000000009" },
            }),
        }
    )
    assert.deepEqual(f.requests, [])
    assert.match(json, /Stav serverů vidí jen správci Logi/)
    assert.match(json, /oprávnění Administrator nebo Roli správců/)
    assert.match(json, /Živé skóre najdeš v <#300000000000000009>\./)
})

test("an extra role from the Příkazy page admits the member; the cache is never trusted", async (t) => {
    const f = fixture(t)
    f.seed("WDG test")
    let reads = 0
    const { json } = await f.run(
        {},
        {
            readCaller: async () => {
                reads++
                return {
                    isAdministrator: false,
                    roleIds: ["100000000000000009"],
                }
            },
            configs: configsOf(
                testGuildConfig({
                    commandSettings: {
                        serverStatus: { roleIds: ["100000000000000009"] },
                    },
                })
            ),
        }
    )
    assert.equal(reads, 1)
    assert.match(json, /WDG test/)
})

test("Discord not answering the role read refuses rather than guessing", async (t) => {
    const f = fixture(t)
    const { json } = await f.run({}, { readCaller: callerOf(null) })
    assert.deepEqual(f.requests, [])
    assert.match(json, /Teď nejde ověřit tvoje role/)
})

test("rejects an unknown game before reading data", async (t) => {
    const f = fixture(t)
    const { json } = await f.run({ game: "all" })
    assert.deepEqual(f.requests, [])
    assert.match(json, /Stav serverů se teď nedá načíst/)
})

test("old values keep their last state, marked stale with their original observation time (M3-23)", async (t) => {
    const f = fixture(t)
    const row = f.seed("Stale test")
    row.observation.observedAt = "2026-09-29T11:55:00Z"
    row.observation.players = 42
    const { json } = await f.run()
    assert.match(json, /Online · zastaralé/)
    assert.doesNotMatch(json, /Bez dat/)
    assert.match(json, /42 \/ 100/)
    assert.match(json, /<t:1790682900:R>/)
})

test("data 25 minutes old still names the last state; a day later it is 'Bez dat' (M3-23)", async (t) => {
    const f = fixture(t)
    const recent = f.seed("Vlci #2 Trénink")
    recent.observation.observedAt = "2026-09-29T11:35:00Z"
    recent.observation.state = "offline"
    recent.observation.map = "Kaluga"
    const old = f.seed("Vlci #5")
    old.observation.observedAt = "2026-09-28T11:59:00Z"
    old.observation.map = "Stará mapa"
    const unknown = f.seed("Vlci #6")
    unknown.observation.observedAt = "2026-09-29T11:57:00Z"
    unknown.observation.state = "unknown"
    const { json } = await f.run()
    assert.match(json, /Vlci #2 Trénink\*\* · 🟡 \*\*Offline · zastaralé/)
    assert.match(json, /Kaluga/)
    assert.match(json, /Vlci #5\*\* · ⚪ \*\*Bez dat/)
    assert.doesNotMatch(json, /Stará mapa/)
    assert.match(json, /Vlci #6\*\* · 🟡 \*\*Zastaralé/)
})

test("the stored projection keeps 'unknown' for other readers and adds the last state (M3-23)", async (t) => {
    const f = fixture(t)
    const row = f.seed("Stale test")
    row.observation.observedAt = "2026-09-29T11:35:00Z"
    const listed = (await invoke(listConnections, f.ctx, {
        secret: SECRET,
        guildId: TEST_GUILD,
    })) as {
        connections: Array<{
            snapshot: { state: string; freshness: string }
            lastState?: string | null
        }>
    }
    assert.equal(listed.connections[0]!.snapshot.state, "unknown")
    assert.equal(listed.connections[0]!.snapshot.freshness, "unavailable")
    assert.equal(listed.connections[0]!.lastState, "online")
})

test("disabled collection, no observation and known offline stay distinct", async (t) => {
    const f = fixture(t)
    f.seed("Disabled").enabled = false
    f.seed("Never observed").observation = null
    f.seed("Known offline").observation.state = "offline"
    const { json } = await f.run()
    assert.match(json, /Sběr vypnutý/)
    assert.match(json, /Bez dat/)
    assert.match(json, /Offline/)
    assert.doesNotMatch(json, /0 \/ 0/)
})

for (const [language, expected] of [
    ["cs", /Pro Wardogs klan nemá připojený žádný server/],
    ["en", /No Wardogs server/i],
    ["de", /Wardogs/],
] as const) {
    test(`no connection is explained in the clan language ${language}, never the member's (M3-B04)`, async (t) => {
        const f = fixture(t)
        const { json } = await f.run(
            {},
            {
                configs: configsOf(
                    testGuildConfig({ defaultLanguage: language })
                ),
            }
        )
        assert.match(json, expected)
        assert.match(json, new RegExp(`/${language}/dashboard/servers/`))
        assert.doesNotMatch(json, /0 \/ 0|Offline/)
    })
}

test("public-directory attribution stays; at most five servers; hostile text is bounded", async (t) => {
    const f = fixture(t)
    for (let i = 0; i < 7; i++) {
        const row = f.seed(`server-${i}`)
        row.provider = "wardogs_public_directory"
        row.observation.displayName = "@everyone\n" + "*".repeat(175)
        row.observation.map = "[fake](https://example.test) " + "x".repeat(150)
    }
    const { json } = await f.run()
    assert.match(json, /\[Wardog Servers\]\(https:\/\/wardogservers\.com\)/)
    assert.match(
        json,
        /Zobrazeno 5 ze 7 serverů\. Nejvýš 5, celý seznam je v Logi\./
    )
    assert.doesNotMatch(json, /\[fake\]\(https/)
    assert.ok(json.length < 8_000)
})

for (const failure of ["network", "malformed"] as const) {
    test(`${failure} is reported as unavailable without leaking raw errors`, async (t) => {
        const f = fixture(t)
        const { json } = await f.run(
            {},
            {
                connections: async () => {
                    if (failure === "network")
                        throw new Error("secret-provider-token@example.test")
                    return { connections: [{ snapshot: { players: 0 } }] }
                },
            }
        )
        assert.match(json, /Stav serverů se teď nedá načíst/)
        assert.doesNotMatch(json, /secret-provider|example\.test|0 \/ 0/)
    })
}

test("invisible provider labels get a readable fallback", async (t) => {
    const f = fixture(t)
    const row = f.seed("Invisible label")
    row.observation.displayName = "\n‮ "
    row.observation.map = "⁧\n"
    const { json } = await f.run()
    assert.match(json, /Herní server/)
})

test("/server-status is routed through the interaction registry", () => {
    const context: InteractionFeatureContext = {
        enqueueEventSync: () => {},
        triggerPollSoon: () => {},
    }
    const registry = createInteractionRegistry(
        [
            serverStatusInteractions(() => ({
                configs: configsOf(null),
                connections: async () => ({}),
                gameServersUrl: async () => undefined,
            })),
        ],
        context
    )
    assert.deepEqual(registry.routes(), ["command:server-status"])
})
