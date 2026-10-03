import { warconLive } from "../../../src/infrastructure/testing/warcon"
import { renderPanel, renderPlayers, factionIcon } from "./render"
import assert from "node:assert/strict"
import test from "node:test"
test("a one-page private response has unique custom IDs even when both navigation buttons are disabled", () => {
    const live = {
        ...warconLive(),
        freshness: "fresh" as const,
        playersFreshness: "fresh" as const,
    }
    const ids = renderPlayers("panel", live, 0)
        .components[0].toJSON()
        .components.map((c) => ("custom_id" in c ? c.custom_id : undefined))
    assert.equal(new Set(ids).size, ids.length)
})
test("compact live panel preserves zero, escapes source text, labels freshness and omits private identifiers", () => {
    const live = {
        ...warconLive(),
        freshness: "fresh" as const,
        playersFreshness: "stale" as const,
    }
    live.status!.serverName = "@everyone **Host**"
    const data = renderPanel(
        {
            id: "panel",
            gameId: "wardogs",
            enabled: true,
            showPlayers: true,
            artwork: false,
        },
        null,
        live
    )
    const json = JSON.stringify(data)
    assert.match(json, /in progress/)
    assert.ok(!json.includes(live.players[0].steamId))
    assert.ok(!json.includes("@everyone"))
    assert.ok(!json.includes('"embeds"'))
    assert.equal(data.allowedMentions?.parse?.length, 0)
    assert.match(JSON.stringify(renderPlayers("panel", live, 0)), /stale/i)
})
test("unknown faction never gets a faction icon based on score ordering", () => {
    const icons = { valkyra: "<:valkyra:123>", manticore: "<:manticore:456>" }
    assert.equal(factionIcon("Alpha", icons), "◈")
    assert.equal(factionIcon("Valkyra", icons), icons.valkyra)
})

test("private player pages stay within Discord's content limit for maximum-length provider fields", () => {
    const live = {
        ...warconLive(),
        freshness: "fresh" as const,
        playersFreshness: "fresh" as const,
    }
    live.players = Array.from({ length: 16 }, (_, index) => ({
        ...live.players[0],
        steamId: `7656119800000000${index}`,
        name: "*".repeat(200),
        faction: "_".repeat(200),
        kills: Number.MAX_SAFE_INTEGER,
        deaths: Number.MAX_SAFE_INTEGER,
        cash: Number.MAX_VALUE,
        ping: Number.MAX_VALUE,
    }))
    const first = renderPlayers("panel", live, 0)
    const last = renderPlayers("panel", live, 99)
    assert.ok(
        first.content.length <= 2000,
        `Discord content limit exceeded: ${first.content.length}`
    )
    assert.ok(last.content.length <= 2000)
    assert.match(last.content, /2\/2/)
    assert.ok(!first.content.includes(live.players[0].steamId))
})
test("missing source remains unavailable, not zero or offline; disabled panel has no player action", () => {
    const text = JSON.stringify(
        renderPanel(
            {
                id: "p",
                gameId: "hell_let_loose",
                enabled: false,
                showPlayers: true,
                artwork: false,
            },
            null,
            null
        )
    )
    assert.match(text, /Paused/)
    assert.ok(!text.includes("logi:players"))
    const unavailable = JSON.stringify(
        renderPanel(
            {
                id: "p",
                gameId: "wardogs",
                enabled: true,
                showPlayers: true,
                artwork: false,
            },
            null,
            null
        )
    )
    assert.match(unavailable, /unavailable/)
    assert.ok(!unavailable.includes("0/"))
})
