import {
    MessageFlags,
    type ChatInputCommandInteraction,
    type ButtonInteraction,
    type ModalSubmitInteraction,
    type AutocompleteInteraction,
} from "discord.js"
import {
    createStatsController,
    buildStatsCommand,
    type StatsPorts,
} from "./stats"
import { historyRecord } from "../../../src/infrastructure/testing/game-history"
import { statsCopy } from "../../../src/domain/player-stats/stats-copy"
import assert from "node:assert/strict"
import test from "node:test"

const id = "76561198199051397",
    actor = "222222222222222222",
    guild = "111111111111111111"

test("Wardogs autocomplete keeps the newest recorded name for a stable Steam identity", async () => {
    const f = setup(),
        newest = historyRecord("new"),
        older = historyRecord("old")
    newest.session.players[0].platformId = id
    newest.session.players[0].name = "New nickname"
    older.session.players[0].platformId = id
    older.session.players[0].name = "Old nickname"
    f.ports.history = async () => ({
        records: [newest, older],
        lastCollectedAt: null,
    })
    let choices: Array<{ name: string; value: string }> = []
    await f.controller.autocomplete({
        guildId: guild,
        user: { id: actor },
        options: {
            getFocused: () => ({ name: "player", value: "new" }),
            getString: (key: string) => (key === "game" ? "wardogs" : null),
        },
        respond: async (v: Array<{ name: string; value: string }>) => {
            choices = v
        },
    } as unknown as AutocompleteInteraction)
    assert.equal(choices.length, 1)
    assert.equal(choices[0].value, id)
    assert.match(choices[0].name, /New nickname/)
})
function setup() {
    let steamIds: string[] = [],
        saved = 0,
        shares = 0
    const row = historyRecord()
    row.session.players[0].platformId = id
    const ports: StatsPorts = {
        authorize: async () => true,
        account: async () => ({ steamIds: [...steamIds], name: "Fixture" }),
        history: async () => ({
            records: [row],
            lastCollectedAt: row.collectedAt,
        }),
        hll: async () => ({
            status: "unavailable",
            profile: null,
            fetchedAt: null,
            reason: "blocked",
        }),
        link: async (_req, steam) => {
            saved++
            steamIds = [steam]
        },
        share: async () => {
            shares++
        },
        artwork: async () => null,
        settings: async () => undefined,
    }
    const responses: unknown[] = []
    let deferred = false
    const command = {
        guildId: guild,
        user: { id: actor, username: "Fixture" },
        locale: "cs",
        options: {
            getString: (name: string) => (name === "game" ? "wardogs" : null),
            getUser: () => null,
            getChannel: () => null,
        },
        deferReply: async (arg: { flags: number }) => {
            assert.equal(arg.flags, MessageFlags.Ephemeral)
            deferred = true
        },
        reply: async (value: unknown) => {
            responses.push(value)
        },
        editReply: async (value: unknown) => {
            assert.ok(deferred)
            responses.push(value)
        },
    } as unknown as ChatInputCommandInteraction
    const controller = createStatsController(ports)
    return {
        controller,
        command,
        responses,
        ports,
        setLinked: () => {
            steamIds = [id]
        },
        counts: () => ({ saved, shares }),
    }
}
function control(payload: unknown, action: string) {
    const json = JSON.parse(JSON.stringify(payload))
    for (const row of json.components ?? [])
        for (const c of row.components ?? [])
            if (c.custom_id?.endsWith(`:${action}`))
                return c.custom_id as string
    throw new Error(`Missing ${action}`)
}
test("one stats registration includes both games and an optional linked member", () => {
    const cmd = buildStatsCommand().toJSON()
    assert.equal(cmd.name, "stats")
    assert.ok(cmd.options?.find((o) => o.name === "game"))
    assert.ok(cmd.options?.find((o) => o.name === "member"))
})
test("real stats controller defers privately, offers late registration, and rejects another owner", async () => {
    const f = setup()
    await f.controller.command(f.command)
    const customId = control(f.responses.at(-1), "link")
    let answer = "",
        shown = false
    await f.controller.button({
        customId,
        guildId: guild,
        user: { id: "333333333333333333" },
        locale: "cs",
        reply: async (v: { content: string }) => {
            answer = v.content
        },
        showModal: async () => {
            shown = true
        },
    } as unknown as ButtonInteraction)
    assert.match(answer, /autor/)
    assert.equal(shown, false)
    assert.equal(f.counts().saved, 0)
})
test("late registration saves the invoking identity and immediately renders Wardogs statistics", async () => {
    const f = setup()
    await f.controller.command(f.command)
    let modalId = ""
    const customId = control(f.responses.at(-1), "link")
    await f.controller.button({
        customId,
        guildId: guild,
        user: { id: actor },
        locale: "cs",
        showModal: async (m: { data: { custom_id: string } }) => {
            modalId = m.data.custom_id
        },
    } as unknown as ButtonInteraction)
    await f.controller.modal({
        customId: modalId,
        guildId: guild,
        user: { id: actor, username: "Fixture" },
        locale: "cs",
        fields: { getTextInputValue: () => id },
        deferReply: async () => {},
        editReply: async (v: unknown) => {
            f.responses.push(v)
        },
        reply: async (v: unknown) => {
            f.responses.push(v)
        },
    } as unknown as ModalSubmitInteraction)
    assert.equal(f.counts().saved, 1)
    assert.match(JSON.stringify(f.responses.at(-1)), /12/)
    assert.ok(!JSON.stringify(f.responses.at(-1)).includes(id))
})

