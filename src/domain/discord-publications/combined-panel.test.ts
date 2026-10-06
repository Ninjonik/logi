import assert from "node:assert/strict"
import test from "node:test"

import {
    combinedPanelView,
    combinedThumbnailBudget,
    type CombinedServer,
} from "./combined-panel"
import { renderedView } from "../../infrastructure/testing/message-views"
import { hllLiveFixture } from "../../infrastructure/testing/hll-live"
import { getPanelMessages } from "../../lib/clan-language/panels"
import { hllLiveFacts } from "./live-panel"

const now = Date.parse("2026-10-04T00:00:30.000Z")

function server(
    index: number,
    overrides: Partial<CombinedServer> = {}
): CombinedServer {
    const live = hllLiveFixture()
    live.status!.playerCount = 78
    live.status!.queueCount = 3
    return {
        connectionId: `c${index}`,
        title: `Vlci #${index}`,
        facts: hllLiveFacts(live),
        paused: false,
        seed: null,
        liveFrom: 40,
        joinUrl: `https://logi.app/join/vlci-${index}`,
        joinable: true,
        thumbnail: null,
        ...overrides,
    }
}

const base = {
    copy: getPanelMessages("cs").live,
    language: "cs",
    clanName: "Vlci",
    title: null,
    description: null,
    accentColor: null,
    footerTiming: true,
    now,
    banner: null,
}

test("Naše servery lists every server with its chip and a join button each", () => {
    const empty = server(3)
    empty.facts = { ...empty.facts, players: 0, queue: null }
    const view = renderedView(
        combinedPanelView({ ...base, servers: [server(1), server(2), empty] })
    )
    assert.deepEqual(view.validation, { ok: true, issues: [] })
    assert.match(view.text, /NAŠE SERVERY · VLCI/)
    assert.match(view.text, /Kde se hraje/)
    assert.match(view.text, /Vlci #1/)
    assert.match(view.text, /Hell Let Loose · .* · 78 \/ 100 · fronta 3/)
    assert.match(view.text, /Prázdný/)
    assert.match(view.text, /obnovuje se každých 60 s/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Připojit: Vlci #1", "Připojit: Vlci #2", "Připojit: Vlci #3"]
    )
})

test("public data only: no player names, no password, no clan match", () => {
    const view = renderedView(
        combinedPanelView({ ...base, servers: [server(1)] })
    )
    assert.doesNotMatch(view.text, /Synthetic Allied|Heslo|probíhá/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Připojit se"]
    )
})

test("ten servers fit in two rows of five join buttons", () => {
    const view = combinedPanelView({
        ...base,
        servers: Array.from({ length: 10 }, (_, i) => server(i + 1)),
    })
    const rows = view.blocks.filter((block) => block.kind === "buttons")
    assert.equal(rows.length, 2)
    assert.ok(
        rows.every((row) => row.kind === "buttons" && row.buttons.length <= 5)
    )
    assert.deepEqual(renderedView(view).validation, { ok: true, issues: [] })
})

test("an unavailable or unjoinable server has no join button and says why", () => {
    const down = server(2)
    down.facts = { ...down.facts, freshness: "unavailable" }
    const view = renderedView(
        combinedPanelView({
            ...base,
            servers: [server(1, { joinable: false }), down],
        })
    )
    assert.match(view.text, /server neodpovídá/)
    assert.match(view.text, /Nedostupný/)
    assert.deepEqual(view.buttons, [])
})

const map = (index: number) => ({
    url: `attachment://mapa-utah-${index}.webp`,
    description: "Utah Beach",
})

test("each row carries its map on the right while Discord's component limit allows", () => {
    const few = combinedPanelView({
        ...base,
        servers: [1, 2, 3].map((i) => server(i, { thumbnail: map(i) })),
    })
    const out = renderedView(few)
    assert.deepEqual(out.validation, { ok: true, issues: [] })
    assert.equal(
        out.layout.nodes.filter((node) => node.type === "section").length,
        3
    )
    const many = combinedPanelView({
        ...base,
        servers: Array.from({ length: 10 }, (_, i) =>
            server(i + 1, { thumbnail: map(i + 1) })
        ),
    })
    const crowded = renderedView(many)
    assert.deepEqual(crowded.validation, { ok: true, issues: [] })
    const sections = crowded.layout.nodes.filter(
        (node) => node.type === "section"
    ).length
    assert.equal(
        sections,
        combinedThumbnailBudget({
            servers: 10,
            joinButtons: 10,
            banner: false,
            description: false,
        })
    )
    assert.ok(sections < 10)
    // An unreachable server shows no map.
    const down = server(1, { thumbnail: map(1) })
    down.facts = { ...down.facts, freshness: "unavailable" }
    assert.equal(
        renderedView(combinedPanelView({ ...base, servers: [down] })).media
            .length,
        0
    )
})

test("rows show the address, the join code and a running seed; only HLL servers get a join button (P2-39, P2-43..45)", () => {
    const wardogs = server(3, {
        title: "Vlci WD",
        joinCode: "VLCI-7Q2",
    })
    wardogs.facts = { ...wardogs.facts, game: "wardogs", hll: null }
    const seeding = server(2, {
        title: "Vlci #2 · Trénink a zápasy",
        seed: { liveFrom: 40 },
        seedBar: "▰▰▰▱▱▱▱▱▱▱",
        address: "203.0.113.24:7787",
    })
    seeding.facts = { ...seeding.facts, players: 12 }
    const view = renderedView(
        combinedPanelView({
            ...base,
            show: { score: true, nextMap: false, queue: true },
            servers: [
                server(1, {
                    title: "Vlci #1 · Public",
                    address: "203.0.113.24:7777",
                }),
                seeding,
                wardogs,
            ],
        })
    )
    assert.deepEqual(view.validation, { ok: true, issues: [] })
    assert.match(view.text, /Adresa `203\.0\.113\.24:7777`/)
    assert.match(view.text, /▰▰▰▱▱▱▱▱▱▱ \*\*12 \/ 40\*\*/)
    assert.match(view.text, /Join kód `VLCI-7Q2`/)
    assert.match(view.text, /Spojenci \d+ : \d+ Osa/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Připojit: Vlci #1", "Připojit: Vlci #2"]
    )
})

test("the score, next map and queue follow the panel's switches (P2-38)", () => {
    const quiet = renderedView(
        combinedPanelView({
            ...base,
            show: { score: false, nextMap: false, queue: false },
            servers: [server(1)],
        })
    )
    assert.doesNotMatch(quiet.text, /fronta|Spojenci/)
})
