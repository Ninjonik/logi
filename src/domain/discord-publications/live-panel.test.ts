import assert from "node:assert/strict"
import test from "node:test"

import {
    hllLiveFacts,
    liveLeaders,
    liveServerPanelView,
    liveServerState,
    snapshotLiveFacts,
    wardogsLiveFacts,
    type LiveServerFacts,
    type LiveServerPanelInput,
} from "./live-panel"
import { renderedView } from "../../infrastructure/testing/message-views"
import { hllLiveFixture } from "../../infrastructure/testing/hll-live"
import { getPanelMessages } from "../../lib/clan-language/panels"
import { warconLive } from "../../infrastructure/testing/warcon"
import { DEFAULT_PANEL_CONTENT } from "./settings"

const now = Date.parse("2026-10-04T00:00:30.000Z")

function hll(players = 78): LiveServerFacts {
    const live = hllLiveFixture()
    live.status!.playerCount = players
    live.status!.queueCount = 3
    live.status!.nextMap = {
        name: "Foy",
        layerId: "foy_warfare_night",
        mode: "warfare",
        environment: "night",
    }
    live.status!.environment = "day"
    return hllLiveFacts(live)
}

function input(
    overrides: Partial<Omit<LiveServerPanelInput, "panel">> & {
        panel?: Partial<LiveServerPanelInput["panel"]>
    } = {}
): LiveServerPanelInput {
    const { panel, ...rest } = overrides
    return {
        copy: getPanelMessages("cs").live,
        language: "cs",
        panel: {
            id: "panel-1",
            revision: 3,
            title: "Vlci #1 · Public",
            description: null,
            showPlayers: true,
            showLeaders: true,
            reportEnabled: true,
            layout: {
                showMap: true,
                showScoreboard: true,
                showPlayerCount: true,
                compact: false,
            },
            content: { ...DEFAULT_PANEL_CONTENT },
            accentColor: null,
            style: "b",
            ...panel,
        },
        facts: hll(),
        now,
        paused: false,
        privateChannel: false,
        seed: null,
        seedChannelId: null,
        liveFrom: 40,
        match: null,
        clanPlayers: null,
        server: {
            address: "203.0.113.24:7777",
            joinCode: null,
            password: null,
            joinUrl: "https://logi.app/join/vlci-1",
        },
        newMap: false,
        emoji: {},
        images: { score: null, banner: null, thumbnail: null },
        ids: {
            players: "logi:players:panel-1:3:0:open",
            report: "report:open:panel-1",
        },
        ...rest,
    }
}

test("HLL facts come only from what CRCON reports: queue, next map and day/night", () => {
    const facts = hll()
    assert.equal(facts.queue, 3)
    assert.equal(facts.lighting, "day")
    assert.equal(facts.nextMap?.name, "Foy")
    assert.equal(facts.nextMap?.lighting, "night")
    const bare = hllLiveFixture()
    const plain = hllLiveFacts(bare)
    assert.equal(plain.queue, null)
    assert.equal(plain.nextMap, null)
    const view = renderedView(
        liveServerPanelView(input({ facts: { ...plain, players: 50 } }))
    )
    assert.doesNotMatch(view.text, /fronta|Další mapa/)
})

test("the state chips follow P4-B01, paused first", () => {
    const facts = { freshness: "fresh" as const, players: 10 }
    const state = (
        f: Pick<LiveServerFacts, "freshness" | "players">,
        options: Partial<{ paused: boolean; seedActive: boolean }> = {}
    ) =>
        liveServerState(f, {
            paused: false,
            seedActive: false,
            liveFrom: 40,
            ...options,
        })
    assert.equal(state(facts), "live")
    assert.equal(state({ ...facts, players: 0 }), "empty")
    assert.equal(state(facts, { seedActive: true }), "seeding")
    assert.equal(state({ ...facts, players: 45 }, { seedActive: true }), "live")
    assert.equal(state({ ...facts, freshness: "unavailable" }), "offline")
    assert.equal(state({ ...facts, freshness: "stale" }), "stale")
    assert.equal(
        state({ ...facts, freshness: "unavailable" }, { paused: true }),
        "paused"
    )
})

