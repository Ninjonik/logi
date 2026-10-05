import assert from "node:assert/strict"
import test from "node:test"

import {
    messageLineIcon,
    normalizeAccentColor,
    normalizeMessageStyle,
} from "./message-style"

test("accent colours are six-digit hex values in upper case", () => {
    assert.equal(normalizeAccentColor("#e8a33d"), "#E8A33D")
    assert.equal(normalizeAccentColor(" E8A33D "), "#E8A33D")
    for (const value of ["", "#fff", "#E8A33D0", "red", "#GGGGGG", null])
        assert.equal(normalizeAccentColor(value), undefined)
})

test("a stored style keeps only valid values", () => {
    assert.deepEqual(
        normalizeMessageStyle({ accentColor: "#5865f2", iconDensity: "rich" }),
        { accentColor: "#5865F2", iconDensity: "rich" }
    )
    assert.deepEqual(
        normalizeMessageStyle({ accentColor: 12, iconDensity: "loud" }),
        {}
    )
    assert.deepEqual(normalizeMessageStyle(undefined), {})
})

test("the sparse style keeps only the team sign, the rich style an icon per line", () => {
    assert.equal(messageLineIcon("start", undefined), "")
    assert.equal(messageLineIcon("start", "sparse"), "")
    assert.equal(messageLineIcon("teams", "sparse"), "🛡️ ")
    assert.equal(messageLineIcon("start", "rich"), "🕒 ")
    assert.equal(messageLineIcon("details", "rich"), "🗺️ ")
})
