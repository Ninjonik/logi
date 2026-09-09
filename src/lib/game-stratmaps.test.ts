import assert from "node:assert/strict"
import test from "node:test"

import { getStratmapMapById, getStratmapMaps } from "./game-stratmaps"

test("Vietnam exposes a placeholder map with capture points", () => {
    const maps = getStratmapMaps("hell_let_loose_vietnam")

    assert.equal(maps.length, 1)
    assert.equal(maps[0]?.imagePath, "/maps/hllv-placeholder.svg")
    assert.equal(maps[0]?.strongpoints.length, 5)
    assert.equal(maps[0]?.strongpoints[0]?.label, "Alpha (placeholder)")
})

test("Wardogs exposes a separate placeholder map with capture points", () => {
    const map = getStratmapMapById("wardogs-placeholder", "wardogs")

    assert.equal(map?.imagePath, "/maps/wardogs-placeholder.svg")
    assert.equal(map?.strongpoints.length, 5)
    assert.equal(map?.strongpoints[4]?.label, "Echo (placeholder)")
})
