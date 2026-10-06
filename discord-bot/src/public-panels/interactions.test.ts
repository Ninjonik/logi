import assert from "node:assert/strict"
import test from "node:test"

import {
    MessageFlags,
    type ButtonInteraction,
    type InteractionEditReplyOptions,
} from "discord.js"

import { hllLiveFacts } from "../../../src/domain/discord-publications/live-panel"
import { hllLiveFixture } from "../../../src/infrastructure/testing/hll-live"
import { handlePlayersButton, type PlayersButtonPorts } from "./interactions"
import type { WorkerPanel } from "./worker"

const guildId = "100000000000000099"
const channelId = "123456789012345678"

const panel = {
    _id: "panel1",
    guildId,
    channelId,
    kind: "server",
    revision: 7,
    enabled: true,
    showPlayers: true,
    servers: [{ name: "Vlci #1", connectionId: "hll-1" }],
} as unknown as WorkerPanel

/** A button press with only what the handler reads; no Discord client. */
function press(customId: string, ephemeral = false) {
    const calls: string[] = []
    const replies: InteractionEditReplyOptions[] = []
    const interaction = {
        customId,
        guildId,
        channelId,
        message: {
            flags: {
                has: (flag: number) =>
                    ephemeral && flag === MessageFlags.Ephemeral,
            },
        },
        deferReply: async (options: { flags: number }) => {
            calls.push(`deferReply:${options.flags}`)
        },
        deferUpdate: async () => {
            calls.push("deferUpdate")
        },
        editReply: async (reply: InteractionEditReplyOptions) => {
            replies.push(reply)
        },
    } as unknown as ButtonInteraction
    return { interaction, calls, replies }
}

function ports(
    overrides: Partial<PlayersButtonPorts> = {}
): PlayersButtonPorts {
    return {
        readPanel: async (_guild, id) => (id === panel._id ? panel : null),
        readFacts: async () => hllLiveFacts(hllLiveFixture()),
        canView: async () => true,
        language: async () => "cs",
        style: async () => null,
        emoji: async () => ({}),
        ...overrides,
    }
}

const text = (reply: InteractionEditReplyOptions) =>
    JSON.stringify(
        (reply.components ?? []).map((component) =>
            "toJSON" in component
                ? (component as { toJSON(): unknown }).toJSON()
                : component
        )
    )

test("Zobrazit hráče answers privately with the current round's players", async () => {
    const { interaction, calls, replies } = press(
        "logi:players:panel1:7:0:open"
    )
    await handlePlayersButton(interaction, ports())
    assert.deepEqual(calls, [`deferReply:${MessageFlags.Ephemeral}`])
    assert.equal(replies.length, 1)
    const body = text(replies[0]!)
    assert.match(body, /HRÁČI NA SERVERU · VLCI #1/)
    assert.match(body, /Synthetic Allied/)
    assert.doesNotMatch(body, /76561198/)
})

test("paging edits the private reply in place", async () => {
    const { interaction, calls, replies } = press(
        "logi:players:panel1:7:1:next",
        true
    )
    await handlePlayersButton(interaction, ports())
    assert.deepEqual(calls, ["deferUpdate"])
    assert.equal(replies.length, 1)
})

test("an old panel revision, a hidden channel or a paused panel get the outdated card", async () => {
    for (const [customId, overrides] of [
        ["logi:players:panel1:6:0:open", {}],
        ["logi:players:panel1:7:0:open", { canView: async () => false }],
        [
            "logi:players:panel1:7:0:open",
            {
                readPanel: async () =>
                    ({ ...panel, paused: true }) as unknown as WorkerPanel,
            },
        ],
    ] as const) {
        const { interaction, replies } = press(customId)
        await handlePlayersButton(interaction, ports(overrides))
        const body = text(replies[0]!)
        assert.match(body, /Tenhle panel už není aktuální/)
        assert.doesNotMatch(body, /Synthetic Allied/)
    }
})

test("a failed live read gets the unavailable card instead of a spinner", async () => {
    const { interaction, replies } = press("logi:players:panel1:7:0:open")
    await handlePlayersButton(
        interaction,
        ports({ readFacts: async () => "unavailable" })
    )
    assert.match(text(replies[0]!), /Seznam hráčů teď není k dispozici/)
    const thrown = press("logi:players:panel1:7:0:open")
    await handlePlayersButton(
        thrown.interaction,
        ports({
            readFacts: async () => {
                throw new Error("provider diagnostic")
            },
        })
    )
    assert.match(text(thrown.replies[0]!), /Seznam hráčů teď není k dispozici/)
    assert.doesNotMatch(text(thrown.replies[0]!), /diagnostic/)
})

test("the private player list carries the clan's own colour (L3-39)", async () => {
    const { interaction, replies } = press("logi:players:panel1:7:0:open")
    await handlePlayersButton(
        interaction,
        ports({
            style: async () => ({
                accentColor: "#4F9DE0",
                iconDensity: "rich",
            }),
        })
    )
    const container = (replies[0]!.components ?? []).map((component) =>
        "toJSON" in component
            ? (component as { toJSON(): { accent_color?: number } }).toJSON()
            : (component as { accent_color?: number })
    )[0]
    assert.equal(container?.accent_color, 0x4f9de0)
})
