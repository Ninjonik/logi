import assert from "node:assert/strict"
import test from "node:test"

import { categoryInitials } from "./category-initials"

test("category badges have two letters, as on the board (N4-29..N4-31)", () => {
    assert.equal(categoryInitials("Hlavní člen"), "HČ")
    assert.equal(categoryInitials("Záloha"), "ZA")
    assert.equal(categoryInitials("Žoldák"), "ŽO")
    assert.equal(categoryInitials("  velení   WD tým "), "VW")
    assert.equal(categoryInitials("Útok"), "UT")
    assert.equal(categoryInitials("Řízení"), "ŘI")
    assert.equal(categoryInitials("X"), "X")
    assert.equal(categoryInitials(""), "?")
    assert.equal(categoryInitials(undefined), "?")
})
