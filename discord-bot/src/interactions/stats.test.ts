import {
    MessageFlags,
    type AutocompleteInteraction,
    type ButtonInteraction,
    type ChannelSelectMenuInteraction,
    type ChatInputCommandInteraction,
    type ModalSubmitInteraction,
} from "discord.js"
import { guildCommandConfigFromStored } from "../../../src/domain/discord-commands/guild-config"
import { historyRecord } from "../../../src/infrastructure/testing/game-history"
import { createStatsController, type StatsPorts } from "./stats"
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

type Settings = Parameters<typeof guildCommandConfigFromStored>[0]["config"]

/** A fake interaction that tracks Discord's deferral state like discord.js. */
function interaction<T>(fields: Record<string, unknown>, log: unknown[]) {
    const state = {
        deferred: false,
        replied: false,
        ephemeral: null as boolean | null,
    }
    return Object.assign(state, {
        guildId: guild,
        channelId: "333333333333333333",
        channel: null,
        guild: null,
        user: { id: actor, username: "Fixture" },
        locale: "en-US",
        deferReply: async (value: { flags?: number }) => {
            state.deferred = true
            state.ephemeral = value.flags === MessageFlags.Ephemeral
        },
        deferUpdate: async () => {
            state.deferred = true
        },
        reply: async (value: unknown) => {
            state.replied = true
            log.push(value)
        },
        editReply: async (value: unknown) => {
            assert.ok(state.deferred, "edit only after the acknowledgement")
            log.push(value)
        },
        followUp: async (value: unknown) => {
            log.push(value)
        },
        deleteReply: async () => {},
        ...fields,
    }) as unknown as T
}

function setup(stored: Partial<Settings> = {}) {
    let steamIds: string[] = [],
        saved = 0
    const shares: Array<{ channelId: string; payload: string }> = []
    const row = historyRecord()
    row.session.players[0].platformId = id
    const config = guildCommandConfigFromStored({
        config: { guildId: guild, defaultLanguage: "cs", ...stored },
    })
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
        share: async (_request, channelId, payload) => {
            shares.push({ channelId, payload: JSON.stringify(payload) })
            return { messageId: "444444444444444445" }
        },
        settings: async () =>
            config.statsSettings ?? {
                enabled: true,
                games: { hell_let_loose: true, wardogs: true },
            },
        access: { configs: { get: async () => config } },
    }
    const responses: unknown[] = []
    const command = interaction<ChatInputCommandInteraction>(
        {
            options: {
                getString: (name: string) =>
                    name === "game" ? "wardogs" : null,
                getUser: () => null,
                getChannel: () => null,
            },
        },
        responses
    )
    const controller = createStatsController(ports)
    return {
        controller,
        command,
        responses,
        ports,
        shares,
        setLinked: () => {
            steamIds = [id]
        },
        counts: () => ({ saved, shares: shares.length }),
    }
}

/** The custom ID of a button or select whose ID ends with `:action`. */
function control(payload: unknown, action: string) {
    const json = JSON.stringify(payload)
    const match = new RegExp(
        `"custom_id":"(stats:[a-f0-9]{16}:${action})"`
    ).exec(json)
    if (!match) throw new Error(`Missing ${action} in ${json}`)
    return match[1]!
}
const text = (payload: unknown) => JSON.stringify(payload)

test("the reply is private, Czech in the clan language and offers Přidat Steam only when Steam is missing", async () => {
    const f = setup()
    await f.controller.command(f.command)
    const reply = f.responses.at(-1) as { flags: number }
    assert.match(text(reply), /Chybí ti Steam účet/)
    assert.match(text(reply), /Přidat Steam/)
    assert.doesNotMatch(text(reply), /Obnovit|Refresh/)
    assert.equal(
        reply.flags & MessageFlags.IsComponentsV2,
        MessageFlags.IsComponentsV2
    )
})

test("another person's click gets the own-only card and never the Steam window", async () => {
    const f = setup()
    await f.controller.command(f.command)
    const customId = control(f.responses.at(-1), "link")
    let shown = false
    const log: unknown[] = []
    await f.controller.button(
        interaction<ButtonInteraction>(
            {
                customId,
                user: { id: "333333333333333333" },
                showModal: async () => {
                    shown = true
                },
            },
            log
        )
    )
    assert.match(text(log.at(-1)), /patří někomu jinému/)
    assert.equal(shown, false)
    assert.equal(f.counts().saved, 0)
})

