import { renderToStaticMarkup } from "react-dom/server"
import assert from "node:assert/strict"
import { createElement } from "react"
import test from "node:test"

import {
    applyPanelAppearanceUpdate,
    DiscordPanelAppearance,
    runPanelBannerUpload,
    uploadErrorMessage,
    withPanelBanner,
    type PanelAppearanceDraft,
    type PanelAppearanceUpdate,
} from "./discord-panel-appearance"
import { resolvePanelPresentation } from "@/domain/discord-publications/panel-presentation"
import type { ImageUploadResult } from "@/lib/image-asset-upload"
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
            onUploadingChange: () => {},
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
        assert.ok(defaults.includes(html(t.bannerLibraryShow)))
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

const uploadedAsset = {
    id: "imageAssets:9",
    kind: "panel-banner" as const,
    contentType: "image/webp" as const,
    width: 1920,
    height: 1080,
    bytes: 4096,
    url: banner,
    createdAt: "2026-10-04T00:00:00.000Z",
}
/** The form's state: a null draft until the first edit, updated functionally. */
function formDraft(initial: PanelAppearanceDraft | null = null) {
    const form = { draft: initial, uploading: [] as boolean[] }
    const onChange = (update: PanelAppearanceUpdate) => {
        form.draft = applyPanelAppearanceUpdate(form.draft, update)
    }
    return { form, onChange }
}
function deferredUpload() {
    let resolve: (result: ImageUploadResult) => void = () => {}
    const promise = new Promise<ImageUploadResult>((r) => {
        resolve = r
    })
    return { upload: () => promise, resolve }
}

test("a finished banner upload keeps appearance edits made while it was in flight", async () => {
    const { form, onChange } = formDraft()
    const results: ImageUploadResult[] = []
    const pending = deferredUpload()
    const run = runPanelBannerUpload(pending.upload, {
        isCurrent: () => true,
        onUploadingChange: (value) => form.uploading.push(value),
        onChange,
        onResult: (result) => results.push(result),
    })
    assert.deepEqual(form.uploading, [true])
    // Edits made in the editor while the request is still running.
    onChange((current) => ({
        ...current,
        layout: { ...current.layout, compact: true },
        accentColor: "#ff0000",
        factionEmoji: { ...current.factionEmoji, valkyra: "🦅" },
    }))
    pending.resolve({ ok: true, asset: uploadedAsset })
    await run
    const defaults = resolvePanelPresentation(null)
    assert.deepEqual(form.draft, {
        ...defaults,
        layout: { ...defaults.layout, compact: true },
        accentColor: "#ff0000",
        factionEmoji: { valkyra: "🦅" },
        bannerAssetId: uploadedAsset.id,
        bannerUrl: banner,
    })
    assert.deepEqual(form.uploading, [true, false])
    assert.equal(results.length, 1)
})

test("an upload that lands after another panel was loaded leaves that panel's draft untouched", async () => {
    const panelA = {
        ...resolvePanelPresentation(null),
        accentColor: "#aa0000",
    }
    const { form, onChange } = formDraft(panelA)
    let current = true
    const results: ImageUploadResult[] = []
    const pending = deferredUpload()
    const run = runPanelBannerUpload(pending.upload, {
        isCurrent: () => current,
        onUploadingChange: (value) => form.uploading.push(value),
        onChange,
        onResult: (result) => results.push(result),
    })
    // Panel B is loaded and its editor remounted before the upload returns.
    const panelB = {
        ...resolvePanelPresentation(null),
        layout: { ...resolvePanelPresentation(null).layout, showMap: false },
    }
    form.draft = panelB
    current = false
    pending.resolve({ ok: true, asset: uploadedAsset })
    await run
    assert.equal(form.draft, panelB)
    assert.deepEqual(results, [])
    // The form's upload lock is released either way.
    assert.deepEqual(form.uploading, [true, false])
})

test("a failed or interrupted upload reports once, keeps the draft and releases the lock", async () => {
    const { form, onChange } = formDraft()
    const results: ImageUploadResult[] = []
    const hooks = {
        isCurrent: () => true,
        onUploadingChange: (value: boolean) => form.uploading.push(value),
        onChange,
        onResult: (result: ImageUploadResult) => results.push(result),
    }
    await runPanelBannerUpload(
        async () => ({ ok: false, error: "too_large", retryAfterMs: null }),
        hooks
    )
    assert.equal(form.draft, null)
    assert.deepEqual(results, [
        { ok: false, error: "too_large", retryAfterMs: null },
    ])
    await assert.rejects(
        runPanelBannerUpload(async () => {
            throw new Error("aborted")
        }, hooks)
    )
    assert.deepEqual(form.uploading, [true, false, true, false])
    assert.equal(form.draft, null)
})

test("choosing or removing a banner changes only the banner fields", () => {
    const edited = {
        ...resolvePanelPresentation(null),
        accentColor: "#123456",
        factionEmoji: { axis: "🦅" },
    }
    const chosen = withPanelBanner(uploadedAsset)(edited)
    assert.deepEqual(chosen, {
        ...edited,
        bannerAssetId: uploadedAsset.id,
        bannerUrl: banner,
    })
    assert.deepEqual(withPanelBanner(null)(chosen), edited)
})
