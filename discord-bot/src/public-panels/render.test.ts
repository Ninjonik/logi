import assert from "node:assert/strict"
import test from "node:test"

import {
    hllLiveFacts,
    wardogsLiveFacts,
} from "../../../src/domain/discord-publications/live-panel"
import { hllLiveFixture } from "../../../src/infrastructure/testing/hll-live"
import { artworkPath, panelPlayersView, playerListSides } from "./render"
import { warconLive } from "../../../src/infrastructure/testing/warcon"
import { renderMessageView } from "../ui/message-kit"

type Json = Record<string, unknown>
function nodes(value: unknown): Json[] {
    if (!value || typeof value !== "object") return []
    if (Array.isArray(value)) return value.flatMap(nodes)
    const record = value as Json
    return [record, ...nodes(record.components), ...nodes(record.accessory)]
}
const rendered = (view: Parameters<typeof renderMessageView>[0]) =>
    nodes(renderMessageView(view, { language: "cs" }).container.toJSON())
const textOf = (all: Json[]) =>
    all
        .map((node) => node.content)
        .filter((content): content is string => typeof content === "string")
        .join("\n")

const panel = { _id: "panel-1", revision: 4, title: "Vlci #1" }

function hllFacts(players = 2) {
    const live = hllLiveFixture()
    live.players = Array.from({ length: players }, (_, index) => ({
        playerId: `7656119800000${String(index).padStart(4, "0")}`,
        name: index === 0 ? "Rex_*CZ*" : `Hráč ${index}`,
        team: index % 2 ? "axis" : "allies",
        kills: 100 - index,
        deaths: index,
        combat: null,
        offense: null,
        defense: null,
        support: null,
    }))
    live.status!.playerCount = players
    return hllLiveFacts(live)
}

test("the private player list is paged by eight with unique control IDs", () => {
    const view = panelPlayersView({
        panel,
        serverName: null,
        facts: hllFacts(78),
        page: 0,
        language: "cs",
        emoji: {},
    })
    assert.equal(view.ephemeral, true)
    const all = rendered(view)
    const text = textOf(all)
    assert.match(text, /HRÁČI NA SERVERU · VLCI #1/)
    assert.match(text, /SPOJENCI · 39/)
    assert.match(text, /OSA · 39/)
    assert.match(text, /Řazeno podle zabití, 8 hráčů na stránku/)
    // Provider text is escaped; platform IDs never reach the reply.
    assert.match(text, /Rex\\_\\\*CZ\\\*/)
    assert.doesNotMatch(JSON.stringify(all), /76561198/)
    const buttons = all.filter((node) => node.type === 2)
    assert.deepEqual(
        buttons.map((button) => [button.label, button.disabled ?? false]),
        [
            ["Předchozí", true],
            ["1 / 10", true],
            ["Další", false],
        ]
    )
    const ids = buttons.map((button) => button.custom_id)
    assert.equal(new Set(ids).size, ids.length)
    assert.equal(ids[2], "logi:players:panel-1:4:1:next")
    const rows = text.split("\n").filter((line) => / · \d+ \/ \d+$/.test(line))
    assert.equal(rows.length, 8)
})

test("a one-page list keeps unique IDs although both arrows are disabled", () => {
    const all = rendered(
        panelPlayersView({
            panel,
            serverName: null,
            facts: hllFacts(2),
            page: 0,
            language: "cs",
            emoji: {},
        })
    )
    const buttons = all.filter((node) => node.type === 2)
    assert.ok(buttons.every((button) => button.disabled === true))
    const ids = buttons.map((button) => button.custom_id)
    assert.equal(new Set(ids).size, 3)
})

test("an old panel or a failed read gets its own card, never an empty list", () => {
    const outdated = textOf(
        rendered(
            panelPlayersView({
                panel,
                serverName: null,
                facts: null,
                page: 0,
                language: "cs",
                emoji: {},
            })
        )
    )
    const stale = hllFacts(4)
    stale.rosterFresh = false
    const unavailable = textOf(
        rendered(
            panelPlayersView({
                panel,
                serverName: null,
                facts: stale,
                page: 0,
                language: "cs",
                emoji: {},
            })
        )
    )
    assert.notEqual(outdated, unavailable)
    assert.doesNotMatch(unavailable, /SPOJENCI/)
})

test("Wardogs lists players by faction with kills and money now", () => {
    const data = {
        ...warconLive(),
        freshness: "fresh" as const,
        playersFreshness: "fresh" as const,
    }
    const facts = wardogsLiveFacts(data)
    const sides = playerListSides(facts, {}, "cs")
    assert.deepEqual(
        sides.map((side) => side.key),
        ["Alpha", "Bravo", "Charlie"]
    )
    const text = textOf(
        rendered(
            panelPlayersView({
                panel,
                serverName: "Vlci WD",
                facts,
                page: 0,
                language: "cs",
                emoji: {},
            })
        )
    )
    assert.match(text, /Synthetic Ranger\*\* · 0 \/ 350/)
})

test("HLL sides use the map's nation emoji when installed, else the side glyph", () => {
    const facts = hllFacts(2)
    const plain = playerListSides(facts, {}, "cs")
    assert.deepEqual(
        plain.map((side) => side.sign),
        ["★", "✚"]
    )
    const nation = facts.hll!.nations.allies
    const styled = playerListSides(facts, { [nation]: "<:us:1>" }, "cs")
    assert.equal(styled[0]?.sign, "<:us:1>")
})

test("packaged map art resolves per game", () => {
    assert.equal(
        artworkPath("wardogs", "Zestafona"),
        "/maps/wardogs/zestafona.webp"
    )
    assert.equal(artworkPath("wardogs", "unknown"), "/img/games/wardogs.jpg")
    assert.equal(artworkPath("other", "Foy"), null)
})
