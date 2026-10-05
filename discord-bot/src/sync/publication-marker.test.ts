import assert from "node:assert/strict"
import test from "node:test"

import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    TextDisplayBuilder,
} from "discord.js"

import {
    findPublicationMessage,
    publicationComponentId,
    publicationCreatePayload,
    publicationNonce,
    tagPublicationComponents,
} from "./publication-marker"

const marker = "logi:publication:discordPublications:abc:7"
const bot = "900000000000000000"
const container = () =>
    new ContainerBuilder()
        .setAccentColor(0xe8a33d)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent("### Vlci #1")
        )
const signupRow = () =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId("signup:1")
            .setLabel("Přihlásit se")
            .setStyle(ButtonStyle.Success)
    )

test("the component id is stable, a 32-bit integer and differs per attempt", () => {
    const id = publicationComponentId(marker)
    assert.equal(publicationComponentId(marker), id)
    assert.ok(Number.isInteger(id))
    assert.ok(id >= 1_000_000_000 && id < 2_000_000_000)
    assert.ok(id <= 2_147_483_647)
    const ids = new Set(
        Array.from({ length: 200 }, (_, fence) =>
            publicationComponentId(`logi:publication:x:${fence}`)
        )
    )
    assert.equal(ids.size, 200)
    assert.match(publicationNonce(marker), /^\d+$/)
})

test("the create request has no Automatic updates button and no visible marker", () => {
    const payload = publicationCreatePayload(
        {
            embeds: [new EmbedBuilder().setTitle("Ohlášení")],
            components: [signupRow()],
        },
        marker
    )
    const sent = JSON.stringify(payload)
    assert.doesNotMatch(sent, /Automatic updates/)
    assert.doesNotMatch(sent, /logi:publication/)
    const components = JSON.parse(sent).components as Array<{
        id?: number
        components: unknown[]
    }>
    assert.equal(components.length, 1, "no extra row is appended")
    assert.equal(components[0]!.id, publicationComponentId(marker))
    assert.equal(components[0]!.components.length, 1)
    assert.deepEqual(payload.allowedMentions, { parse: [] })
    assert.equal(payload.enforceNonce, true)
    assert.equal(payload.nonce, publicationNonce(marker))
})

test("a Components V2 message tags its container and keeps every other component", () => {
    const tagged = tagPublicationComponents(
        [container(), signupRow()],
        marker
    ) as Array<{ id?: number; type: number }>
    assert.equal(tagged.length, 2)
    assert.equal(tagged[0]!.id, publicationComponentId(marker))
    assert.equal(tagged[0]!.type, 17)
    assert.ok(tagged[1] instanceof ActionRowBuilder, "the rest is untouched")
})

test("a message without components gets nothing added", () => {
    assert.deepEqual(tagPublicationComponents(undefined, marker), [])
    assert.deepEqual(tagPublicationComponents([], marker), [])
    const payload = publicationCreatePayload(
        {
            content: "Zápas teď není dostupný.",
            allowedMentions: { roles: ["1"] },
        },
        marker
    )
    assert.deepEqual(payload.components, [])
    assert.deepEqual(payload.allowedMentions, { roles: ["1"] })
})

const sent = (
    id: string,
    author: string,
    components: Array<{ toJSON(): unknown }>
) => ({ id, author: { id: author }, components })
const tagged = (forMarker: string) => ({
    toJSON: () => ({
        type: 17,
        id: publicationComponentId(forMarker),
        components: [],
    }),
})

test("an uncertain create is recovered by the invisible id on the bot's own message", () => {
    const messages = [
        sent("1", bot, [tagged("logi:publication:other:1")]),
        sent("2", "someone-else", [tagged(marker)]),
        sent("3", bot, [tagged(marker)]),
        sent("4", bot, []),
    ]
    assert.equal(findPublicationMessage(messages, marker, bot), "3")
    assert.equal(
        findPublicationMessage(messages.slice(0, 2), marker, bot),
        null
    )
})

test("the old visible marker button is never searched for", () => {
    const legacy = sent("5", bot, [
        {
            toJSON: () => ({
                type: 1,
                components: [
                    {
                        type: 2,
                        style: 2,
                        label: "Automatic updates",
                        custom_id: marker,
                        disabled: true,
                    },
                ],
            }),
        },
    ])
    assert.equal(findPublicationMessage([legacy], marker, bot), null)
})

test("two messages with the same id need an operator instead of a guess", () => {
    assert.throws(
        () =>
            findPublicationMessage(
                [
                    sent("6", bot, [tagged(marker)]),
                    sent("7", bot, [tagged(marker)]),
                ],
                marker,
                bot
            ),
        /operator reconciliation/
    )
})
