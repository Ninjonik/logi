import assert from "node:assert/strict"
import test from "node:test"

import { ComponentType, MessageFlags } from "discord.js"

import {
    errorCard,
    panelFrame,
    unknownErrorCard,
    type MessageView,
} from "../../../src/domain/discord-messages/message-view"
import {
    editPayload,
    interactionReplyPayload,
    messagePayload,
    renderMessageView,
} from "./message-kit"
import { InvalidMessageViewError } from "../../../src/domain/discord-messages/message-validation"
import { countLayoutComponents } from "../../../src/domain/discord-messages/message-layout"
import { getSystemMessages } from "../../../src/lib/clan-language/system"

type Json = Record<string, unknown> & { components?: Json[] }
/** The payload as Discord receives it (undefined fields dropped). */
const json = (payload: { components: { toJSON(): unknown }[] }) =>
    payload.components.map(
        (component) => JSON.parse(JSON.stringify(component.toJSON())) as Json
    )

/** Every component Discord counts, nested ones included. */
function countJson(components: Json[]): number {
    return components.reduce(
        (total, component) =>
            total +
            1 +
            countJson(component.components ?? []) +
            (component.accessory ? 1 : 0),
        0
    )
}

const updatedAt = "2026-10-11T18:00:00Z"
const liveScore = panelFrame({
    label: "Živé skóre · Hell Let Loose",
    title: "Vlci #1",
    state: {
        chip: { label: "Živě", tone: "success" },
        detail: "Foy · 36 / 100 hráčů · zbývá 49 min",
    },
    image: { url: "attachment://foy.webp", description: "mapa Foy" },
    content: [{ kind: "text", markdown: "**NEJVÍC ZABITÍ**\nRex_CZ · 31" }],
    actions: [
        [
            {
                kind: "action",
                id: "panel:1:players",
                label: "Zobrazit hráče",
                style: "secondary",
            },
            {
                kind: "action",
                id: "panel:1:report",
                label: "Nahlásit hráče",
                style: "secondary",
            },
        ],
    ],
    updatedAt,
    refreshSeconds: 60,
})

test("the unknown error is a private card in the clan colour and the clan language", () => {
    const copy = getSystemMessages("cs").errors
    const payload = interactionReplyPayload(
        unknownErrorCard({ title: copy.unknownTitle, body: copy.unknownBody }),
        { language: "cs" }
    )
    assert.equal(
        payload.flags,
        MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    )
    assert.deepEqual(payload.allowedMentions, { parse: [] })
    assert.deepEqual(json(payload), [
        {
            type: ComponentType.Container,
            accent_color: 0xe8a33d,
            components: [
                {
                    type: ComponentType.TextDisplay,
                    content: "### Tohle se nepovedlo",
                },
                {
                    type: ComponentType.TextDisplay,
                    content:
                        "Zkus to za chvíli znovu. Když to nepůjde, napiš správcům klanu.",
                },
            ],
        },
    ])
})

test("the panel frame becomes one container: section with map, content, divider, buttons, footer", () => {
    const payload = messagePayload(liveScore, { language: "cs" })
    assert.equal(payload.flags, MessageFlags.IsComponentsV2)
    const [container] = json(payload)
    assert.equal(container?.type, ComponentType.Container)
    assert.equal(container?.accent_color, 0xe8a33d)
    const children = container!.components!
    assert.deepEqual(
        children.map((child) => child.type),
        [
            ComponentType.Section,
            ComponentType.TextDisplay,
            ComponentType.Separator,
            ComponentType.ActionRow,
            ComponentType.TextDisplay,
        ]
    )
    assert.deepEqual(children[0], {
        type: ComponentType.Section,
        components: [
            {
                type: ComponentType.TextDisplay,
                content:
                    "-# **ŽIVÉ SKÓRE · HELL LET LOOSE**\n### Vlci #1\n🟢 **Živě** · Foy · 36 / 100 hráčů · zbývá 49 min",
            },
        ],
        accessory: {
            type: ComponentType.Thumbnail,
            media: { url: "attachment://foy.webp" },
            description: "mapa Foy",
        },
    })
    assert.deepEqual(children[2], {
        type: ComponentType.Separator,
        divider: true,
        spacing: 1,
    })
    assert.deepEqual(
        children[3]?.components?.map((button) => [
            button.label,
            button.style,
            button.custom_id,
        ]),
        [
            ["Zobrazit hráče", 2, "panel:1:players"],
            ["Nahlásit hráče", 2, "panel:1:report"],
        ]
    )
    assert.deepEqual(children[4], {
        type: ComponentType.TextDisplay,
        content:
            "-# Aktualizováno <t:1791741600:R> · obnovuje se každých 60 s · Spravováno v Logi",
    })
})

test("the domain's component count matches what discord.js sends", () => {
    for (const view of [
        liveScore,
        unknownErrorCard({ title: "a", body: "b" }),
    ]) {
        const { layout, container } = renderMessageView(view)
        assert.equal(
            countJson(json({ components: [container] })),
            countLayoutComponents(layout)
        )
    }
})

