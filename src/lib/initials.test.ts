import assert from "node:assert/strict"
import test from "node:test"

import { initialsOf } from "@/lib/initials"

test("two words give their first letters", () => {
    assert.equal(initialsOf("Váš klan"), "VK")
    assert.equal(initialsOf("  hráč   01 "), "H0")
})

test("one word gives its first two letters", () => {
    assert.equal(initialsOf("Ninjonik"), "NI")
    assert.equal(initialsOf("ž"), "Ž")
})

test("emoji and other wide characters are not split", () => {
    assert.equal(initialsOf("🐺 Wolves"), "🐺W")
})

test("a missing name uses the fallback", () => {
    assert.equal(initialsOf(undefined), "?")
    assert.equal(initialsOf("   ", "L"), "L")
})
