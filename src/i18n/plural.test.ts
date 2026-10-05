import assert from "node:assert/strict"
import test from "node:test"

import { pluralize, type PluralForms } from "@/i18n/plural"

const czech: PluralForms = {
    one: "{count} divize",
    few: "{count} divize",
    many: "{count} divize",
    other: "{count} divizí",
}
const english: PluralForms = {
    one: "{count} division",
    few: "{count} divisions",
    many: "{count} divisions",
    other: "{count} divisions",
}

test("English uses the singular only for one", () => {
    assert.equal(pluralize("en", 1, english), "1 division")
    assert.equal(pluralize("en", 0, english), "0 divisions")
    assert.equal(pluralize("en", 3, english), "3 divisions")
})

test("Czech distinguishes one, few and other", () => {
    assert.equal(pluralize("cs", 1, czech), "1 divize")
    assert.equal(pluralize("cs", 3, czech), "3 divize")
    assert.equal(pluralize("cs", 5, czech), "5 divizí")
    assert.equal(pluralize("cs", 0, czech), "0 divizí")
})

test("German falls back to other for counts above one", () => {
    assert.equal(
        pluralize("de", 2, { ...english, other: "{count} Divisionen" }),
        "2 Divisionen"
    )
})

test("every placeholder is filled", () => {
    assert.equal(
        pluralize("en", 2, { ...english, other: "{count} of {count}" }),
        "2 of 2"
    )
})
