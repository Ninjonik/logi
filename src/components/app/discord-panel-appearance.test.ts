import { renderToStaticMarkup } from "react-dom/server"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

import {
    DiscordPanelAppearance,
    uploadErrorMessage,
    type PanelAppearanceDraft,
} from "./discord-panel-appearance"
import { resolvePanelPresentation } from "@/domain/discord-publications/panel-presentation"
import { getDictionary } from "@/i18n/dictionaries"

/** React escapes text content; compare against the escaped form. */
const html = (text: string) =>
    text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#x27;")
const banner =
    "https://logi.test/api/image-assets/0123456789abcdef0123456789abcdef.webp"
const render = (
    locale: "en" | "cs" | "de",
    value: PanelAppearanceDraft,
    kind: "server" | "results" = "server",
    factions = ["allies", "axis", "valkyra"] as const
) =>
    renderToStaticMarkup(
        createElement(DiscordPanelAppearance, {
            serverId: "fixture-server",
            kind,
            value,
            factions,
            disabled: false,
            t: getDictionary(locale).publicPanelAppearance,
            onChange: () => {},
        })
    )

for (const locale of ["en", "cs", "de"] as const) {
    test(`panel appearance renders localized controls, defaults and banner preview in ${locale}`, () => {
        const t = getDictionary(locale).publicPanelAppearance
        const defaults = render(locale, resolvePanelPresentation(null))
        assert.ok(defaults.includes(html(t.title)))
        assert.ok(defaults.includes(html(t.factionEmojiHelp)))
        assert.equal(defaults.match(/role="switch"/g)?.length, 4)
        for (const key of [
            "showMap",
            "showScoreboard",
            "showPlayerCount",
            "compact",
        ] as const)
            assert.ok(defaults.includes(html(t[key])))
        assert.ok(defaults.includes(html(t.bannerNone)))
        assert.ok(!defaults.includes(html(t.bannerRemove)))
        assert.ok(defaults.includes(`placeholder="◈"`))
        assert.ok(defaults.includes(`placeholder="${t.noDefaultEmoji}"`))
        assert.ok(defaults.includes(html(t.factions.allies)))
        assert.ok(!defaults.includes(html(t.factions.lonestar)))
        assert.ok(!defaults.includes('aria-invalid="true"'))

        const edited = render(
            locale,
            {
                ...resolvePanelPresentation(null),
                accentColor: "#12",
                bannerAssetId: "imageAssets:1",
                bannerUrl: banner,
                factionEmoji: { axis: "Axis" },
            },
            "results"
        )
        assert.equal(edited.match(/role="switch"/g)?.length, 2)
        assert.ok(edited.includes(html(t.resultsLayoutHelp)))
        assert.ok(edited.includes(`src="${banner}"`))
        assert.ok(edited.includes(html(t.bannerRemove)))
        assert.ok(edited.includes(html(t.accentColorInvalid)))
        assert.ok(edited.includes(html(t.factionEmojiInvalid)))
        assert.equal(edited.match(/aria-invalid="true"/g)?.length, 2)
    })
}

test("upload and save errors are localized with the retry delay", () => {
    const t = getDictionary("en").publicPanelAppearance
    assert.equal(
        uploadErrorMessage(t, "upload_limited", 41_200),
        "Too many uploads. Retry in 42 s."
    )
    assert.equal(uploadErrorMessage(t, "too_large"), t.errors.too_large)
    assert.equal(
        uploadErrorMessage(
            getDictionary("cs").publicPanelAppearance,
            "asset_unavailable"
        ),
        getDictionary("cs").publicPanelAppearance.errors.asset_unavailable
    )
})
