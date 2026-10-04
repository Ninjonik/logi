import {
    factionIcon,
    panelArtworkWanted,
    renderPanel,
    renderPlayers,
    renderResult,
} from "./render"
import { panelPresentationSchema } from "../../../src/domain/discord-publications/panel-presentation"
import { publicPanelSettingsSchema } from "../../../src/domain/discord-publications/settings"
import { warconLive } from "../../../src/infrastructure/testing/warcon"
import assert from "node:assert/strict"
import test from "node:test"

test("existing configurations keep public player leaders disabled", () => {
    assert.equal(
        publicPanelSettingsSchema.parse({
            kind: "server",
            connectionId: "source",
            channelId: "123456789012345678",
            enabled: true,
            showPlayers: true,
            artwork: false,
            refreshSeconds: 30,
        }).showLeaders,
        false
    )
})

test("maximum-length public leaders stay within the component text budget and hide platform IDs", () => {
    const live = {
        ...warconLive(),
        freshness: "fresh" as const,
        playersFreshness: "fresh" as const,
    }
    live.players = Array.from({ length: 16 }, (_, i) => ({
        ...live.players[0],
        name: "*".repeat(200),
        faction: "_".repeat(80) + (i % 8),
        kills: Number.MAX_SAFE_INTEGER,
        cash: Number.MAX_VALUE,
    }))
    live.status!.scores = Array.from({ length: 8 }, (_, i) => ({
        name: "_".repeat(80) + i,
        score: Number.MAX_SAFE_INTEGER,
        colorHex: "#777777",
    }))
    const data = renderPanel(
        {
            id: "panel",
            revision: 1,
            gameId: "wardogs",
            enabled: true,
            showPlayers: true,
            showLeaders: true,
            artwork: false,
        },
        null,
        live
    )
    const contents = (value: unknown): string[] =>
        value && typeof value === "object"
            ? [
                  ...("content" in value && typeof value.content === "string"
                      ? [value.content]
                      : []),
                  ...Object.values(value).flatMap(contents),
              ]
            : []
    const total = contents(JSON.parse(JSON.stringify(data))).join("").length
    assert.ok(total <= 4000, `Text budget exceeded: ${total}`)
    assert.ok(!JSON.stringify(data).includes(live.players[0].steamId))
})
test("a one-page private response has unique custom IDs even when both navigation buttons are disabled", () => {
    const live = {
        ...warconLive(),
        freshness: "fresh" as const,
        playersFreshness: "fresh" as const,
    }
    const ids = renderPlayers({ id: "panel", revision: 1 }, live, 0)
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
            revision: 1,
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
    assert.match(
        JSON.stringify(renderPlayers({ id: "panel", revision: 1 }, live, 0)),
        /stale/i
    )
})
test("unknown faction never gets a faction icon based on score ordering", () => {
    const icons = { valkyra: "<:valkyra:123>", manticore: "<:manticore:456>" }
    assert.equal(factionIcon("Alpha", icons), "◈")
    assert.equal(factionIcon("Valkyra", icons), icons.valkyra)
})

