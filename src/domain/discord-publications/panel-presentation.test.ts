import {
    cleanPanelFactionEmoji,
    DEFAULT_PANEL_LAYOUT,
    defaultFactionEmoji,
    factionEmojiFor,
    panelBannerImage,
    isPanelAccentColorDraft,
    isPanelFactionEmojiDraft,
    isPanelFactionGame,
    panelAccentColor,
    panelPresentationFromDraft,
    panelFactionIcons,
    panelFactionOf,
    panelPresentationInputSchema,
    panelPresentationSchema,
    resolvePanelPresentation,
} from "./panel-presentation"
import {
    publicPanelSaveResultSchema,
    publicPanelSettingsInput,
    publicPanelSettingsSchema,
} from "./settings"
import assert from "node:assert/strict"
import test from "node:test"

const legacy = {
    kind: "server" as const,
    connectionId: "source",
    channelId: "123456789012345678",
    enabled: true,
    showPlayers: true,
    artwork: false,
    refreshSeconds: 30 as const,
}

test("a legacy record without presentation resolves to defaults and renders settings unchanged", () => {
    const settings = publicPanelSettingsSchema.parse(legacy)
    assert.equal("presentation" in settings, false)
    assert.deepEqual(resolvePanelPresentation(settings), {
        layout: DEFAULT_PANEL_LAYOUT,
        accentColor: null,
        bannerAssetId: null,
        bannerUrl: null,
        factionEmoji: {},
    })
    assert.deepEqual(resolvePanelPresentation(null), {
        layout: DEFAULT_PANEL_LAYOUT,
        accentColor: null,
        bannerAssetId: null,
        bannerUrl: null,
        factionEmoji: {},
    })
    assert.deepEqual(publicPanelSettingsInput(settings), settings)
})

test("an empty presentation object is fully defaulted", () => {
    const presentation = panelPresentationSchema.parse({})
    assert.deepEqual(presentation, {
        layout: {
            showMap: true,
            showScoreboard: true,
            showPlayerCount: true,
            compact: false,
        },
        accentColor: null,
        bannerAssetId: null,
        bannerUrl: null,
        factionEmoji: {},
    })
    const partial = panelPresentationSchema.parse({
        layout: { compact: true },
    })
    assert.equal(partial.layout.compact, true)
    assert.equal(partial.layout.showMap, true)
    // Defaults are fresh objects, so one caller cannot mutate another's layout.
    partial.factionEmoji.axis = "🪖"
    assert.deepEqual(panelPresentationSchema.parse({}).factionEmoji, {})
})

test("accent colors must be #RRGGBB and convert to Discord integers", () => {
    assert.equal(
        panelPresentationSchema.safeParse({ accentColor: "#12ab" }).success,
        false
    )
    assert.equal(
        panelPresentationSchema.safeParse({ accentColor: "12ab34" }).success,
        false
    )
    assert.equal(
        panelPresentationSchema.safeParse({ accentColor: "red" }).success,
        false
    )
    const ok = panelPresentationSchema.parse({ accentColor: "#FF8800" })
    assert.equal(panelAccentColor(ok, 0x77b255), 0xff8800)
    assert.equal(panelAccentColor({ accentColor: null }, 0x77b255), 0x77b255)
    assert.equal(panelAccentColor({ accentColor: "nope" }, 1), 1)
})

test("faction emoji accept one Unicode emoji or a custom Discord reference and reject text", () => {
    for (const emoji of [
        "🦅",
        "🇺🇸",
        "⚔️",
        "👨‍👩‍👧",
        "👍🏽",
        "<:valkyra:123456789012345678>",
        "<a:spin_ner:12345678901234567890>",
    ])
        assert.equal(
            panelPresentationSchema.safeParse({
                factionEmoji: { allies: emoji },
            }).success,
            true,
            emoji
        )
    for (const invalid of [
        "Allies",
        "🦅🦅",
        "🦅 ",
        "<:x:123>",
        "<:valkyra:abc>",
        "<@123456789012345678>",
        "<:name with space:123456789012345678>",
        "",
    ])
        assert.equal(
            panelPresentationSchema.safeParse({
                factionEmoji: { axis: invalid },
            }).success,
            false,
            invalid
        )
    assert.equal(
        panelPresentationSchema.safeParse({ factionEmoji: { alpha: "🦅" } })
            .success,
        false
    )
})

test("overrides beat runtime defaults per faction; unknown labels never match", () => {
    const look = resolvePanelPresentation({
        presentation: panelPresentationSchema.parse({
            factionEmoji: { valkyra: "<:vk:123456789012345678>" },
        }),
    })
    const defaults = { valkyra: "<:app:111111111111111111>", manticore: "🐉" }
    assert.equal(
        factionEmojiFor(look, "valkyra", defaults),
        look.factionEmoji.valkyra
    )
    assert.equal(factionEmojiFor(look, "manticore", defaults), "🐉")
    assert.equal(factionEmojiFor(look, "lonestar", defaults), null)
    assert.equal(factionEmojiFor(look, "allies"), null)
    assert.deepEqual(panelFactionIcons(look, defaults), {
        valkyra: look.factionEmoji.valkyra,
        manticore: "🐉",
    })
    assert.equal(panelFactionOf(" Valkyra "), "valkyra")
    assert.equal(panelFactionOf("allies"), "allies")
    assert.equal(panelFactionOf("Alpha"), null)
    assert.equal(panelFactionOf(null), null)
    assert.equal(isPanelFactionGame("wardogs"), true)
    assert.equal(isPanelFactionGame("hell_let_loose_vietnam"), false)
    assert.equal(isPanelFactionGame("toString"), false)
})

