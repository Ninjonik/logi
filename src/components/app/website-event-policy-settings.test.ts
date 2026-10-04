import { renderToStaticMarkup } from "react-dom/server"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

import { WebsiteEventPolicySettings } from "./website-event-policy-settings"
import { getDictionary } from "@/i18n/dictionaries"

for (const locale of ["en", "cs", "de"] as const) {
    test(`website event policy form renders its localized intro and loading state in ${locale}`, () => {
        const dictionary = getDictionary(locale)
        const markup = renderToStaticMarkup(
            createElement(WebsiteEventPolicySettings, {
                serverId: "fixture-server",
                dictionary,
            })
        )
        assert.ok(markup.includes(dictionary.websiteEventPolicies.description))
        assert.ok(markup.includes(dictionary.websiteEventPolicies.loading))
        assert.match(markup, /<button[^>]*disabled=""/)
        assert.ok(!markup.includes("<form"))
    })
}