test("late registration saves the invoking identity and renders Wardogs statistics", async () => {
    const f = setup()
    await f.controller.command(f.command)
    let modal = ""
    await f.controller.button(
        interaction<ButtonInteraction>(
            {
                customId: control(f.responses.at(-1), "link"),
                showModal: async (value: { toJSON(): unknown }) => {
                    modal = JSON.stringify(value.toJSON())
                },
            },
            f.responses
        )
    )
    assert.match(modal, /Propojit Steam/)
    assert.match(modal, /Steam ID nebo odkaz na profil/)
    assert.match(modal, /76561198… nebo steamcommunity\.com\/profiles\/…/)
    const modalId = /"custom_id":"(stats:[a-f0-9]{16}:save)"/.exec(modal)![1]!
    await f.controller.modal(
        interaction<ModalSubmitInteraction>(
            {
                customId: modalId,
                fields: { getTextInputValue: () => id },
            },
            f.responses
        )
    )
    assert.equal(f.counts().saved, 1)
    const last = text(f.responses.at(-1))
    assert.match(last, /WARDOGS · POSLEDNÍCH 30 DNÍ/)
    assert.ok(!last.includes(id), "the Steam ID is never shown")
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
    const click = () =>
        interaction<ButtonInteraction>(
            { customId, deferUpdate: async () => acknowledged },
            []
        )
    const clicks = Promise.all([
        f.controller.button(click()),
        f.controller.button(click()),
    ])
    await new Promise((resolve) => setImmediate(resolve))
    release()
    await clicks.catch(() => undefined)
    assert.equal(f.counts().shares, 1)
})

test("expired controls after a restart never publish or link accounts", async () => {
    const f = setup()
    f.setLinked()
    await f.controller.command(f.command)
    const customId = control(f.responses.at(-1), "share"),
        restarted = createStatsController(f.ports)
    const log: unknown[] = []
    await restarted.button(interaction<ButtonInteraction>({ customId }, log))
    assert.match(text(log.at(-1)), /Spusť \/stats znovu/)
    assert.equal(f.counts().shares, 0)
})

test("a switched-off command or game answers privately before any source read (N3-B04, M2-32)", async () => {
    const off = setup({
        statsSettings: {
            enabled: false,
            games: { hell_let_loose: true, wardogs: true },
        },
    })
    let reads = 0
    off.ports.account = async () => {
        reads++
        return { steamIds: [], name: null }
    }
    await off.controller.command(off.command)
    assert.match(text(off.responses.at(-1)), /Příkaz \/stats je tu vypnutý/)
    const gameOff = setup({
        statsSettings: {
            enabled: true,
            games: { hell_let_loose: true, wardogs: false },
        },
    })
    gameOff.ports.account = off.ports.account
    await gameOff.controller.command(gameOff.command)
    assert.match(
        text(gameOff.responses.at(-1)),
        /Statistiky Wardogs jsou tu vypnuté/
    )
    assert.equal(reads, 0)
})

test("outside the allowed channels /stats says where it works (N3-B05)", async () => {
    const f = setup({
        commandSettings: { stats: { channelIds: ["555555555555555555"] } },
    })
    await f.controller.command(f.command)
    assert.match(
        text(f.responses.at(-1)),
        /\/stats tady nejde použít.*<#555555555555555555>/
    )
})

test("the default room shares directly and the shared card names the sharer (M2-B03, M2-23)", async () => {
    const f = setup({
        statsSettings: {
            enabled: true,
            games: { hell_let_loose: true, wardogs: true },
            defaultShareChannelId: "444444444444444444",
        },
    })
    f.setLinked()
    await f.controller.command(f.command)
    const log: unknown[] = []
    await f.controller.button(
        interaction<ButtonInteraction>(
            {
                customId: control(f.responses.at(-1), "share"),
                reply: async () => {
                    throw new Error("no channel picker expected")
                },
            },
            log
        )
    )
    assert.deepEqual(
        f.shares.map((share) => share.channelId),
        ["444444444444444444"]
    )
    assert.match(f.shares[0]!.payload, /Sdílel <@222222222222222222>/)
    assert.doesNotMatch(f.shares[0]!.payload, /custom_id/)
    assert.match(text(log.at(-1)), /Sdíleno do <#444444444444444444>/)
    assert.match(text(log.at(-1)), /Zobrazit zprávu/)
})

test("without a default room Sdílet asks where; a denied channel offers another (M2-24, M2-26)", async () => {
    const f = setup()
    f.setLinked()
    f.ports.share = async () => {
        throw new Error("share_denied")
    }
    await f.controller.command(f.command)
    const log: unknown[] = []
    await f.controller.button(
        interaction<ButtonInteraction>(
            { customId: control(f.responses.at(-1), "share") },
            log
        )
    )
    const prompt = text(log.at(-1))
    assert.match(prompt, /Kam kartu poslat\?/)
    assert.match(prompt, /Vyber kanál/)
    assert.match(prompt, /Zpět/)
    await f.controller.channel(
        interaction<ChannelSelectMenuInteraction>(
            {
                customId: control(log.at(-1), "channel"),
                values: ["666666666666666666"],
            },
            log
        )
    )
    const denied = text(log.at(-1))
    assert.match(denied, /Do <#666666666666666666> teď sdílet nejde/)
    assert.match(denied, /Vybrat jiný kanál/)
    await f.controller.button(
        interaction<ButtonInteraction>(
            { customId: control(log.at(-1), "choose") },
            log
        )
    )
    assert.match(text(log.at(-1)), /Kam kartu poslat\?/)
})

test("the reply mode Jen autor příkazu has no Sdílet", async () => {
    const f = setup({ commandSettings: { stats: { reply: "private" } } })
    f.setLinked()
    await f.controller.command(f.command)
    assert.doesNotMatch(text(f.responses.at(-1)), /Sdílet/)
    assert.throws(() => control(f.responses.at(-1), "share"))
})
