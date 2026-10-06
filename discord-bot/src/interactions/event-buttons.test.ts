import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

import type { ButtonInteraction } from "discord.js"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"

import {
    handleCheckSignupInteraction,
    handleEventButtonInteraction,
    handleEventSignupPickerInteraction,
    replyGuildId,
} from "./event-buttons"
import { closeConvexClient } from "../convex"

afterEach(closeConvexClient)

const GUILD_ID = "900000000000000123"

test("a reply takes the clan from the server, else from the button's custom ID (L1-B19)", () => {
    assert.equal(
        replyGuildId("900000000000000001", GUILD_ID),
        "900000000000000001"
    )
    assert.equal(replyGuildId(null, GUILD_ID), GUILD_ID)
    assert.equal(replyGuildId(undefined, ` ${GUILD_ID} `), GUILD_ID)
    // Only a Discord ID names a clan; anything else falls back to no clan.
    assert.equal(replyGuildId(null, "select"), undefined)
    assert.equal(replyGuildId(null, undefined), undefined)
})

/** A DM click on a sign-up reminder button: no guild on the interaction. */
function dmClick(customId: string) {
    const replies: unknown[] = []
    const interaction = {
        customId,
        guildId: null,
        guild: null,
        deferred: false,
        replied: false,
        user: { id: "100000000000000001" },
        isButton: () => true,
        isStringSelectMenu: () => false,
        reply: async (payload: unknown) => {
            replies.push(payload)
        },
        followUp: async (payload: unknown) => {
            replies.push(payload)
        },
        editReply: async (payload: unknown) => {
            replies.push(payload)
        },
    }
    return { interaction: interaction as unknown as ButtonInteraction, replies }
}

function payloadText(payload: unknown) {
    const components =
        (payload as { components?: Array<{ toJSON?: () => unknown }> })
            .components ?? []
    return JSON.stringify(
        components.map((component) =>
            typeof component.toJSON === "function"
                ? component.toJSON()
                : component
        )
    )
}

// A separate clan per case: the bot caches each clan's language.
for (const [label, handler, guildId, customId] of [
    [
        "Přihlásit se",
        handleEventSignupPickerInteraction,
        "900000000000000201",
        "signup-picker:event-1:900000000000000201",
    ],
    [
        "Upravit přihlášku",
        handleCheckSignupInteraction,
        "900000000000000202",
        "check-signup:event-1:900000000000000202",
    ],
    [
        "Nepřijdu",
        (interaction: ButtonInteraction) =>
            handleEventButtonInteraction(interaction, {
                enqueueEventSync: () => {},
                triggerPollSoon: () => {},
            }),
        "900000000000000203",
        "signup:event-1:NOT_ATTENDING:900000000000000203",
    ],
] as const) {
    test(`a deleted match clicked from a DM (${label}) answers in the clan language (L1-B19)`, async (t) => {
        const requests: Array<{ name: string; args: unknown }> = []
        t.mock.method(
            ConvexReactClient.prototype,
            "query",
            async (
                reference: Parameters<typeof getFunctionName>[0],
                args: unknown
            ) => {
                const name = getFunctionName(reference)
                requests.push({ name, args })
                // The clan reads Czech; the match is gone.
                return name === "discordConfig:getConfigByDiscordGuildId"
                    ? { defaultLanguage: "cs" }
                    : null
            }
        )
        const { interaction, replies } = dmClick(customId)
        await handler(interaction)
        assert.equal(replies.length, 1)
        const text = payloadText(replies[0])
        assert.match(text, /Zápas už není k dispozici/)
        assert.doesNotMatch(text, /no longer available/)
        // The language came from the guild in the custom ID.
        assert.ok(
            requests.some(
                (request) =>
                    request.name ===
                        "discordConfig:getConfigByDiscordGuildId" &&
                    (request.args as { guildId?: string }).guildId === guildId
            )
        )
    })
}
