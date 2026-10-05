import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

import {
    MessageFlags,
    type AutocompleteInteraction,
    type ButtonInteraction,
    type ChannelSelectMenuInteraction,
    type ChatInputCommandInteraction,
    type Interaction,
    type ModalSubmitInteraction,
    type StringSelectMenuInteraction,
} from "discord.js"
import { ConvexReactClient } from "convex/react"

import {
    createInteractionRegistry,
    InteractionRegistry,
    runInteraction,
    type InteractionFeature,
    type InteractionFeatureContext,
} from "./registry"
import { createInteractionHandler } from "../interactions"
import { interactionFeatures } from "./features"
import { closeConvexClient } from "../convex"

afterEach(closeConvexClient)

const context: InteractionFeatureContext = {
    enqueueEventSync: () => {},
    triggerPollSoon: () => {},
}
const fake = <T>(value: Record<string, unknown>) => value as unknown as T

test("a feature registers a button prefix and a slash command and both are routed", async () => {
    const seen: string[] = []
    let received: InteractionFeatureContext | undefined
    const seed: InteractionFeature = {
        name: "seed",
        register(registry, featureContext) {
            received = featureContext
            registry
                .button("seed:", (interaction) => {
                    seen.push(`button ${interaction.customId}`)
                })
                .command("help", (interaction) => {
                    seen.push(`command ${interaction.commandName}`)
                })
        },
    }
    const handler = createInteractionHandler({
        ...context,
        registry: createInteractionRegistry([seed], context),
    })
    await handler.handleButtonInteraction(
        fake<ButtonInteraction>({ customId: "seed:start:vlci-1" })
    )
    await handler.handleChatInputCommand(
        fake<ChatInputCommandInteraction>({ commandName: "help" })
    )
    assert.deepEqual(seen, ["button seed:start:vlci-1", "command help"])
    assert.equal(received, context)
})

test("a registered route takes precedence over the existing dispatch", async (t) => {
    const queries = t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async () => {
            throw new Error("the old ticket handler must not run")
        }
    )
    let routed = false
    const handler = createInteractionHandler({
        ...context,
        registry: new InteractionRegistry().button("ticket:", () => {
            routed = true
        }),
    })
    await handler.handleButtonInteraction(
        fake<ButtonInteraction>({ customId: "ticket:support" })
    )
    assert.equal(routed, true)
    assert.equal(queries.mock.callCount(), 0)
})

test("anything not registered falls through to the existing dispatch unchanged", async () => {
    let routed = false
    const handler = createInteractionHandler({
        ...context,
        registry: new InteractionRegistry().command("help", () => {
            routed = true
        }),
    })
    let answer: { content?: string; flags?: unknown } | undefined
    await handler.handleChatInputCommand(
        fake<ChatInputCommandInteraction>({
            // Still answered by the old dispatch (/link moved to link.ts).
            commandName: "close_application",
            guildId: null,
            inGuild: () => false,
            channel: null,
            reply: async (value: { content?: string; flags?: unknown }) => {
                answer = value
            },
        })
    )
    assert.equal(routed, false)
    assert.ok(answer, "the existing /close_application dispatch answered")
    assert.equal(
        Number(answer.flags) & MessageFlags.Ephemeral,
        MessageFlags.Ephemeral
    )
})

test("selects, channel selects, modals and autocomplete route by their own keys", async () => {
    const seen: string[] = []
    const registry = new InteractionRegistry()
        .stringSelect("report:pick", () => void seen.push("select"))
        .channelSelect("seed:channel", () => void seen.push("channel"))
        .modal("seed-modal:", () => void seen.push("modal"))
        .autocomplete("notice", () => void seen.push("autocomplete"))
    assert.equal(
        await registry.routeStringSelect(
            fake<StringSelectMenuInteraction>({ customId: "report:pick:2" })
        ),
        true
    )
    assert.equal(
        await registry.routeChannelSelect(
            fake<ChannelSelectMenuInteraction>({ customId: "seed:channel" })
        ),
        true
    )
    assert.equal(
        await registry.routeModal(
            fake<ModalSubmitInteraction>({ customId: "seed-modal:1" })
        ),
        true
    )
    assert.equal(
        await registry.routeAutocomplete(
            fake<AutocompleteInteraction>({ commandName: "notice" })
        ),
        true
    )
    assert.equal(
        await registry.routeButton(
            fake<ButtonInteraction>({ customId: "report:pick:2" })
        ),
        false,
        "a select prefix does not catch buttons"
    )
    assert.deepEqual(seen, ["select", "channel", "modal", "autocomplete"])
    assert.deepEqual(registry.routes(), [
        "autocomplete:notice",
        "channelSelect:seed:channel",
        "modal:seed-modal:",
        "stringSelect:report:pick",
    ])
})

test("the longest prefix wins and a route cannot be registered twice", async () => {
    const seen: string[] = []
    const registry = new InteractionRegistry()
        .button("panel:", () => void seen.push("panel"))
        .button("panel:seed:", () => void seen.push("panel seed"))
    await registry.routeButton(
        fake<ButtonInteraction>({ customId: "panel:seed:1" })
    )
    await registry.routeButton(
        fake<ButtonInteraction>({ customId: "panel:refresh" })
    )
    assert.deepEqual(seen, ["panel seed", "panel"])
    assert.throws(() => registry.button("panel:", () => {}), /registered twice/)
    assert.throws(() => registry.button("", () => {}), /invalid/)
    assert.throws(
        () => registry.command("Help", () => {}),
        /not a command name/
    )
    assert.throws(
        () => registry.command("help", () => {}).command("help", () => {}),
        /registered twice/
    )
})

test("the shipped feature list is valid", () => {
    assert.doesNotThrow(() =>
        createInteractionRegistry(interactionFeatures, context)
    )
})

test("an error in a routed handler ends in the private unknown error card", async () => {
    const replies: Array<{ flags?: unknown; components?: unknown }> = []
    const logged: unknown[] = []
    const registry = new InteractionRegistry().button("seed:", () => {
        throw new Error("Convex said: internal detail")
    })
    const interaction = fake<Interaction>({
        type: 3,
        customId: "seed:start",
        guildId: "123",
        channelId: "456",
        deferred: false,
        replied: false,
        isRepliable: () => true,
        reply: async (value: { flags?: unknown; components?: unknown }) => {
            replies.push(value)
        },
    })
    await runInteraction(
        interaction,
        () => registry.routeButton(interaction as ButtonInteraction),
        {
            replyUnknownError: (await import("../ui/replies"))
                .replyUnknownError,
            interactionLanguage: async () => "cs",
            logError: (_scope, _message, details) => void logged.push(details),
            logWarn: () => {},
        }
    )
    assert.equal(logged.length, 1)
    assert.equal(replies.length, 1)
    assert.equal(
        replies[0]!.flags,
        MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    )
    const sent = JSON.stringify(replies[0]!.components)
    assert.match(sent, /Tohle se nepovedlo/)
    assert.doesNotMatch(sent, /internal detail/)
})

test("a non-repliable interaction is only logged", async () => {
    let replied = false
    await runInteraction(
        fake<Interaction>({
            type: 4,
            guildId: null,
            channelId: null,
            isRepliable: () => false,
        }),
        async () => {
            throw new Error("x")
        },
        {
            replyUnknownError: async () => {
                replied = true
            },
            interactionLanguage: async () => undefined,
            logError: () => {},
            logWarn: () => {},
        }
    )
    assert.equal(replied, false)
})
