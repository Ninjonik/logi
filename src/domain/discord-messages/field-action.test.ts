import assert from "node:assert/strict"
import test from "node:test"

import { getIntlLocaleForClanLanguage } from "../../lib/clan-language/core"
import { getSystemMessages } from "../../lib/clan-language/system"

import { countLayoutComponents, layoutMessageView } from "./message-layout"
import { validateMessageView } from "./message-validation"
import type { MessageView } from "./message-view"

const options = {
    copy: getSystemMessages("cs").kit,
    locale: getIntlLocaleForClanLanguage("cs"),
}

const view = (style: "secondary" | "primary"): MessageView => ({
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
                        style,
                    },
                },
                {
                    title: "Herní účty",
                    text: "Steam si můžeš ověřit přes web.",
                },
            ],
        },
        {
            kind: "buttons",
            buttons: [
                {
                    kind: "action",
                    id: "application:d:open:accounts",
                    label: "Pokračovat",
                    style: "primary",
                },
            ],
        },
    ],
})

test("a field with an action is a section with a button on the right", () => {
    const layout = layoutMessageView(view("secondary"), options)
    const section = layout.nodes.find((node) => node.type === "section-button")
    assert.ok(section && section.type === "section-button")
    assert.deepEqual(section.texts, ["**O tobě** · 🟢 **hotovo**\nHráč 17"])
    assert.equal(section.button.label, "Upravit")
    // Container, header, section (+ text + button), divider, text, row (+ button).
    assert.equal(countLayoutComponents(layout), 9)
})

test("field actions count towards the one primary action and unique IDs, not rows", () => {
    assert.deepEqual(validateMessageView(view("secondary"), options).issues, [])
    assert.deepEqual(
        validateMessageView(view("primary"), options).issues.map(
            (issue) => issue.code
        ),
        ["too-many-primary"]
    )
})
