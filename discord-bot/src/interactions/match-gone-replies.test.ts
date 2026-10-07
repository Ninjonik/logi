import test, { afterEach, type TestContext } from "node:test"
import assert from "node:assert/strict"

import { MessageFlags, type ButtonInteraction } from "discord.js"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"

import { fakeInteraction } from "../commands/fake-interaction"
import { createInteractionHandler } from "../interactions"
import { closeConvexClient } from "../convex"

/**
 * L1-B19, L2-B01: the attendance and roster buttons of a deleted match
 * answer "Zápas už není k dispozici" in the clan language, in the server
 * and in a DM whose button names the server. A DM button sent before the
 * ID named the server still routes and answers as before.
 */

afterEach(closeConvexClient)

const CLAN = "900000000000000101"
const GONE = "event-gone"
const CZECH =
    /### Zápas už není k dispozici.*Velení ho mezitím zrušilo nebo smazalo\./
const ENGLISH = /### This match is no longer available/

/** Convex for a Czech clan whose match was deleted; nothing is written. */
function deletedMatch(t: TestContext) {
    const contextReads: unknown[] = []
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (
            reference: Parameters<typeof getFunctionName>[0],
            args?: { eventId?: string }
        ) => {
            const name = getFunctionName(reference)
            if (name.endsWith("getConfigByDiscordGuildId"))
                return { defaultLanguage: "cs", messageStyle: null }
            if (name.endsWith("getEventInteractionContext"))
                contextReads.push(args?.eventId)
            return null
        }
    )
    t.mock.method(ConvexReactClient.prototype, "mutation", async () =>
        assert.fail("Nothing is written for a deleted match")
    )
    return contextReads
}

async function click(customId: string, guildId: string | null) {
    const fake = fakeInteraction<ButtonInteraction>({
        customId,
        guildId,
        client: { guilds: { fetch: async () => null } },
    })
    await createInteractionHandler({
        enqueueEventSync: () => {},
        triggerPollSoon: () => {},
    }).handleButtonInteraction(fake.interaction)
    assert.equal(fake.sent.length, 1, `one reply to ${customId}`)
    const value = fake.sent[0]?.value as { flags?: number }
    return {
        text: fake.text(),
        ephemeral: ((value.flags ?? 0) & MessageFlags.Ephemeral) !== 0,
    }
}

const buttons = [
    ["Potvrdím / Potvrdím účast", "attendance-confirm:"],
    ["Přijdu později", "attendance-late:"],
    ["Nemůžu", "attendance-decline:"],
    ["Zobrazit zařazení", "roster-assignment:"],
] as const

for (const [label, prefix] of buttons) {
    test(`${label}: a deleted match answers in Czech from the server`, async (t) => {
        const reads = deletedMatch(t)
        const reply = await click(`${prefix}${GONE}`, CLAN)
        assert.match(reply.text, CZECH)
        assert.equal(reply.ephemeral, true)
        assert.deepEqual(reads, [GONE])
    })

    test(`${label}: a deleted match answers in Czech from a DM whose button names the server`, async (t) => {
        const reads = deletedMatch(t)
        const reply = await click(`${prefix}${GONE}:${CLAN}`, null)
        assert.match(reply.text, CZECH)
        assert.doesNotMatch(reply.text, ENGLISH)
        // In a DM the reply is a normal message.
        assert.equal(reply.ephemeral, false)
        // The server is not read as part of the match.
        assert.deepEqual(reads, [GONE])
    })

    test(`${label}: an older DM button without the server still routes`, async (t) => {
        const reads = deletedMatch(t)
        const reply = await click(`${prefix}${GONE}`, null)
        assert.deepEqual(reads, [GONE])
        // Nothing names the clan, so the reply stays English as before.
        assert.match(reply.text, ENGLISH)
    })
}

test("Zobrazit soupisku: a deleted match answers in Czech from the server", async (t) => {
    const reads = deletedMatch(t)
    const reply = await click(`roster-squads:${GONE}`, CLAN)
    assert.match(reply.text, CZECH)
    assert.equal(reply.ephemeral, true)
    assert.deepEqual(reads, [GONE])
})