test("public leader names require separate opt-in and expose current cash, not earnings", () => {
    const live = {
        ...warconLive(),
        freshness: "fresh" as const,
        playersFreshness: "stale" as const,
    }
    live.players[0].name = "PrivateUnlessEnabled"
    const panel = {
        id: "panel",
        revision: 1,
        gameId: "wardogs",
        enabled: true,
        showPlayers: true,
        artwork: false,
    }
    assert.ok(
        !JSON.stringify(renderPanel(panel, null, live)).includes(
            "PrivateUnlessEnabled"
        )
    )
    const enabled = JSON.stringify(
        renderPanel({ ...panel, showLeaders: true }, null, live)
    )
    assert.match(enabled, /PrivateUnlessEnabled/)
    assert.match(enabled, /TOP 3/)
    assert.match(enabled, /Cash/)
    assert.match(enabled, /stale/)
    assert.ok(!enabled.includes(live.players[0].steamId))
    assert.ok(!enabled.includes("earnings"))
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
    const first = renderPlayers({ id: "panel", revision: 1 }, live, 0)
    const last = renderPlayers({ id: "panel", revision: 1 }, live, 99)
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
                revision: 1,
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
                revision: 1,
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

type Node = { type?: number; [key: string]: unknown }
const tree = (value: unknown): Node[] =>
    value && typeof value === "object"
        ? [
              ...("type" in value ? [value as Node] : []),
              ...Object.values(value).flatMap(tree),
          ]
        : []
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as unknown
const container = (value: unknown) =>
    tree(json(value)).find((node) => node.type === 17)!
const texts = (value: unknown) =>
    tree(json(value))
        .filter((node) => node.type === 10)
        .map((node) => String(node.content))
const appearanceLive = () => {
    const live = {
        ...warconLive(),
        freshness: "fresh" as const,
        playersFreshness: "fresh" as const,
    }
    live.status!.scores = [
        { name: "Valkyra", score: 5, colorHex: "#111111" },
        { name: "Manticore", score: 0, colorHex: "#222222" },
        { name: "Alpha", score: 2, colorHex: "#333333" },
    ]
    live.players = [{ ...live.players[0], faction: "Valkyra", kills: 9 }]
    return live
}
const wardogsPanel = {
    id: "panel",
    revision: 1,
    gameId: "wardogs",
    enabled: true,
    showPlayers: true,
    showLeaders: true,
    artwork: true,
}
const appIcons = {
    valkyra: "<:logi_valkyra:111111111111111111>",
    manticore: "<:logi_manticore:222222222222222222>",
}
const artworkUrl = "attachment://logi-panel-bakurani-0123456789ab.webp"
const banner =
    "https://logi.example/api/image-assets/0123456789abcdef0123456789abcdef.webp"

test("a legacy panel without presentation renders exactly like the defaulted appearance", () => {
    const live = appearanceLive()
    const legacy = renderPanel(
        wardogsPanel,
        null,
        live,
        appIcons,
        undefined,
        artworkUrl
    )
    const defaulted = renderPanel(
        { ...wardogsPanel, presentation: panelPresentationSchema.parse({}) },
        null,
        live,
        appIcons,
        undefined,
        artworkUrl
    )
    assert.equal(JSON.stringify(defaulted), JSON.stringify(legacy))
    assert.equal(container(legacy).accent_color, 0x77b255)
    assert.equal(tree(json(legacy)).filter((n) => n.type === 12).length, 0)
    assert.match(
        JSON.stringify(legacy),
        /"url":"attachment:\/\/logi-panel-bakurani/
    )
    assert.equal(
        texts(legacy)[0],
        "### WARDOGS · SERVER LIVE\n**Synthetic Wardogs**\nLive · score in progress\n🗺️ **Bakurani**  ·  👥 **1 / 100** players"
    )
    assert.equal(tree(json(legacy)).filter((n) => n.type === 14).length, 2)
    assert.equal(panelArtworkWanted(wardogsPanel), true)
    const event = {
        id: "e",
        name: "Match",
        map: "Ozeti",
        result: {
            status: "confirmed",
            version: 1,
            reviewedAt: null,
            participants: [{ label: "Valkyra", score: 3 }],
        },
    }
    assert.equal(
        JSON.stringify(
            renderResult(event, appIcons, {
                presentation: panelPresentationSchema.parse({}),
            })
        ),
        JSON.stringify(renderResult(event, appIcons))
    )
})

test("custom faction emoji replace application emoji on scores, leaders and results; unknown factions stay neutral", () => {
    const presentation = panelPresentationSchema.parse({
        factionEmoji: {
            valkyra: "<:vk:123456789012345678>",
            lonestar: "<a:ls:12345678901234567890>",
        },
    })
    const view = texts(
        renderPanel(
            { ...wardogsPanel, presentation },
            null,
            appearanceLive(),
            appIcons
        )
    ).join("\n")
    assert.match(
        view,
        /<:vk:123456789012345678> \*\*Valkyra\*\* · \*\*5\*\* pts/
    )
    assert.match(view, /<:logi_manticore:222222222222222222> \*\*Manticore\*\*/)
    assert.match(view, /◈ \*\*Alpha\*\*/)
    assert.match(view, /kills · <:vk:123456789012345678> Valkyra/)
    assert.ok(!view.includes("<:logi_valkyra:111111111111111111>"))
    const result = texts(
        renderResult(
            {
                id: "e",
                name: "Match",
                map: "Ozeti",
                result: {
                    status: "confirmed",
                    version: 1,
                    reviewedAt: null,
                    participants: [
                        { label: "Lonestar", score: 3 },
                        { label: "Clan", score: 1 },
                    ],
                },
            },
            appIcons,
            { presentation }
        )
    ).join("\n")
    assert.match(result, /<a:ls:12345678901234567890> \*\*Lonestar\*\* · 3/)
    assert.match(result, /◈ \*\*Clan\*\* · 1/)
    assert.equal(factionIcon("Allies", { allies: "🇺🇸" }), "🇺🇸")
})

test("the accent color replaces the live color; stale and paused panels keep the warning color", () => {
    const presentation = panelPresentationSchema.parse({
        accentColor: "#FF8800",
    })
    const live = appearanceLive()
    assert.equal(
        container(renderPanel({ ...wardogsPanel, presentation }, null, live))
            .accent_color,
        0xff8800
    )
    assert.equal(
        container(
            renderPanel({ ...wardogsPanel, presentation }, null, {
                ...live,
                freshness: "stale" as const,
            })
        ).accent_color,
        0xd99a37
    )
    assert.equal(
        container(
            renderPanel(
                { ...wardogsPanel, enabled: false, presentation },
                null,
                null
            )
        ).accent_color,
        0xd99a37
    )
    assert.equal(
        container(
            renderResult(
                {
                    id: "e",
                    name: "Match",
                    map: null,
                    result: {
                        status: "corrected",
                        version: 2,
                        reviewedAt: null,
                        participants: [],
                    },
                },
                {},
                { presentation }
            )
        ).accent_color,
        0xff8800
    )
})

test("an HTTPS banner becomes the main image and replaces the map thumbnail", () => {
    const presentation = panelPresentationSchema.parse({
        bannerAssetId: "imageAssets:1",
        bannerUrl: banner,
    })
    const panel = { ...wardogsPanel, presentation }
    const data = json(
        renderPanel(panel, null, appearanceLive(), {}, undefined, artworkUrl)
    )
    const gallery = tree(data).find((n) => n.type === 12)
    assert.ok(gallery)
    assert.deepEqual(
        (gallery.items as { media: { url: string } }[]).map((i) => i.media.url),
        [banner]
    )
    assert.equal((container(data).components as Node[])[0].type, 12)
    assert.equal(
        tree(data).filter((n) => n.type === 11 || n.type === 9).length,
        0
    )
    assert.ok(!JSON.stringify(data).includes("attachment://"))
    assert.equal(panelArtworkWanted(panel), false)
    // A non-HTTPS URL cannot be fetched by Discord; the map artwork stays.
    const insecure = {
        ...wardogsPanel,
        presentation: { ...presentation, bannerUrl: "http://localhost/x.webp" },
    }
    assert.equal(panelArtworkWanted(insecure), true)
    assert.equal(
        tree(
            json(
                renderPanel(
                    insecure,
                    null,
                    appearanceLive(),
                    {},
                    undefined,
                    artworkUrl
                )
            )
        ).filter((n) => n.type === 12).length,
        0
    )
    assert.equal(
        tree(
            json(
                renderResult(
                    {
                        id: "e",
                        name: "Match",
                        map: null,
                        result: {
                            status: "confirmed",
                            version: 1,
                            reviewedAt: null,
                            participants: [],
                        },
                    },
                    {},
                    { presentation }
                )
            )
        ).filter((n) => n.type === 12).length,
        1
    )
})

test("layout toggles each change the rendered panel", () => {
    const live = appearanceLive()
    const render = (layout: Record<string, boolean>) =>
        renderPanel(
            {
                ...wardogsPanel,
                showLeaders: false,
                presentation: panelPresentationSchema.parse({ layout }),
            },
            null,
            live,
            appIcons,
            undefined,
            artworkUrl
        )
    const noMap = render({ showMap: false })
    assert.ok(!texts(noMap)[0].includes("🗺️"))
    assert.equal(tree(json(noMap)).filter((n) => n.type === 11).length, 0)
    assert.equal(
        panelArtworkWanted({
            artwork: true,
            presentation: {
                layout: {
                    showMap: false,
                    showScoreboard: true,
                    showPlayerCount: true,
                    compact: false,
                },
            },
        }),
        false
    )
    const noScores = texts(render({ showScoreboard: false })).join("\n")
    assert.ok(!noScores.includes("FACTION SCORE"))
    assert.ok(!noScores.includes("pts"))
    const noCount = texts(render({ showPlayerCount: false }))[0]
    assert.ok(!noCount.includes("players"))
    assert.match(noCount, /🗺️ \*\*Bakurani\*\*$/)
    const compact = render({ compact: true })
    const [header, scores] = texts(compact)
    assert.equal(
        header,
        "**WARDOGS · Synthetic Wardogs**\n-# Live · score in progress · 🗺️ **Bakurani** · 👥 **1 / 100** players"
    )
    assert.match(scores, /\*\*5\*\* pts {2}· {2}<:logi_manticore/)
    assert.ok(!scores.includes("FACTION SCORE"))
    assert.equal(tree(json(compact)).filter((n) => n.type === 14).length, 0)
    const compactResult = texts(
        renderResult(
            {
                id: "e",
                name: "Match",
                map: "Ozeti",
                result: {
                    status: "confirmed",
                    version: 1,
                    reviewedAt: null,
                    participants: [
                        { label: "Valkyra", score: 3 },
                        { label: "Manticore", score: 1 },
                    ],
                },
            },
            appIcons,
            {
                presentation: panelPresentationSchema.parse({
                    layout: { compact: true, showMap: false },
                }),
            }
        )
    )[0]
    assert.ok(!compactResult.startsWith("###"))
    assert.ok(!compactResult.includes("Ozeti"))
    assert.match(compactResult, /· 3 {2}· {2}<:logi_manticore/)
})

test("maximum-length custom emoji keep the public panel within the component text budget", () => {
    const live = appearanceLive()
    live.players = Array.from({ length: 16 }, (_, i) => ({
        ...live.players[0],
        name: "*".repeat(200),
        faction: ["Valkyra", "Manticore", "Lonestar"][i % 3],
        kills: Number.MAX_SAFE_INTEGER,
        cash: Number.MAX_VALUE,
    }))
    live.status!.scores = Array.from({ length: 8 }, (_, i) => ({
        name: ["Valkyra", "Manticore", "Lonestar"][i % 3],
        score: Number.MAX_SAFE_INTEGER,
        colorHex: "#777777",
    }))
    live.status!.serverName = "*".repeat(200)
    const emoji = `<a:${"x".repeat(32)}:${"9".repeat(20)}>`
    const total = texts(
        renderPanel(
            {
                ...wardogsPanel,
                presentation: panelPresentationSchema.parse({
                    factionEmoji: {
                        valkyra: emoji,
                        manticore: emoji,
                        lonestar: emoji,
                    },
                }),
            },
            null,
            live
        )
    ).join("").length
    assert.ok(total <= 4000, `Text budget exceeded: ${total}`)
})

test("private player pages show only workspace faction emoji overrides and stay within the content limit", () => {
    const live = appearanceLive()
    live.players = [
        { ...live.players[0], name: "Vk", faction: "Valkyra" },
        { ...live.players[0], name: "Mt", faction: "Manticore" },
        { ...live.players[0], name: "Al", faction: "Alpha" },
    ]
    const legacy = renderPlayers({ id: "panel", revision: 1 }, live, 0)
    assert.equal(
        JSON.stringify(
            renderPlayers(
                {
                    id: "panel",
                    revision: 1,
                    presentation: panelPresentationSchema.parse({}),
                },
                live,
                0
            )
        ),
        JSON.stringify(legacy)
    )
    assert.match(legacy.content, /\*\*Vk\*\* · Valkyra\n/)
    const presentation = panelPresentationSchema.parse({
        factionEmoji: { valkyra: "<:vk:123456789012345678>" },
    })
    const marked = renderPlayers(
        { id: "panel", revision: 1, presentation },
        live,
        0
    ).content
    assert.match(marked, /\*\*Vk\*\* · <:vk:123456789012345678> Valkyra\n/)
    // No override: no marker, not even the installed application emoji.
    assert.match(marked, /\*\*Mt\*\* · Manticore\n/)
    assert.match(marked, /\*\*Al\*\* · Alpha\n/)

    const emoji = `<a:${"x".repeat(32)}:${"9".repeat(20)}>`
    live.players = Array.from({ length: 8 }, (_, index) => ({
        ...live.players[0],
        steamId: `7656119800000000${index}`,
        name: "*".repeat(200),
        faction: "Valkyra",
        kills: Number.MAX_SAFE_INTEGER,
        deaths: Number.MAX_SAFE_INTEGER,
        cash: Number.MAX_VALUE,
        ping: Number.MAX_VALUE,
    }))
    const long = renderPlayers(
        {
            id: "panel",
            revision: 1,
            presentation: panelPresentationSchema.parse({
                factionEmoji: { valkyra: emoji },
            }),
        },
        live,
        0
    ).content
    assert.ok(long.length <= 2000, `Discord content limit: ${long.length}`)
    // Eight 58-character emoji would overflow this page, so they are dropped.
    assert.ok(!long.includes(emoji))
    assert.match(long, /\*\* · Valkyra\n/)
})
