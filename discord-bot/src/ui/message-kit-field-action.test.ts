import assert from "node:assert/strict"
import test from "node:test"

import { ButtonStyle, ComponentType } from "discord.js"

import { interactionReplyPayload } from "./message-kit"

type Json = Record<string, unknown> & {
    components?: Json[]
    accessory?: Json
}

test("a field action becomes a section with a button accessory", () => {
    const payload = interactionReplyPayload({
        accent: "clan",
        ephemeral: true,
        header: { title: "Zkontroluj a odešli" },
        blocks: [
            {
                kind: "fields",
                items: [
                    {
                        title: "O tobě",
                        text: "Hry: Hell Let Loose",
                        action: {
                            kind: "action",
                            id: "application:d:open:about",
                            label: "Upravit",
                            style: "secondary",
                        },
                    },
                ],
            },
        ],
    })
    const container = JSON.parse(
        JSON.stringify(payload.components[0]!.toJSON())
    ) as Json
    const section = container.components!.find(
        (component) => component.type === ComponentType.Section
    )
    assert.ok(section)
    assert.equal(
        section.components![0]!.content,
        "**O tobě**\nHry: Hell Let Loose"
    )
    assert.deepEqual(section.accessory, {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: "Upravit",
        custom_id: "application:d:open:about",
        disabled: false,
    })
})
