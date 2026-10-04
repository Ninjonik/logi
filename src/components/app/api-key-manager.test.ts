import { renderToStaticMarkup } from "react-dom/server"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

import { getDictionary } from "@/i18n/dictionaries"
import { ApiKeyManager } from "./api-key-manager"

for (const [locale, readOnly, createLabel] of [
    ["en", "Read-only", "Create read-only key"],
    ["cs", "Pouze pro čtení", "Vytvořit klíč pro čtení"],
    ["de", "Nur lesen", "Leseschlüssel erstellen"],
] as const) {
    test(`API key form starts with localized read-only access in ${locale}`, () => {
        const props = {
            serverId: "fixture-server",
            dictionary: getDictionary(locale),
        }
        const markup = renderToStaticMarkup(createElement(ApiKeyManager, props))
        assert.ok(markup.includes(readOnly))
        assert.ok(markup.includes(createLabel))
        assert.match(markup, /<button[^>]*disabled=""/)
        const checked =
            markup.match(/<button[^>]*aria-checked="true"[^>]*>/g) ?? []
        assert.equal(
            checked.length,
            2,
            "only the two summary resources are selected; games require an explicit choice"
        )
        for (const resource of ["event-summaries", "match-summaries"])
            assert.ok(
                checked.some((control) => control.includes(`-${resource}`))
            )
        assert.doesNotMatch(markup, /A key can read your clan’s website data/)
    })
}