test("the banner URL is server-owned: inputs never carry it and stored values round-trip", () => {
    assert.equal(
        panelPresentationInputSchema.safeParse({ bannerUrl: "https://x" })
            .success,
        false
    )
    const settings = publicPanelSettingsSchema.parse({
        ...legacy,
        presentation: {
            bannerAssetId: "imageAssets:1",
            bannerUrl: "https://cdn.example/banner.webp",
            accentColor: "#112233",
        },
    })
    assert.equal(
        settings.presentation?.bannerUrl,
        "https://cdn.example/banner.webp"
    )
    const input = publicPanelSettingsInput(settings)
    assert.equal(input.presentation && "bannerUrl" in input.presentation, false)
    assert.equal(input.presentation?.bannerAssetId, "imageAssets:1")
    assert.equal(input.presentation?.accentColor, "#112233")
    assert.equal(
        publicPanelSaveResultSchema.safeParse({ error: "asset_unavailable" })
            .success,
        true
    )
    assert.equal(
        publicPanelSaveResultSchema.safeParse({ error: "other" }).success,
        false
    )
})

test("banners render only from HTTPS URLs and dashboard emoji input is trimmed", () => {
    assert.equal(
        panelBannerImage({
            bannerUrl: "https://logi.test/api/image-assets/a.webp",
        }),
        "https://logi.test/api/image-assets/a.webp"
    )
    assert.equal(
        panelBannerImage({ bannerUrl: "http://localhost/a.webp" }),
        null
    )
    assert.equal(panelBannerImage({ bannerUrl: "javascript:alert(1)" }), null)
    assert.equal(panelBannerImage({ bannerUrl: null }), null)
    assert.deepEqual(
        cleanPanelFactionEmoji({
            allies: " 🦅 ",
            axis: "   ",
            valkyra: "<:vk:123456789012345678>",
            alpha: "🐺",
        }),
        { allies: "🦅", valkyra: "<:vk:123456789012345678>" }
    )
    assert.equal(defaultFactionEmoji("valkyra"), "◈")
    assert.equal(defaultFactionEmoji("allies"), null)
})

test("dashboard drafts normalize visible factions and block invalid fields", () => {
    const draft = {
        layout: { ...DEFAULT_PANEL_LAYOUT, compact: true },
        accentColor: " #A1B2C3 ",
        bannerAssetId: "imageAssets:1",
        factionEmoji: {
            allies: " 🦅 ",
            axis: "",
            valkyra: "not an emoji",
        },
    }
    assert.deepEqual(panelPresentationFromDraft(draft, ["allies", "axis"]), {
        layout: { ...DEFAULT_PANEL_LAYOUT, compact: true },
        accentColor: "#a1b2c3",
        bannerAssetId: "imageAssets:1",
        factionEmoji: { allies: "🦅" },
    })
    // A hidden faction of another game never blocks saving; a visible one does.
    assert.equal(panelPresentationFromDraft(draft, ["valkyra"]), null)
    assert.equal(
        panelPresentationFromDraft({ ...draft, accentColor: "#12345" }, []),
        null
    )
    assert.equal(
        panelPresentationFromDraft({ ...draft, accentColor: "  " }, [])
            ?.accentColor,
        null
    )
    assert.equal(isPanelAccentColorDraft(null), true)
    assert.equal(isPanelAccentColorDraft("red"), false)
    assert.equal(isPanelFactionEmojiDraft(undefined), true)
    assert.equal(isPanelFactionEmojiDraft("<:x:1>"), false)
})

test("a panel's own style is optional, validated and kept through the save input", () => {
    assert.equal("style" in panelPresentationSchema.parse({}), false)
    assert.equal(panelPresentationInputSchema.parse({ style: "b" }).style, "b")
    assert.equal(
        panelPresentationInputSchema.parse({ style: null }).style,
        null
    )
    assert.equal(
        panelPresentationInputSchema.safeParse({ style: "d" }).success,
        false
    )
    const settings = publicPanelSettingsSchema.parse({
        ...legacy,
        presentation: { style: "c" },
    })
    assert.equal(publicPanelSettingsInput(settings).presentation?.style, "c")
    const plain = publicPanelSettingsInput(
        publicPanelSettingsSchema.parse({ ...legacy, presentation: {} })
    )
    assert.equal("style" in (plain.presentation ?? {}), false)
    const draft = {
        layout: DEFAULT_PANEL_LAYOUT,
        accentColor: null,
        bannerAssetId: null,
        factionEmoji: {},
    }
    assert.equal(
        panelPresentationFromDraft({ ...draft, style: "a" }, [])?.style,
        "a"
    )
    assert.equal(
        "style" in (panelPresentationFromDraft(draft, []) ?? {}),
        false
    )
})
