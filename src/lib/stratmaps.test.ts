import assert from "node:assert/strict"
import test from "node:test"

import {
    buildDefaultStratmapState,
    getStratmapCatalog,
    getWardogsStratmapCatalog,
    parseStratmapState,
    stringifyStratmapState,
} from "./stratmaps"

test("Wardogs supplies its distinct tactical icon catalog", () => {
    assert.deepEqual(
        getWardogsStratmapCatalog()
            .map((item) => item.id)
            .slice(0, 4),
        ["wd-fob", "wd-lonestar", "wd-manticore", "wd-valkyra"]
    )
    assert.ok(getStratmapCatalog().some((item) => item.id === "wd-helicopter"))
})

test("preserves a Wardogs base map and defaults its reference overlays on", () => {
    const state = buildDefaultStratmapState("bakurani")

    assert.equal(state.baseMapId, "bakurani")
    assert.equal(state.slides[0]?.overlays.showWardogsHqs, true)
    assert.equal(state.slides[0]?.overlays.showWardogsTowers, true)
})

test("preserves the selected main attachment when stratmap state is serialized", () => {
    const state = buildDefaultStratmapState("carentan")
    state.slides[0]!.elements.push({
        id: "icon-1",
        kind: "icon",
        iconId: "garry",
        x: 100,
        y: 100,
        size: 30,
        attachments: [
            { url: "https://example.com/one.jpg", description: "First" },
            {
                url: "https://example.com/two.jpg",
                description: "Main briefing",
            },
        ],
        mainAttachmentUrl: "https://example.com/two.jpg",
    })

    const parsed = parseStratmapState(stringifyStratmapState(state), "carentan")
    const icon = parsed.slides[0]!.elements[0]!

    assert.equal(icon.kind, "icon")
    if (icon.kind !== "icon") return
    assert.equal(icon.mainAttachmentUrl, "https://example.com/two.jpg")
    assert.equal(icon.attachments?.[1]?.description, "Main briefing")
})
