import assert from "node:assert/strict"
import test from "node:test"

import {
    panelPartKeyPrefix,
    panelPublicationKey,
    publicationKeyRange,
} from "./keys"

test("a key prefix becomes a half-open index range ending at the next character", () => {
    assert.deepEqual(publicationKeyRange("seed:"), {
        start: "seed:",
        end: "seed;",
    })
    assert.deepEqual(publicationKeyRange("panel:abc"), {
        start: "panel:abc",
        end: "panel:abd",
    })
    assert.deepEqual(publicationKeyRange("league:"), {
        start: "league:",
        end: "league;",
    })
    assert.equal(publicationKeyRange(""), null)
})

test("the range holds exactly the keys that start with the prefix", () => {
    const keys = [
        "calendar",
        "event:events:1:announcement",
        "league:leagueTrackedMatches:1",
        "panel:a",
        "panel:a:result:events:1",
        "panel:ab",
        "panel:b:standings",
        "panels",
        "seed:call:run-1",
        "seed:control:gameDataConnections:1",
        "seed;odd",
        "seedling",
    ]
    for (const prefix of [
        "seed:",
        "seed:call:",
        "panel:",
        "panel:a",
        panelPublicationKey("a"),
        panelPartKeyPrefix("a"),
        "league:",
        "calendar",
    ]) {
        const range = publicationKeyRange(prefix)
        assert.ok(range, prefix)
        assert.deepEqual(
            keys.filter((key) => key >= range.start && key < range.end),
            keys.filter((key) => key.startsWith(prefix)),
            prefix
        )
    }
})

test("panel keys name the panel's own message and the start of its parts", () => {
    assert.equal(
        panelPublicationKey("discordPublicPanels:9"),
        "panel:discordPublicPanels:9"
    )
    assert.equal(
        panelPartKeyPrefix("discordPublicPanels:9"),
        "panel:discordPublicPanels:9:"
    )
})