test("button styles: one primary, grey secondary, red destructive, grey links with a URL", () => {
    const view: MessageView = {
        accent: "clan",
        ephemeral: true,
        header: { label: "Herní účty", title: "Steam je propojený" },
        blocks: [
            {
                kind: "buttons",
                buttons: [
                    {
                        kind: "action",
                        id: "plink:add",
                        label: "Přidat další účet",
                        style: "primary",
                    },
                    {
                        kind: "action",
                        id: "plink:remove",
                        label: "Odpojit účet",
                        style: "danger",
                    },
                    {
                        kind: "link",
                        url: "https://logi.app/cs/account",
                        label: "Otevřít v Logi",
                    },
                    {
                        kind: "action",
                        id: "plink:old",
                        label: "Neplatné",
                        style: "secondary",
                        disabled: true,
                    },
                ],
            },
        ],
    }
    const [container] = json(interactionReplyPayload(view))
    const row = container!.components!.at(-1)!
    assert.deepEqual(row.components, [
        {
            type: ComponentType.Button,
            label: "Přidat další účet",
            disabled: false,
            style: 1,
            custom_id: "plink:add",
        },
        {
            type: ComponentType.Button,
            label: "Odpojit účet",
            disabled: false,
            style: 4,
            custom_id: "plink:remove",
        },
        {
            type: ComponentType.Button,
            label: "Otevřít v Logi",
            disabled: false,
            style: 5,
            url: "https://logi.app/cs/account",
        },
        {
            type: ComponentType.Button,
            label: "Neplatné",
            disabled: true,
            style: 2,
            custom_id: "plink:old",
        },
    ])
})

test("system messages have the grey bar and a panel keeps its own colour", () => {
    const system = json(
        messagePayload({
            accent: "system",
            header: { title: "Chyba bota" },
            blocks: [],
        })
    )[0]
    assert.equal(system?.accent_color, 0x80848e)
    const custom = json(
        messagePayload(
            { ...liveScore, accent: { custom: "#4F9DE0" } },
            { style: { accentColor: "#112233" } }
        )
    )[0]
    assert.equal(custom?.accent_color, 0x4f9de0)
    const clan = json(
        messagePayload(liveScore, { style: { accentColor: "#112233" } })
    )[0]
    assert.equal(clan?.accent_color, 0x112233)
})

test("selects and galleries become rows and media galleries", () => {
    const [container] = json(
        interactionReplyPayload({
            accent: "clan",
            ephemeral: true,
            header: {
                label: "Nahlásit hráče · Vlci #1",
                title: "Koho chceš nahlásit?",
            },
            blocks: [
                {
                    kind: "gallery",
                    items: [
                        { url: "https://logi.app/a.png", description: "mapa" },
                    ],
                },
                {
                    kind: "select",
                    select: {
                        id: "report:pick",
                        placeholder: "Vyber hráče",
                        options: [
                            {
                                value: "1",
                                label: "Hans_88",
                                description: "Osa · na serveru",
                            },
                            { value: "other", label: "Jiný hráč" },
                        ],
                    },
                },
            ],
        })
    )
    const [, gallery, row] = container!.components!
    assert.deepEqual(gallery, {
        type: ComponentType.MediaGallery,
        items: [
            { media: { url: "https://logi.app/a.png" }, description: "mapa" },
        ],
    })
    assert.deepEqual(row?.components?.[0], {
        type: ComponentType.StringSelect,
        custom_id: "report:pick",
        min_values: 1,
        max_values: 1,
        disabled: false,
        placeholder: "Vyber hráče",
        options: [
            { value: "1", label: "Hans_88", description: "Osa · na serveru" },
            { value: "other", label: "Jiný hráč" },
        ],
    })
})

test("an edit clears content and embeds so a legacy message becomes the card", () => {
    const payload = editPayload(errorCard({ title: "A", body: "B" }), {
        language: "de",
    })
    assert.equal(payload.content, null)
    assert.deepEqual(payload.embeds, [])
    assert.equal(payload.flags, MessageFlags.IsComponentsV2)
})

test("the footer follows the clan language", () => {
    const footer = (language: string) =>
        json(messagePayload(liveScore, { language }))[0]!.components!.at(-1)!
            .content
    assert.equal(
        footer("en"),
        "-# Updated <t:1791741600:R> · refreshes every 60 s · Managed in Logi"
    )
    assert.equal(
        footer("de"),
        "-# Aktualisiert <t:1791741600:R> · wird alle 60 s aktualisiert · Verwaltet in Logi"
    )
})

test("a view that breaks the rules is never sent", () => {
    assert.throws(
        () =>
            messagePayload({
                accent: "clan",
                header: { title: "x" },
                blocks: [
                    {
                        kind: "buttons",
                        buttons: [
                            {
                                kind: "action",
                                id: "a",
                                label: "A",
                                style: "primary",
                            },
                            {
                                kind: "action",
                                id: "b",
                                label: "B",
                                style: "success",
                            },
                        ],
                    },
                ],
            }),
        InvalidMessageViewError
    )
    assert.throws(
        () =>
            messagePayload({
                accent: "clan",
                header: { title: "x" },
                blocks: [
                    {
                        kind: "buttons",
                        buttons: [
                            {
                                kind: "link",
                                url: "steam://connect/1",
                                label: "Připojit se",
                            },
                        ],
                    },
                ],
            }),
        /link-not-http/
    )
})
