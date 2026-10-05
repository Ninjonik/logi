import {
    applyPanelGraphicsPatch,
    DEFAULT_PANEL_GRAPHICS,
    filterPanelMapTiles,
    panelEmojiReportSchema,
    panelEmojiStatus,
    panelGraphicsChangeCount,
    panelGraphicsForBot,
    panelGraphicsPatchSchema,
    panelGraphicsSettingsSchema,
    panelMapTiles,
    serverBannerFor,
    serverGraphics,
} from "./panel-graphics-settings"
import { PANEL_EMOJI } from "./panel-emblems"
import assert from "node:assert/strict"
import test from "node:test"

const patch = (value: unknown) => panelGraphicsPatchSchema.parse(value)

test("the clan default is style A with no banners and no overrides", () => {
    assert.deepEqual(DEFAULT_PANEL_GRAPHICS, {
        defaultStyle: "a",
        servers: [],
        maps: [],
    })
    assert.deepEqual(serverGraphics(DEFAULT_PANEL_GRAPHICS, "c1"), {
        connectionId: "c1",
        bannerAssetId: null,
        crop: "center",
        useMapImage: true,
        barColor: null,
    })
})

test("a patch changes only the named fields and normalizes colours", () => {
    const first = applyPanelGraphicsPatch(
        DEFAULT_PANEL_GRAPHICS,
        patch({
            defaultStyle: "b",
            servers: [
                {
                    connectionId: "c1",
                    bannerAssetId: "imageAssets:1",
                    crop: "top",
                    barColor: "#2BB3A3",
                },
            ],
            maps: [
                {
                    game: "hell_let_loose",
                    mapKey: "carentan",
                    assetId: "imageAssets:2",
                },
            ],
        })
    )
    assert.deepEqual(first, {
        defaultStyle: "b",
        servers: [
            {
                connectionId: "c1",
                bannerAssetId: "imageAssets:1",
                crop: "top",
                useMapImage: true,
                barColor: "#2bb3a3",
            },
        ],
        maps: [
            {
                game: "hell_let_loose",
                mapKey: "carentan",
                assetId: "imageAssets:2",
            },
        ],
    })
    const second = applyPanelGraphicsPatch(
        first,
        patch({ servers: [{ connectionId: "c1", useMapImage: false }] })
    )
    assert.equal(second.servers[0]?.bannerAssetId, "imageAssets:1")
    assert.equal(second.servers[0]?.useMapImage, false)
    assert.equal(second.defaultStyle, "b")
    assert.equal(panelGraphicsChangeCount(first, second), 1)
    assert.equal(panelGraphicsChangeCount(DEFAULT_PANEL_GRAPHICS, first), 5)
})

test("removing a banner, resetting a server and restoring a map drop them from storage", () => {
    const start = applyPanelGraphicsPatch(
        DEFAULT_PANEL_GRAPHICS,
        patch({
            servers: [
                { connectionId: "c1", bannerAssetId: "imageAssets:1" },
                { connectionId: "c2", barColor: "#7c8cf0", crop: "bottom" },
            ],
            maps: [
                { game: "wardogs", mapKey: "ozeti", assetId: "imageAssets:3" },
            ],
        })
    )
    const cleared = applyPanelGraphicsPatch(
        start,
        patch({
            servers: [
                { connectionId: "c1", bannerAssetId: null },
                { connectionId: "c2", reset: true },
            ],
            maps: [{ game: "wardogs", mapKey: "ozeti", assetId: null }],
        })
    )
    assert.deepEqual(cleared, DEFAULT_PANEL_GRAPHICS)
    // "Barva klanu" resets only the colour.
    const colour = applyPanelGraphicsPatch(
        start,
        patch({ servers: [{ connectionId: "c2", barColor: null }] })
    )
    assert.equal(serverGraphics(colour, "c2").barColor, null)
    assert.equal(serverGraphics(colour, "c2").crop, "bottom")
})

