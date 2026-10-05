import { MessageFlags } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

import { errorCard } from "../../../src/domain/discord-messages/message-view"
import { replyToClicker, type ClickerTarget } from "./replies"

function target(patch: Partial<ClickerTarget> = {}) {
    const calls: Array<[string, { flags?: number }]> = []
    const record =
        (name: string) =>
        async (options: unknown): Promise<unknown> => {
            calls.push([name, options as { flags?: number }])
            return undefined
        }
    const interaction: ClickerTarget = {
        guildId: "guild-1",
        deferred: false,
        replied: false,
        reply: record("reply"),
        editReply: record("editReply"),
        followUp: record("followUp"),
        deleteReply: async () => undefined,
        update: record("update"),
        message: { flags: { has: () => false } },
        ...patch,
    }
    return { interaction, calls }
}

const view = errorCard({
    title: "Přihlášky už skončily",
    body: "Napiš velení.",
})

test("in a server the reply is private (L1-87)", async () => {
    const { interaction, calls } = target()
    await replyToClicker(interaction, view, { language: "cs" })
    assert.equal(calls[0]?.[0], "reply")
    assert.equal(
        (calls[0]?.[1].flags ?? 0) & MessageFlags.Ephemeral,
        MessageFlags.Ephemeral
    )
})

test("in a DM the reply is a normal message in the same conversation (L1-87)", async () => {
    const { interaction, calls } = target({ guildId: null })
    await replyToClicker(interaction, view, { language: "cs" })
    assert.equal(calls[0]?.[0], "reply")
    assert.equal((calls[0]?.[1].flags ?? 0) & MessageFlags.Ephemeral, 0)
})

test("a click on a private reply card turns that card into the answer", async () => {
    const { interaction, calls } = target({
        message: {
            flags: { has: (flag: number) => flag === MessageFlags.Ephemeral },
        },
    })
    await replyToClicker(interaction, view, {
        language: "cs",
        replaceCard: true,
    })
    assert.equal(calls[0]?.[0], "update")
})

test("a deferred reply is completed in place", async () => {
    const { interaction, calls } = target({ deferred: true })
    await replyToClicker(interaction, view, { language: "cs" })
    assert.equal(calls[0]?.[0], "editReply")
})
