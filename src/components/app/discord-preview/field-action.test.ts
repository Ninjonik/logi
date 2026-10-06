import assert from "node:assert/strict"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"

import { csMessages } from "@/i18n/messages/cs"

import { DiscordMessagePreview } from "./discord-message-preview"

test("the preview draws a field's button on the right of the row", () => {
    const html = renderToStaticMarkup(
        createElement(DiscordMessagePreview, {
            view: {
                accent: "clan",
                ephemeral: true,
                header: { title: "Herní účty" },
                blocks: [
                    {
                        kind: "fields",
                        items: [
                            {
                                title: "O tobě",
                                chip: { label: "hotovo", tone: "success" },
                                text: "Hráč 17",
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
            },
            language: "cs",
            labels: csMessages.discordPreview,
        })
    )
    const text = html.replace(/<[^>]+>/g, " ")
    assert.match(text, /O tobě/)
    assert.match(text, /hotovo/)
    assert.match(text, /Upravit/)
    assert.ok(html.indexOf("O tobě") < html.indexOf("Upravit"))
})
