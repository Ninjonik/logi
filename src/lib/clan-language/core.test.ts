import assert from "node:assert/strict"
import test from "node:test"

import {
    clanCopy,
    formatClanDateTime,
    formatClanRelativeTime,
    getIntlLocaleForClanLanguage,
    isClanLanguage,
    resolveClanLanguage,
    supportedClanLanguages,
} from "./core"
import { getMembershipMessages } from "./membership"
import { getCommandMessages } from "./commands"
import { getSystemMessages } from "./system"
import { getPanelMessages } from "./panels"
import { getEventMessages } from "./events"

test("unknown, missing and empty languages resolve to English", () => {
    assert.deepEqual(supportedClanLanguages, ["en", "cs", "de"])
    for (const language of ["en", "cs", "de"] as const) {
        assert.equal(isClanLanguage(language), true)
        assert.equal(resolveClanLanguage(language), language)
    }
    for (const value of [undefined, null, "", "xx", "CS", "en-GB"]) {
        assert.equal(isClanLanguage(value), false)
        assert.equal(resolveClanLanguage(value), "en")
    }
})

test("each clan language has its Intl locale", () => {
    assert.equal(getIntlLocaleForClanLanguage("cs"), "cs-CZ")
    assert.equal(getIntlLocaleForClanLanguage("de"), "de-DE")
    assert.equal(getIntlLocaleForClanLanguage("en"), "en-GB")
    assert.equal(getIntlLocaleForClanLanguage("fr"), "en-GB")
})

test("a copy getter returns the language entry with its locale and falls back to English", () => {
    const get = clanCopy({
        en: { hello: "Hello" },
        cs: { hello: "Ahoj" },
        de: { hello: "Hallo" },
    })
    assert.deepEqual(get("cs"), { locale: "cs-CZ", hello: "Ahoj" })
    assert.deepEqual(get("unknown"), { locale: "en-GB", hello: "Hello" })
    assert.equal(get("de"), get("de"), "entries are built once per language")
})

test("every feature module has the same sections in every language", () => {
    for (const getter of [
        getEventMessages,
        getPanelMessages,
        getMembershipMessages,
        getCommandMessages,
        getSystemMessages,
    ]) {
        const keys = (language: string) =>
            Object.keys(getter(language)).filter(
                // Czech intentionally reads the platform flow from English's Czech fallback.
                (key) =>
                    key !== "platformFlow" && key !== "platformFlowCsFallback"
            )
        assert.deepEqual(keys("cs"), keys("en"))
        assert.deepEqual(keys("de"), keys("en"))
    }
})

test("dates follow Discord's long date and short time in the clan language", () => {
    const at = Date.parse("2026-10-11T18:00:00Z")
    assert.equal(
        formatClanDateTime("cs", at, "Europe/Prague"),
        "11. října 2026 v 20:00"
    )
    assert.equal(
        formatClanDateTime("de", at, "Europe/Berlin"),
        "11. Oktober 2026 um 20:00"
    )
    assert.equal(formatClanDateTime("cs", Number.NaN), undefined)
})

test("relative times count in the clan language from an explicit now", () => {
    const now = Date.parse("2026-10-05T18:00:00Z")
    assert.equal(
        formatClanRelativeTime("cs", now - 2 * 60_000, now),
        "před 2 minutami"
    )
    assert.equal(
        formatClanRelativeTime("cs", now + 6 * 86_400_000, now),
        "za 6 dní"
    )
    assert.equal(
        formatClanRelativeTime("en", now - 6_000, now),
        "6 seconds ago"
    )
    assert.equal(
        formatClanRelativeTime("de", now + 3 * 3_600_000, now),
        "in 3 Stunden"
    )
    assert.equal(formatClanRelativeTime("en", Number.NaN, now), undefined)
})
