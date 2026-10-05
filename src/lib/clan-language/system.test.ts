import assert from "node:assert/strict"
import test from "node:test"

import { getSystemMessages } from "./system"

const placeholders = (value: string) =>
    [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()

test("the Czech frame and error copy is the board's wording", () => {
    const cs = getSystemMessages("cs")
    assert.deepEqual(cs.kit, {
        updated: "Aktualizováno {time}",
        refreshEvery: "obnovuje se každých {seconds} s",
        managed: "Spravováno v Logi",
        dmClan: "Klan {clan}",
        dmSettings: "Nastavit zprávy",
        page: "Strana {page} z {pages}",
        paused: "Pozastaveno",
        lastData: "poslední data {time}",
    })
    assert.deepEqual(cs.paging, { previous: "Předchozí", next: "Další" })
    assert.equal(cs.errors.unknownTitle, "Tohle se nepovedlo")
    assert.equal(
        cs.errors.unknownBody,
        "Zkus to za chvíli znovu. Když to nepůjde, napiš správcům klanu."
    )
    assert.equal(cs.errors.adminNotified, "Správci dostali upozornění.")
})

test("every language has the same kit keys and placeholders", () => {
    const cs = getSystemMessages("cs")
    for (const language of ["en", "de"]) {
        const other = getSystemMessages(language)
        for (const section of [
            "kit",
            "paging",
            "errors",
            "publication",
        ] as const) {
            assert.deepEqual(
                Object.keys(other[section]).sort(),
                Object.keys(cs[section]).sort(),
                `${language} ${section}`
            )
            for (const [key, value] of Object.entries(cs[section]))
                assert.deepEqual(
                    placeholders(
                        (other[section] as Record<string, string>)[key]!
                    ),
                    placeholders(value),
                    `${language} ${section}.${key}`
                )
        }
    }
})

test("delivery errors fit the stored error field and contain no English in cs or de", () => {
    for (const language of ["en", "cs", "de"]) {
        const { publication } = getSystemMessages(language)
        for (const message of Object.values(publication))
            assert.ok(message.length <= 240, `${language}: ${message.length}`)
    }
    for (const language of ["cs", "de"])
        assert.doesNotMatch(
            Object.values(getSystemMessages(language).publication).join(" "),
            /Discord delivery failed|Delivery uncertain|retry/
        )
})