test("invalid patches and documents are rejected", () => {
    const bad = (value: unknown) =>
        assert.equal(panelGraphicsPatchSchema.safeParse(value).success, false)
    bad({})
    bad({ defaultStyle: "d" })
    bad({ servers: [{ connectionId: "c1", barColor: "teal" }] })
    bad({ servers: [{ connectionId: "c1", crop: "left" }] })
    bad({
        maps: [{ game: "hell_let_loose", mapKey: "zestafona", assetId: "a" }],
    })
    bad({
        maps: [{ game: "hell_let_loose", mapKey: "atlantis", assetId: "a" }],
    })
    bad({ servers: [{ connectionId: "c1", bannerUrl: "https://evil" }] })
    bad({ defaultStyle: "a", expectedRevision: -1 })
    assert.equal(
        panelGraphicsSettingsSchema.safeParse({
            ...DEFAULT_PANEL_GRAPHICS,
            servers: [
                serverGraphics(DEFAULT_PANEL_GRAPHICS, "c1"),
                serverGraphics(DEFAULT_PANEL_GRAPHICS, "c1"),
            ],
        }).success,
        false
    )
})

test("the bot projection carries verified URLs and defaults for servers without settings", () => {
    const bot = panelGraphicsForBot({
        defaultStyle: "c",
        revision: 4,
        servers: [
            {
                connectionId: "c1",
                bannerAssetId: "imageAssets:1",
                bannerPublicId: "a".repeat(32),
                bannerUrl: "https://logi.test/api/image-assets/a.webp",
                crop: "top",
                useMapImage: false,
                barColor: "#2bb3a3",
            },
        ],
        maps: [
            {
                game: "hell_let_loose",
                mapKey: "carentan",
                assetId: "imageAssets:2",
                publicId: "b".repeat(32),
                url: "https://logi.test/api/image-assets/b.webp",
            },
        ],
    })
    assert.equal(bot.defaultStyle, "c")
    assert.equal(JSON.stringify(bot).includes("imageAssets:"), false)
    assert.deepEqual(serverBannerFor(bot, "c1"), {
        banner: {
            publicId: "a".repeat(32),
            url: "https://logi.test/api/image-assets/a.webp",
            crop: "top",
            useMapImage: false,
        },
        barColor: "#2bb3a3",
    })
    assert.deepEqual(serverBannerFor(bot, "unknown").banner, {
        publicId: null,
        url: null,
        crop: "center",
        useMapImage: true,
    })
    assert.equal(panelGraphicsForBot(null).defaultStyle, "a")
})

test("map tiles show custom, built-in or missing images and can be searched", () => {
    const tiles = panelMapTiles([
        { game: "hell_let_loose", mapKey: "carentan", url: "https://own" },
    ])
    assert.equal(tiles.length, 23)
    assert.equal(tiles.find((t) => t.key === "carentan")?.status, "custom")
    assert.equal(tiles.find((t) => t.key === "carentan")?.image, "https://own")
    assert.equal(tiles.find((t) => t.key === "foy")?.status, "builtin")
    assert.deepEqual(
        filterPanelMapTiles(tiles, { query: "hurtgen" }).map((t) => t.name),
        ["Hürtgenwald"]
    )
    assert.deepEqual(
        filterPanelMapTiles(tiles, { game: "wardogs" }).map((t) => t.key),
        ["bakurani", "ozeti", "zestafona"]
    )
    assert.equal(filterPanelMapTiles(tiles, { game: "all" }).length, 23)
})

test("emoji status counts 12 faction signs and 7 status pieces", () => {
    assert.deepEqual(panelEmojiStatus(null), {
        faction: { ready: 0, total: 12, complete: false },
        status: { ready: 0, total: 7, complete: false },
        checkedAt: null,
    })
    const all = PANEL_EMOJI.map((emoji) => emoji.key)
    const report = panelEmojiReportSchema.parse({
        applicationId: "123456789012345678",
        ready: all,
        failed: [],
        checkedAt: 5,
    })
    assert.deepEqual(panelEmojiStatus(report), {
        faction: { ready: 12, total: 12, complete: true },
        status: { ready: 7, total: 7, complete: true },
        checkedAt: 5,
    })
    assert.equal(
        panelEmojiReportSchema.safeParse({ ...report, applicationId: "x" })
            .success,
        false
    )
})
