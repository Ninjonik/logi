import { renderToStaticMarkup } from "react-dom/server"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

import { getDictionary } from "@/i18n/dictionaries"
import { TeamDirectory } from "./team-directory"

const render = (initialSearch?: string) =>
    renderToStaticMarkup(
        createElement(TeamDirectory, {
            serverId: "fixture-server",
            locale: "cs",
            dictionary: getDictionary("cs"),
            settingsHref: "/cs/dashboard/servers/fixture-server/settings/games",
            sections: [{ gameId: "hell_let_loose", enabled: true }],
            initialSearch,
        })
    )

test("a team link from Discord opens the catalogue already searched for the team (L5-39)", () => {
    const markup = render("Vlci")
    assert.match(markup, /<input[^>]*type="search"[^>]*value="Vlci"/)
    // Without the link the search starts empty.
    assert.match(render(), /<input[^>]*type="search"[^>]*value=""/)
})
