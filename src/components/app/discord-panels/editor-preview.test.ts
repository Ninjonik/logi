import assert from "node:assert/strict"
import test from "node:test"

import type { LiveServerFacts } from "@/domain/discord-publications/live-panel"
import { newPanelDraft } from "@/domain/discord-publications/panel-editor"
import { renderedView } from "@/infrastructure/testing/message-views"

import {
    combinedPreview,
    liveServerPreview,
    previewBannerModel,
    previewScoreModel,
    type EditorPreviewInput,
} from "./editor-preview"

const now = Date.parse("2026-10-05T16:00:00.000Z")
const hll: LiveServerFacts = {
    game: "hell_let_loose",
    serverName: "Vlci #1 · Public",
    freshness: "fresh",
    dataAt: now - 3_000,
    map: { name: "Foy", key: "foy" },
    mode: "warfare",
    lighting: "day",
    nextMap: { name: "Carentan", mode: "warfare", lighting: "night" },
    players: 78,
    capacity: 100,
    queue: 3,
    timeLeftSeconds: 49 * 60,
    hll: { allies: 3, axis: 2, nations: { allies: "us", axis: "ger" } },
    wardogs: null,
    roster: [
        {
            id: null,
            name: "Rex_CZ",
            side: "allies",
            kills: 31,
            deaths: 4,
            cash: null,
        },
        {
            id: null,
            name: "Hans_88",
            side: "axis",
            kills: 28,
            deaths: 6,
            cash: null,
        },
    ],
    rosterFresh: true,
    rosterAt: now - 3_000,
}
const wardogs: LiveServerFacts = {
    ...hll,
    game: "wardogs",
    serverName: "Vlci WD",
    freshness: "stale",
    dataAt: now - 6 * 60_000,
    map: { name: "Zestafona", key: "zestafona" },
    players: 17,
    capacity: 98,
    queue: null,
    hll: null,
    wardogs: {
        factions: [
            { key: "valkyra", name: "Valkyra", points: 23 },
            { key: "manticore", name: "Manticore", points: 12 },
        ],
    },
    roster: [],
    rosterFresh: false,
}
const input = (
    overrides: Partial<EditorPreviewInput> = {}
): EditorPreviewInput => ({
    draft: {
        ...newPanelDraft({ connectionId: "hll-1" }),
        channelId: "123456789012345678",
        description: "Veřejný server klanu Vlci.",
        style: "b",
    },
    panelId: "p1",
    revision: 3,
    language: "cs",
    timeZone: "Europe/Prague",
    clanName: "Vlci",
    clanTag: "VLK",
    defaultStyle: "a",
    now,
    channelPrivate: false,
    servers: {
        "hll-1": {
            connectionId: "hll-1",
            name: "Vlci #1 · Public",
            gameId: "hell_let_loose",
            joinUrl: "https://logi.app/join/vlci-1",
            address: "203.0.113.24:7777",
            joinCode: null,
            hasPassword: true,
        },
        "wd-1": {
            connectionId: "wd-1",
            name: "Vlci WD",
            gameId: "wardogs",
            joinUrl: "https://logi.app/join/vlci-wd",
            address: null,
            joinCode: "VLCI-7Q2",
            hasPassword: false,
        },
    },
    facts: { "hll-1": hll, "wd-1": wardogs },
    seeds: {},
    liveFrom: {},
    images: { score: null, banner: null },
    assetOrigin: "https://logi.app",
    ...overrides,
})

test("the live preview is the bot's own view with the unsaved settings (P2-27, P2-B09)", () => {
    const view = liveServerPreview(input())!
    const rendered = renderedView(view, "cs")
    assert.ok(rendered.validation.ok, JSON.stringify(rendered.validation))
    assert.equal(view.header?.title, "Vlci #1 · Public")
    assert.match(rendered.text, /Veřejný server klanu Vlci\./)
    assert.match(rendered.text, /203\.0\.113\.24:7777/)
    assert.ok(
        rendered.buttons.some(
            (button) =>
                button.kind === "link" &&
                button.url === "https://logi.app/join/vlci-1"
        )
    )
    // A public channel never shows the password, even with the switch on.
    const withSwitch = input()
    withSwitch.draft = {
        ...withSwitch.draft,
        content: { ...withSwitch.draft.content, password: true },
    }
    assert.doesNotMatch(
        renderedView(liveServerPreview(withSwitch)!).text,
        /Heslo/
    )
    // In a private channel the preview masks it; the value never reaches the page.
    const masked = renderedView(
        liveServerPreview({ ...withSwitch, channelPrivate: true })!
    ).text
    assert.match(masked, /••••••/)
    // Switching the address off removes it.
    const off = input()
    off.draft = {
        ...off.draft,
        content: { ...off.draft.content, address: false },
    }
    assert.doesNotMatch(
        renderedView(liveServerPreview(off)!).text,
        /203\.0\.113/
    )
})

test("style A asks for the score image; style B without its own banner for a generated one", () => {
    const a = input()
    a.draft = { ...a.draft, style: null }
    const model = previewScoreModel(a, "#E8A33D")
    assert.equal(model?.game, "hell_let_loose")
    assert.equal(model?.serverName, "Vlci #1 · Public")
    assert.deepEqual(model?.background, {
        kind: "builtin",
        game: "hell_let_loose",
        mapKey: "foy",
    })
    assert.equal(previewBannerModel(a, "#E8A33D"), null)
    const b = input()
    assert.equal(previewScoreModel(b, null), null)
    // P8-07: the badge the page computed (the team short code), not a local rule.
    assert.equal(previewBannerModel(b, null)?.clanTag, "VLK")
    b.draft = { ...b.draft, bannerUrl: "https://cdn.example/b.webp" }
    assert.equal(previewBannerModel(b, null), null)
})

test("Naše servery: rows in the chosen order with address, join code and seed bar (P2-43..45)", () => {
    const value = input({
        seeds: { "wd-1": { liveFrom: 40 } },
    })
    value.draft = {
        ...newPanelDraft({ kind: "servers" }),
        channelId: "123456789012345678",
        connectionIds: ["wd-1", "hll-1"],
    }
    const view = combinedPreview(value)!
    const rendered = renderedView(view, "cs")
    assert.ok(rendered.validation.ok, JSON.stringify(rendered.validation))
    assert.ok(
        rendered.text.indexOf("Vlci WD") < rendered.text.indexOf("Vlci #1")
    )
    assert.match(rendered.text, /VLCI-7Q2/)
    assert.match(rendered.text, /203\.0\.113\.24:7777/)
    assert.match(rendered.text, /\*\*3 : 2\*\*/)
    // P7-20: a join button per server; Wardogs opens the page with its code.
    assert.deepEqual(
        rendered.buttons.map((button) => button.label),
        ["Připojit: Vlci WD", "Připojit: Vlci #1"]
    )
    assert.doesNotMatch(rendered.text, /Heslo/)
})
