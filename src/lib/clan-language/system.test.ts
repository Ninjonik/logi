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

/** Every string of a nested copy object with its path. */
function strings(value: unknown, path = ""): Array<[string, string]> {
    if (typeof value === "string") return [[path, value]]
    if (value && typeof value === "object")
        return Object.entries(value).flatMap(([key, child]) =>
            strings(child, path ? `${path}.${key}` : key)
        )
    return []
}

test("the errors channel, service status and team requests share keys and placeholders", () => {
    const cs = getSystemMessages("cs")
    for (const section of [
        "errorsChannel",
        "serviceStatus",
        "teamRequests",
    ] as const) {
        const reference = new Map(strings(cs[section]))
        for (const language of ["en", "de"]) {
            const other = new Map(strings(getSystemMessages(language)[section]))
            for (const [path, value] of reference) {
                // Plural forms may differ per language; `one` and `other` must exist.
                if (/\.(few|many)$/.test(path)) continue
                assert.ok(other.has(path), `${language} ${section}.${path}`)
                assert.deepEqual(
                    placeholders(other.get(path)!),
                    placeholders(value),
                    `${language} ${section}.${path}`
                )
            }
        }
    }
})

test("the system message copy in Czech is the board's wording (L5)", () => {
    const cs = getSystemMessages("cs")
    assert.equal(cs.errorsChannel.labelWithArea, "Chyba bota · {area}")
    assert.equal(cs.errorsChannel.reasonHeading, "Proč")
    assert.equal(cs.errorsChannel.fixHeading, "Co udělat")
    assert.deepEqual(cs.errorsChannel.retry, {
        afterFix: "Zkusí se znovu po opravě",
        byItself: "Zkusí se znovu sám",
        playerTold: "Hráč dostal zprávu, ať to zkusí později",
    })
    assert.equal(cs.serviceStatus.threadName, "Změny stavu")
    assert.equal(cs.serviceStatus.allRunning, "Všechno běží")
    assert.equal(cs.teamRequests.approvedTitle, "Tým je v katalogu")
    assert.equal(cs.teamRequests.mergedTitle, "Tým už v katalogu byl")
    assert.equal(cs.teamRequests.rejectedTitle, "Žádost o tým nebyla přijata")
    for (const language of ["cs", "de"])
        assert.doesNotMatch(
            strings(getSystemMessages(language).errorsChannel)
                .map(([, value]) => value)
                .join(" "),
            /Bot missing permissions|Discord said|While doing|Scope/
        )
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
