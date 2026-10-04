import {
    EmbedBuilder,
    MessageFlags,
    PermissionFlagsBits,
    PermissionsBitField,
    type ChatInputCommandInteraction,
    type Guild,
} from "discord.js"
import {
    invoke,
    testContext,
} from "../../../src/infrastructure/convex/testing/database"
import test, { afterEach, type TestContext } from "node:test"
import { listConnections } from "../../../convex/gameData"
import { createInteractionHandler } from "../interactions"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { closeConvexClient } from "../convex"
import assert from "node:assert/strict"

afterEach(closeConvexClient)
const now = Date.parse("2026-09-29T12:00:00Z")
const guildId = "111111111111111111"
const handlers = () =>
    createInteractionHandler({
        enqueueEventSync: () => {},
        triggerPollSoon: () => {},
    })
type Reply = {
    content?: string
    embeds?: EmbedBuilder[]
    allowedMentions?: { parse?: string[] }
}
function fixture(t: TestContext) {
    t.mock.method(Date, "now", () => now)
    const oldSources = process.env.LOGI_GAME_DATA_SOURCES
    process.env.LOGI_GAME_DATA_SOURCES = "[]"
    t.after(() => {
        if (oldSources === undefined) delete process.env.LOGI_GAME_DATA_SOURCES
        else process.env.LOGI_GAME_DATA_SOURCES = oldSources
    })
    const ctx = testContext()
    const seed = (id: string, gameId = "wardogs", tenant = guildId) => {
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
    let deferred = false
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (
            reference: Parameters<typeof getFunctionName>[0],
            args: Record<string, unknown>
        ) => {
            assert.equal(
                deferred,
                true,
                "Acknowledge before waiting for the backend"
            )
            requests.push(args)
            assert.equal(getFunctionName(reference), "gameData:listConnections")
            return invoke(listConnections, ctx, args)
        }
    )
    async function run(
        options: {
            locale?: string
            game?: string
            guild?: string | null
            manager?: boolean
        } = {}
    ) {
        let response: Reply | undefined
        let flags: unknown
        await handlers().handleChatInputCommand({
            commandName: "server-status",
            guildId: options.guild === undefined ? guildId : options.guild,
            locale: options.locale ?? "en-US",
            memberPermissions: new PermissionsBitField(
                options.manager === false
                    ? []
                    : [PermissionFlagsBits.ManageGuild]
            ),
            options: { getString: () => options.game ?? "wardogs" },
            deferReply: async (value: { flags: unknown }) => {
                flags = value.flags
                deferred = true
            },
            reply: async (value: Reply & { flags?: unknown }) => {
                flags = value.flags
                response = value
            },
            editReply: async (value: Reply) => {
                response = value
            },
        } as unknown as ChatInputCommandInteraction)
        assert.ok(response, "The command must answer")
        assert.equal(flags, MessageFlags.Ephemeral)
        return {
            response,
            json: JSON.stringify(response),
            embed: response.embeds?.[0]?.toJSON(),
        }
    }
    return { ctx, seed, run, requests }
}

test("actual server-status command reads only the invoking guild and selected game, preserving zero", async (t) => {
    const f = fixture(t)
    f.seed("WDG test")
    f.seed("HLL hidden", "hell_let_loose")
    f.seed("Other guild hidden", "wardogs", "222222222222222222")
    const { response, embed, json } = await f.run()
    assert.deepEqual(f.requests, [
        { secret: "dev-internal-auth-secret", guildId },
    ])
    assert.equal(embed?.fields?.length, 1)
    assert.match(json, /WDG test/)
    assert.match(json, /0 \/ 100/)
    assert.doesNotMatch(
        json,
        /HLL hidden|Other guild hidden|private-|gameDataConnections|111111111111111111/
    )
    assert.deepEqual(response.allowedMentions, { parse: [] })
})

for (const options of [{ manager: false }, { guild: null }]) {
    test(`server-status refuses ${options.manager === false ? "non-managers" : "DMs"} before reading stored data`, async (t) => {
        const f = fixture(t)
        const { response } = await f.run(options)
        assert.ok(response.content)
        assert.deepEqual(f.requests, [])
    })
}

test("server-status rejects unrecognized game input before reading data", async (t) => {
    const f = fixture(t)
    const { response } = await f.run({ game: "all" })
    assert.ok(response.content)
    assert.deepEqual(f.requests, [])
})

test("server-status marks old values unknown with their original observation time", async (t) => {
    const f = fixture(t)
    const row = f.seed("Stale test")
    row.observation.observedAt = "2026-09-29T11:55:00Z"
    row.observation.players = 42
    const { json } = await f.run()
    assert.match(json, /Unknown/)
    assert.match(json, /Stale/)
    assert.match(json, /42 \/ 100/)
    assert.match(json, /<t:1790682900:R>/)
    assert.doesNotMatch(json, /Online/)
})