test("concurrent share clicks publish only once, even while Discord acknowledgement is pending", async () => {
    const f = setup()
    f.setLinked()
    f.command.options.getChannel = (() => ({
        id: "444444444444444444",
    })) as unknown as typeof f.command.options.getChannel
    await f.controller.command(f.command)
    const customId = control(f.responses.at(-1), "share")
    let release!: () => void
    const acknowledged = new Promise<void>((resolve) => {
        release = resolve
    })
    const interaction = {
        customId,
        guildId: guild,
        user: { id: actor },
        locale: "cs",
        deferUpdate: async () => acknowledged,
        reply: async () => {},
        editReply: async () => {},
    } as unknown as ButtonInteraction
    const clicks = Promise.all([
        f.controller.button(interaction),
        f.controller.button(interaction),
    ])
    await new Promise((resolve) => setImmediate(resolve))
    release()
    await clicks
    assert.equal(f.counts().shares, 1)
})

test("expired controls after a restart never publish or link accounts", async () => {
    const f = setup()
    f.setLinked()
    await f.controller.command(f.command)
    const customId = control(f.responses.at(-1), "share"),
        restarted = createStatsController(f.ports)
    let answer = ""
    await restarted.button({
        customId,
        guildId: guild,
        user: { id: actor },
        locale: "cs",
        reply: async (v: { content: string }) => {
            answer = v.content
        },
    } as unknown as ButtonInteraction)
    assert.match(answer, /stats/)
    assert.equal(f.counts().shares, 0)
})

test("a switched-off command or game answers privately before any source read", async () => {
    const off = setup()
    off.ports.settings = async () => ({
        enabled: false,
        games: { hell_let_loose: true, wardogs: true },
    })
    await off.controller.command(off.command)
    assert.equal(off.responses.length, 1)
    assert.deepEqual(off.responses[0], {
        content: statsCopy("cs").disabled,
        flags: MessageFlags.Ephemeral,
    })
    const gameOff = setup()
    gameOff.ports.settings = async () => ({
        enabled: true,
        games: { hell_let_loose: true, wardogs: false },
    })
    await gameOff.controller.command(gameOff.command)
    assert.deepEqual(gameOff.responses[0], {
        content: statsCopy("cs").gameDisabled,
        flags: MessageFlags.Ephemeral,
    })
})

test("the configured default room shares without a channel picker, and an explicit channel still wins", async () => {
    const f = setup()
    f.setLinked()
    let settingsReads = 0
    f.ports.settings = async () => {
        settingsReads++
        return {
            enabled: true,
            games: { hell_let_loose: true, wardogs: true },
            defaultShareChannelId: "444444444444444444",
        }
    }
    const shared: string[] = []
    f.ports.share = async (_request, channelId) => {
        shared.push(channelId)
    }
    await f.controller.command(f.command)
    assert.equal(settingsReads, 1)
    await f.controller.button({
        customId: control(f.responses.at(-1), "share"),
        guildId: guild,
        user: { id: actor },
        locale: "cs",
        deferUpdate: async () => {},
        reply: async () => {
            throw new Error("no channel picker expected")
        },
        editReply: async () => {},
    } as unknown as ButtonInteraction)
    assert.deepEqual(shared, ["444444444444444444"])
    const explicit = setup()
    explicit.setLinked()
    explicit.ports.settings = f.ports.settings
    explicit.ports.share = async (_request, channelId) => {
        shared.push(channelId)
    }
    explicit.command.options.getChannel = (() => ({
        id: "555555555555555555",
    })) as unknown as typeof explicit.command.options.getChannel
    await explicit.controller.command(explicit.command)
    await explicit.controller.button({
        customId: control(explicit.responses.at(-1), "share"),
        guildId: guild,
        user: { id: actor },
        locale: "cs",
        deferUpdate: async () => {},
        reply: async () => {},
        editReply: async () => {},
    } as unknown as ButtonInteraction)
    assert.deepEqual(shared, ["444444444444444444", "555555555555555555"])
})
