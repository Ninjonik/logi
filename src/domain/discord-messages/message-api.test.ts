import assert from "node:assert/strict"
import test from "node:test"

import { getDirectMessages } from "@/lib/clan-language/direct-messages"
import { getSystemMessages } from "@/lib/clan-language/system"

import { COMPONENTS_V2_FLAG, messageApiBody } from "./message-api"
import { trainingResultView } from "./direct-message-views"

const layout = { copy: getSystemMessages("cs").kit, locale: "cs-CZ" }

test("the web sends the same card as the bot: one container, V2 flag, no pings", () => {
    const body = messageApiBody(
        trainingResultView({
            title: "Trénink · komunikace a souhra",
            gameStart: "2026-10-12T17:00:00.000Z",
            passed: true,
            rewardRoles: ["Pěchota"],
            copy: getDirectMessages("cs"),
            frame: { clanName: "Vlci", timeZone: "Europe/Prague" },
        }),
        layout
    )
    assert.equal(body.flags, COMPONENTS_V2_FLAG)
    assert.deepEqual(body.allowed_mentions, { parse: [] })
    const [container] = body.components
    assert.equal(container!.type, 17)
    assert.equal(container!.accent_color, 0xe8a33d)
    const texts = container!.components.map(
        (item) => (item as { content?: string }).content
    )
    assert.match(texts[0]!, /VÝSLEDEK TRÉNINKU/)
    assert.match(
        texts.join("\n"),
        /🟢 \*\*Splněno\*\* · máš novou roli \*\*@Pěchota\*\*/
    )
    assert.equal(texts.at(-1), "-# Klan Vlci · Nastavit zprávy")
})

test("buttons, links and selects become their API components", () => {
    const body = messageApiBody(
        {
            accent: "clan",
            ephemeral: true,
            blocks: [
                {
                    kind: "buttons",
                    buttons: [
                        {
                            kind: "action",
                            id: "a:1",
                            label: "Potvrdím",
                            style: "primary",
                        },
                        {
                            kind: "link",
                            url: "https://logi.example",
                            label: "Web",
                        },
                    ],
                },
                {
                    kind: "select",
                    select: {
                        id: "s:1",
                        placeholder: "Vyber",
                        options: [
                            { value: "1", label: "Jedna", default: true },
                        ],
                    },
                },
            ],
        },
        layout
    )
    assert.equal(body.flags, COMPONENTS_V2_FLAG | 64)
    const [row, select] = body.components[0]!.components as Array<{
        components: Array<Record<string, unknown>>
    }>
    assert.deepEqual(row!.components, [
        {
            type: 2,
            label: "Potvrdím",
            disabled: false,
            style: 1,
            custom_id: "a:1",
        },
        {
            type: 2,
            label: "Web",
            disabled: false,
            style: 5,
            url: "https://logi.example",
        },
    ])
    assert.equal(select!.components[0]!.type, 3)
})