test("server-status distinguishes disabled collection, no observation and known offline", async (t) => {
    const f = fixture(t)
    f.seed("Disabled").enabled = false
    f.seed("Never observed").observation = null
    f.seed("Known offline").observation.state = "offline"
    const { embed } = await f.run()
    assert.equal(embed?.fields?.length, 3)
    assert.match(embed!.fields![0].value, /Collection disabled/)
    assert.match(embed!.fields![1].value, /Unknown/)
    assert.doesNotMatch(embed!.fields![1].value, /0 \/ 0/)
    assert.match(embed!.fields![2].value, /Offline/)
})

for (const [locale, expected] of [
    ["cs", /Žádný/],
    ["en-US", /No/],
    ["de", /Keine/],
] as const) {
    test(`server-status explains missing configuration in ${locale}`, async (t) => {
        const f = fixture(t)
        const { json } = await f.run({ locale })
        assert.match(json, expected)
        assert.doesNotMatch(json, /0 \/ 0|Offline/)
    })
}

test("server-status retains public-directory attribution and bounds hostile display text", async (t) => {
    const f = fixture(t)
    for (let i = 0; i < 7; i++) {
        const row = f.seed(`server-${i}`)
        row.provider = "wardogs_public_directory"
        row.observation.displayName = "@everyone\n" + "*".repeat(175)
        row.observation.map = "[fake](https://example.test) " + "x".repeat(150)
    }
    const { embed, json } = await f.run()
    assert.equal(embed?.fields?.length, 5)
    assert.match(json, /Wardog Servers/)
    assert.match(json, /https:\/\/wardogservers.com/)
    assert.match(embed?.footer?.text ?? "", /5.*7/)
    assert.doesNotMatch(json, /@everyone/)
    assert.ok(
        embed!.fields!.every(
            (field) => field.name.length <= 256 && field.value.length <= 1024
        )
    )
    const total =
        (embed?.title?.length ?? 0) +
        (embed?.description?.length ?? 0) +
        (embed?.footer?.text.length ?? 0) +
        embed!.fields!.reduce(
            (n, field) => n + field.name.length + field.value.length,
            0
        )
    assert.ok(total < 6000)
})

for (const failure of ["network", "malformed"] as const) {
    test(`server-status reports ${failure} as unavailable without leaking raw errors`, async (t) => {
        const f = fixture(t)
        t.mock.method(ConvexReactClient.prototype, "query", async () => {
            if (failure === "network")
                throw new Error("secret-provider-token@example.test")
            return { connections: [{ snapshot: { players: 0 } }] }
        })
        const { response, json } = await f.run()
        assert.match(response.content ?? "", /unavailable/i)
        assert.doesNotMatch(json, /secret-provider|example\.test|0 \/ 0/)
    })
}

test("server-status stops waiting after ten seconds and ignores a later backend response", async (t) => {
    const f = fixture(t)
    t.mock.timers.enable({ apis: ["setTimeout"] })
    let release: ((value: unknown) => void) | undefined
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        () =>
            new Promise((resolve) => {
                release = resolve
            })
    )
    const result = f.run()
    await Promise.resolve()
    assert.ok(release)
    t.mock.timers.tick(10_001)
    await Promise.resolve()
    release({ sources: [], connections: [] })
    const { response } = await result
    assert.match(response.content ?? "", /unavailable/i)
    assert.equal(response.embeds, undefined)
})

test("server-status replaces invisible provider labels with readable fallbacks", async (t) => {
    const f = fixture(t)
    const row = f.seed("Invisible label")
    row.observation.displayName = "\n\u202e "
    row.observation.map = "\u2067\n"
    const { embed } = await f.run()
    assert.equal(embed?.fields?.[0].name, "Game server")
    assert.match(embed!.fields![0].value, /Map: Unknown/)
})

test("guild command registration includes manager-only server-status with explicit game choices", async () => {
    let commands: Record<string, unknown>[] = []
    await handlers().registerGuildCommands({
        preferredLocale: "cs",
        commands: {
            set: async (value: typeof commands) => {
                commands = value
            },
        },
    } as unknown as Guild)
    const command = commands.find((item) => item.name === "server-status")
    assert.ok(command)
    assert.equal(
        command.default_member_permissions,
        PermissionFlagsBits.ManageGuild.toString()
    )
    assert.equal(command.dm_permission, false)
    const [game] = command.options as {
        name: string
        required: boolean
        choices: { value: string }[]
    }[]
    assert.equal(game.name, "game")
    assert.equal(game.required, true)
    assert.deepEqual(
        game.choices.map((choice) => choice.value),
        ["hell_let_loose", "wardogs"]
    )
})