test("a live public panel: chip, players, queue, score, leaders, next map, join, players and report", () => {
    const view = liveServerPanelView(input())
    const out = renderedView(view)
    assert.deepEqual(out.validation, { ok: true, issues: [] })
    assert.match(out.text, /ŽIVÝ SERVER · HELL LET LOOSE/)
    assert.match(out.text, /Vlci #1 · Public/)
    assert.match(out.text, /Živě/)
    assert.match(out.text, /78 \/ 100 hráčů · fronta 3 · zbývá 51 min/)
    assert.match(out.text, /Spojenci ★  \*\*3 : 2\*\*  ✚ Osa/)
    assert.match(out.text, /NEJVÍC ZABITÍ/)
    assert.match(out.text, /Další mapa: Foy · Warfare · Noc/)
    assert.match(out.text, /Adresa `203\.0\.113\.24:7777`/)
    assert.match(out.text, /obnovuje se každých 60 s/)
    assert.deepEqual(
        out.buttons.map((button) => button.label),
        ["Připojit se", "Zobrazit hráče", "Nahlásit hráče"]
    )
    const join = out.buttons[0]
    assert.ok(join?.kind === "link")
    assert.equal(join.url, "https://logi.app/join/vlci-1")
    // Grey link button, at most one primary and five buttons per row.
    assert.ok(
        out.buttons.every(
            (button) => button.kind === "link" || button.style !== "primary"
        )
    )
    assert.doesNotMatch(out.text, /76561198/)
})

test("the password never reaches a public panel, even with the switch on", () => {
    const content = { ...DEFAULT_PANEL_CONTENT, password: true }
    const server = {
        address: "203.0.113.24:7777",
        joinCode: null,
        password: "tajne123",
        joinUrl: "https://logi.app/join/vlci-1",
    }
    const open = renderedView(
        liveServerPanelView(input({ panel: { content }, server }))
    )
    assert.doesNotMatch(open.text, /tajne123/)
    const closed = renderedView(
        liveServerPanelView(
            input({ panel: { content }, server, privateChannel: true })
        )
    )
    assert.match(closed.text, /Heslo `tajne123`/)
    const off = renderedView(
        liveServerPanelView(
            input({
                panel: { content: DEFAULT_PANEL_CONTENT },
                server,
                privateChannel: true,
            })
        )
    )
    assert.doesNotMatch(off.text, /tajne123/)
})

test("the clan panel shows the running Logi match and who of the clan plays, no report button", () => {
    const view = renderedView(
        liveServerPanelView(
            input({
                privateChannel: true,
                match: {
                    title: "Vlci vs Rogue",
                    category: "Liga",
                    startedAt: now - 600_000,
                    allies: "VLK",
                    axis: "ROG",
                },
                clanPlayers: ["Rex_CZ", "Bizon"],
            })
        )
    )
    assert.match(view.text, /KLANOVÝ SERVER · HELL LET LOOSE/)
    assert.match(view.text, /Vlci vs Rogue/)
    assert.match(view.text, /probíhá od <t:\d+:t>/)
    assert.match(view.text, /\*\*VLK\*\* Spojenci/)
    assert.match(view.text, /Z KLANU HRAJE · 2/)
    assert.match(view.text, /Rex\\_CZ · Bizon/)
    assert.match(view.text, /další mapa Foy/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Připojit se", "Zobrazit hráče"]
    )
    // A public panel never shows clan-only facts.
    const open = renderedView(
        liveServerPanelView(
            input({
                match: {
                    title: "Vlci vs Rogue",
                    category: null,
                    startedAt: now,
                    allies: null,
                    axis: null,
                },
                clanPlayers: ["Rex_CZ"],
            })
        )
    )
    assert.doesNotMatch(open.text, /Vlci vs Rogue|Z KLANU HRAJE/)
})

test("an empty server says so, offers the seed channel and hides list buttons", () => {
    const view = renderedView(
        liveServerPanelView(
            input({
                facts: { ...hll(0), roster: [] },
                seedChannelId: "123456789012345678",
            })
        )
    )
    assert.match(view.text, /Prázdný/)
    assert.match(view.text, /Na serveru teď nikdo nehraje\./)
    assert.match(view.text, /<#123456789012345678>/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Připojit se"]
    )
})

test("a running seed shows Seedujeme, the progress bar and the call link", () => {
    const view = renderedView(
        liveServerPanelView(
            input({
                facts: hll(12),
                seed: {
                    startedAt: now - 300_000,
                    liveFrom: 40,
                    bar: "▰▰▰▱▱▱▱▱▱▱",
                    callUrl: "https://discord.com/channels/1/2/3",
                    channelId: "223456789012345678",
                },
            })
        )
    )
    assert.match(view.text, /Seedujeme/)
    assert.match(view.text, /▰▰▰▱▱▱▱▱▱▱ \*\*12 \/ 40\*\*/)
    assert.match(view.text, /živý od 40/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Připojit se", "Otevřít výzvu"]
    )
    assert.doesNotMatch(view.text, /NEJVÍC ZABITÍ/)
})

test("an unavailable server keeps the last data time and has no buttons or refresh promise", () => {
    const facts = { ...hll(), freshness: "unavailable" as const }
    const view = renderedView(liveServerPanelView(input({ facts })))
    assert.match(view.text, /Nedostupný/)
    assert.match(view.text, /server neodpovídá · poslední data <t:\d+:f>/)
    assert.match(view.text, /Panel se obnoví sám/)
    assert.equal(view.buttons.length, 0)
    assert.doesNotMatch(view.text, /obnovuje se každých/)
})

test("a paused panel shows Pozastaveno with the last data and no player actions", () => {
    const view = renderedView(liveServerPanelView(input({ paused: true })))
    assert.match(view.text, /Pozastaveno/)
    assert.match(view.text, /správce zastavil obnovování/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Připojit se"]
    )
    assert.doesNotMatch(view.text, /obnovuje se každých/)
})

test("server status mode: score off reads Stav serveru and Online", () => {
    const view = renderedView(
        liveServerPanelView(
            input({
                panel: {
                    layout: {
                        showMap: true,
                        showScoreboard: false,
                        showPlayerCount: true,
                        compact: false,
                    },
                },
            })
        )
    )
    assert.match(view.text, /STAV SERVERU · HELL LET LOOSE/)
    assert.match(view.text, /Online/)
    assert.doesNotMatch(view.text, /3 : 2|NEJVÍC ZABITÍ/)
    // The board's status detail is the map and the players only (L3-43).
    assert.match(view.text, /Utah Beach · 78 \/ 100 hráčů · fronta 3/)
    assert.doesNotMatch(view.text, /zbývá/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Připojit se"]
    )
})

test("style A puts the score image first and keeps a short text; without it the text card returns", () => {
    const score = {
        url: "attachment://skore-panel-1-abc.png",
        description: "Skóre",
    }
    const withImage = renderedView(
        liveServerPanelView(
            input({
                panel: { style: "a" },
                images: { score, banner: null, thumbnail: null },
            })
        )
    )
    assert.equal(withImage.media[0], score.url)
    assert.doesNotMatch(withImage.text, /NEJVÍC ZABITÍ/)
    const fallback = renderedView(
        liveServerPanelView(input({ panel: { style: "a" } }))
    )
    assert.match(fallback.text, /NEJVÍC ZABITÍ/)
})

const SCORE_IMAGE = {
    url: "attachment://skore-panel-1-abc.png",
    description: "Skóre",
}
const styleA = (overrides: Parameters<typeof input>[0] = {}) =>
    renderedView(
        liveServerPanelView(
            input({
                ...overrides,
                panel: { style: "a", ...overrides.panel },
                images: { score: SCORE_IMAGE, banner: null, thumbnail: null },
            })
        )
    )

test("style A on an empty server keeps the empty sentence and shows no score (P4-16, P4-17)", () => {
    const view = styleA({
        facts: { ...hll(0), roster: [] },
        seedChannelId: "123456789012345678",
    })
    assert.equal(view.media[0], SCORE_IMAGE.url)
    assert.match(view.text, /Prázdný/)
    assert.match(
        view.text,
        /Na serveru teď nikdo nehraje\. Když ho správci rozjedou, výzva přijde do <#123456789012345678>\./
    )
    assert.doesNotMatch(view.text, /3 : 2|zbývá/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Připojit se"]
    )
})

test("style A while seeding keeps the seed bar and the seed lines (P4-18, P5-15, P5-17)", () => {
    const view = styleA({
        facts: hll(12),
        seed: {
            startedAt: now - 300_000,
            liveFrom: 40,
            bar: "▰▰▰▱▱▱▱▱▱▱",
            callUrl: "https://discord.com/channels/1/2/3",
            channelId: "223456789012345678",
        },
    })
    assert.match(view.text, /Seedujeme/)
    assert.match(view.text, /12 \/ 100 hráčů · živý od 40/)
    assert.match(view.text, /▰▰▰▱▱▱▱▱▱▱ \*\*12 \/ 40\*\*/)
    assert.match(view.text, /Připoj se a pomoz server nastartovat\./)
    assert.match(
        view.text,
        /Seed běží od <t:\d+:t>\. Výzva je v <#223456789012345678>\./
    )
    assert.doesNotMatch(view.text, /3 : 2/)
    assert.deepEqual(
        view.buttons.map((button) => button.label),
        ["Připojit se", "Otevřít výzvu"]
    )
})

test("style A in a clan channel keeps the running match with its chip and Z KLANU HRAJE (P4-23, P4-25, P4-B07)", () => {
    const panel = styleA({
        privateChannel: true,
        match: {
            title: "VLK vs ROG",
            category: "Přátelák",
            startedAt: now - 600_000,
            allies: "VLK",
            axis: "ROG",
        },
        clanPlayers: ["Rex_CZ", "Bizon"],
    })
    assert.match(panel.text, /VLK vs ROG/)
    assert.match(panel.text, /probíhá od <t:\d+:t>/)
    assert.match(panel.text, /Přátelák/, "the match's category chip")
    assert.match(panel.text, /Z KLANU HRAJE · 2/)
    assert.match(panel.text, /Rex\\_CZ · Bizon/)
    assert.match(panel.text, /VLK Spojenci ★  3 : 2  ✚ Osa ROG/)
})

test("style A for Wardogs names the map once, in the header (P7-16)", () => {
    const fixture = warconLive()
    const view = styleA({
        facts: wardogsLiveFacts({
            ...fixture,
            freshness: "fresh" as const,
            playersFreshness: "fresh" as const,
        }),
        server: {
            address: null,
            joinCode: "WD-7F3K",
            password: null,
            joinUrl: "https://logi.app/join/vlci-wd",
        },
    })
    assert.equal(view.text.match(/Bakurani/g)?.length, 1, view.text)
    assert.match(view.text, /Join kód `WD-7F3K`/)
})

test("style A in server-status mode shows no score and no round time (L3-43, L3-44)", () => {
    const view = styleA({
        panel: {
            layout: {
                showMap: true,
                showScoreboard: false,
                showPlayerCount: true,
                compact: false,
            },
        },
    })
    assert.match(view.text, /STAV SERVERU · HELL LET LOOSE/)
    assert.match(view.text, /Online/)
    assert.doesNotMatch(view.text, /3 : 2|zbývá|NEJVÍC ZABITÍ/)
})

test("style C is compact, without images and without a refresh footer", () => {
    const view = renderedView(
        liveServerPanelView(
            input({
                panel: { style: "c" },
                images: {
                    score: null,
                    banner: null,
                    thumbnail: { url: "attachment://mapa-foy-0a.webp" },
                },
            })
        )
    )
    assert.deepEqual(view.validation, { ok: true, issues: [] })
    assert.doesNotMatch(view.text, /NEJVÍC ZABITÍ|obnovuje se/)
    assert.deepEqual(view.media, [])
})

test("a new map adds the Nová mapa chip", () => {
    const view = renderedView(liveServerPanelView(input({ newMap: true })))
    assert.match(view.text, /Nová mapa/)
})

test("Wardogs: three factions with points, join code instead of an address", () => {
    const data = {
        ...warconLive(),
        freshness: "fresh" as const,
        playersFreshness: "fresh" as const,
    }
    const facts = wardogsLiveFacts(data)
    const view = renderedView(
        liveServerPanelView(
            input({
                facts,
                server: {
                    address: null,
                    joinCode: "WD-4821",
                    password: "never",
                    joinUrl: "https://logi.app/join/vlci-wd",
                },
                panel: {
                    content: { ...DEFAULT_PANEL_CONTENT, password: true },
                },
                privateChannel: true,
            })
        )
    )
    assert.match(view.text, /KLANOVÝ SERVER · WARDOGS/)
    assert.match(view.text, /Bravo \*\*12\*\* b\./)
    assert.match(view.text, /Join kód `WD-4821`/)
    assert.match(view.text, /NEJVÍC PENĚZ TEĎ/)
    assert.doesNotMatch(view.text, /never/)
})

test("provider text is escaped and stays within Discord's limits at maximum length", () => {
    const live = hllLiveFixture()
    live.status!.serverName = "*".repeat(200)
    live.players = Array.from({ length: 100 }, (_, index) => ({
        playerId: `id-${index}`,
        name: `_${"*".repeat(120)}${index}`,
        team: index % 2 ? "axis" : "allies",
        kills: Number.MAX_SAFE_INTEGER - index,
        deaths: 1,
        combat: null,
        offense: null,
        defense: null,
        support: null,
    }))
    const facts = hllLiveFacts(live)
    const view = renderedView(
        liveServerPanelView(
            input({
                facts,
                panel: { title: null, description: "_".repeat(300) },
            })
        )
    )
    assert.deepEqual(view.validation, { ok: true, issues: [] })
    assert.doesNotMatch(view.text, /id-\d/)
})

test("leaders are stable: ties sort by name, players without the metric are skipped", () => {
    const roster = [
        { id: null, name: "b", side: null, kills: 5, deaths: 0, cash: null },
        { id: null, name: "a", side: null, kills: 5, deaths: 0, cash: null },
        { id: null, name: "c", side: null, kills: null, deaths: 0, cash: null },
    ]
    assert.deepEqual(
        liveLeaders(roster, "kills").map((player) => player.name),
        ["a", "b"]
    )
})

test("the leaders block needs its opt-in and a fresh current-round roster", () => {
    const off = renderedView(
        liveServerPanelView(input({ panel: { showLeaders: false } }))
    )
    assert.doesNotMatch(off.text, /NEJVÍC ZABITÍ/)
    const stale = renderedView(
        liveServerPanelView(input({ facts: { ...hll(), rosterFresh: false } }))
    )
    assert.doesNotMatch(stale.text, /NEJVÍC ZABITÍ/)
    assert.ok(
        !stale.buttons.some((button) => button.label === "Zobrazit hráče")
    )
})

test("collected snapshots give facts without a roster", () => {
    const facts = snapshotLiveFacts({
        id: "src",
        guildId: "guild",
        gameId: "hell_let_loose",
        provider: "hll_crcon",
        displayName: "Vlci #1",
        state: "online",
        freshness: "fresh",
        observedAt: "2026-10-04T00:00:00.000Z",
        lastSuccessAt: "2026-10-04T00:00:00.000Z",
        providerUpdatedAt: null,
        providerInstanceId: null,
        map: "Foy",
        players: 30,
        capacity: 100,
        capabilities: [],
        attribution: null,
        scores: [
            { id: "allies", label: "Allies", score: 2 },
            { id: "axis", label: "Axis", score: 1 },
        ],
    } as unknown as Parameters<typeof snapshotLiveFacts>[0])
    assert.equal(facts.roster.length, 0)
    assert.equal(facts.rosterFresh, false)
    assert.equal(facts.hll?.allies, 2)
    assert.equal(facts.players, 30)
})
