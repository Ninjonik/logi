import assert from "node:assert/strict"
import test from "node:test"

import { getDictionary } from "@/i18n/dictionaries"

import { fill, panelErrorText } from "./panel-copy"
import { recoveryGap } from "./panel-time"

test("a recovered error reads in the past with the gap in words (P2-32)", () => {
    const dictionary = getDictionary("cs")
    const delivery = dictionary.discordPanelsPage.editor.delivery
    const error = { code: "discord_unavailable" as const }
    const past = panelErrorText(error, {
        channel: "#servery",
        dictionary,
        past: true,
    })
    assert.equal(
        `${past.title} ${fill(delivery.recovered, {
            after: recoveryGap(60_000, "cs", delivery.recoveredAfter),
        })}`,
        "Discord neodpověděl včas. Další pokus o minutu později prošel."
    )
    // A current error keeps the present title with the fix.
    assert.equal(
        panelErrorText(error, { channel: "#servery", dictionary }).title,
        "Discord teď neodpovídá."
    )
    assert.equal(
        panelErrorText(
            { code: "missing_permissions", permissions: ["embed_links"] },
            { channel: "#servery-wd", dictionary, past: true }
        ).title,
        "Bot neměl oprávnění Vkládat odkazy v #servery-wd."
    )
})

test("the recovery gap uses each language's plural forms", () => {
    const cs = getDictionary("cs").discordPanelsPage.editor.delivery
    assert.equal(recoveryGap(40_000, "cs", cs.recoveredAfter), "40 sekund")
    assert.equal(recoveryGap(120_000, "cs", cs.recoveredAfter), "2 minuty")
    assert.equal(recoveryGap(300_000, "cs", cs.recoveredAfter), "5 minut")
    assert.equal(recoveryGap(3_600_000, "cs", cs.recoveredAfter), "hodinu")
    const en = getDictionary("en").discordPanelsPage.editor.delivery
    assert.equal(
        fill(en.recovered, {
            after: recoveryGap(60_000, "en", en.recoveredAfter),
        }),
        "The next attempt a minute later went through."
    )
    const de = getDictionary("de").discordPanelsPage.editor.delivery
    assert.equal(
        fill(de.recovered, {
            after: recoveryGap(60_000, "de", de.recoveredAfter),
        }),
        "Der nächste Versuch eine Minute später ging durch."
    )
    // Every error code has its past wording in every language.
    for (const locale of ["cs", "en", "de"] as const) {
        const errors = getDictionary(locale).discordPanelStatus.errors
        for (const [code, copy] of Object.entries(errors))
            assert.ok(copy.past.trim(), `${locale} ${code}`)
    }
})
