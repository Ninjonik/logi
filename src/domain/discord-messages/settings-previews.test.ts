import assert from "node:assert/strict"
import test from "node:test"

import {
    SETTINGS_PREVIEW_KINDS,
    SETTINGS_PREVIEW_NOW,
    settingsPreview,
    type SettingsPreviewInput,
    type SettingsPreviewKind,
} from "./settings-previews"
import { getDirectMessages } from "../../lib/clan-language/direct-messages"
import { getRosterMessages } from "../../lib/clan-language/rosters"
import { getSystemMessages } from "../../lib/clan-language/system"
import { validateMessageView } from "./message-validation"
import { layoutMessageView } from "./message-layout"

function input(
    kind: SettingsPreviewKind,
    language = "cs",
    overrides: Partial<SettingsPreviewInput> = {}
): SettingsPreviewInput {
    const system = getSystemMessages(language)
    return {
        kind,
        samples: system.previews,
        dm: getDirectMessages(language),
        roster: getRosterMessages(language),
        errors: system.errorsChannel,
        teamRequests: system.teamRequests,
        layout: { copy: system.kit, locale: system.locale },
        timeZone: "Europe/Prague",
        now: SETTINGS_PREVIEW_NOW,
        rosterVariant: "photo_text",
        siteUrl: "https://logi.example",
        ...overrides,
    }
}

const text = (preview: ReturnType<typeof settingsPreview>, language = "cs") => {
    const system = getSystemMessages(language)
    return layoutMessageView(preview.view, {
        copy: system.kit,
        locale: system.locale,
    })
        .nodes.map((node) =>
            node.type === "text"
                ? node.content
                : node.type === "section"
                  ? node.texts.join("\n")
                  : node.type === "buttons"
                    ? node.buttons
                          .map((button) => `[${button.label}]`)
                          .join(" ")
                    : ""
        )
        .join("\n")
}

test("every message row has a valid preview in every clan language (N1-B07)", () => {
    for (const language of ["cs", "en", "de"])
        for (const kind of SETTINGS_PREVIEW_KINDS) {
            const preview = settingsPreview(input(kind, language))
            const system = getSystemMessages(language)
            const result = validateMessageView(preview.view, {
                copy: system.kit,
                locale: system.locale,
            })
            assert.ok(
                result.ok,
                `${language} ${kind}: ${JSON.stringify(result)}`
            )
            assert.doesNotMatch(text(preview, language), /\{\w+\}|undefined/)
        }
})

test("the live preview is the board's announcement (N1-08)", () => {
    const preview = settingsPreview(input("announcement"))
    assert.equal(preview.content, "@Klan")
    assert.equal(preview.view.accent, "clan")
    assert.equal(preview.view.header?.title, "VLK vs ROG")
    assert.deepEqual(preview.view.header?.chips?.[0]?.label, "Přátelák")
    const rendered = text(preview)
    assert.match(rendered, /`VLK` Spojenci ★  vs  `ROG` Osa ✚/)
    assert.match(rendered, /\*\*ne <t:\d+:d> · <t:\d+:t>\*\* · <t:\d+:R>/)
    assert.match(
        rendered,
        /Foy · den · sraz <t:\d+:t> · přihlášky do so <t:\d+:d> · <t:\d+:t>/
    )
    assert.match(
        rendered,
        /\*\*Přihlášeno 23\*\* · Pěchota 15 · Tanky 6\/6 · Recon 2\/2/
    )
    assert.match(
        rendered,
        /\[Přihlásit se\] \[Upravit přihlášku\] \[Nepřijdu\]/
    )
    assert.match(rendered, /Spravováno v Logi/)
})

test("the clan's icon density changes the announcement's lines", () => {
    const system = getSystemMessages("cs")
    const preview = settingsPreview(input("announcement"))
    const sparse = layoutMessageView(preview.view, {
        copy: system.kit,
        locale: system.locale,
        style: { iconDensity: "sparse" },
    })
    const rich = layoutMessageView(preview.view, {
        copy: system.kit,
        locale: system.locale,
        style: { iconDensity: "rich", accentColor: "#123456" },
    })
    const all = (layout: typeof sparse) =>
        layout.nodes
            .map((node) => ("content" in node ? node.content : ""))
            .join("\n")
    assert.doesNotMatch(all(sparse), /🕒/)
    assert.match(all(rich), /🕒/)
    assert.equal(rich.accentColor, 0x123456)
})

test("the roster preview follows the default look (N1-11, N1-B05)", () => {
    const withText = text(settingsPreview(input("roster")))
    const photoOnly = text(
        settingsPreview(input("roster", "cs", { rosterVariant: "photo" }))
    )
    assert.ok(withText.length > photoOnly.length)
    assert.match(withText, /Able/)
})

test("system and decision samples use the W9 builders", () => {
    assert.match(
        text(settingsPreview(input("errors"))),
        /Ohlášení zápasu se neodeslalo/
    )
    assert.equal(settingsPreview(input("errors")).view.accent, "system")
    assert.match(
        text(settingsPreview(input("teamRequest"))),
        /Tým je v katalogu/
    )
    assert.match(
        text(settingsPreview(input("recruitmentPanel"))),
        /\[Podat přihlášku\]/
    )
    assert.match(
        text(settingsPreview(input("attendanceNotice"))),
        /Hráč 17 přijde později/
    )
})
