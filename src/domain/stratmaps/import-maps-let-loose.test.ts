import assert from "node:assert/strict"
import test from "node:test"

import { importMapsLetLooseJson } from "./import-maps-let-loose"

test("imports Maps Let Loose slides, assets, shapes, text and drawings", () => {
    const result = importMapsLetLooseJson([
        {
            name: "Opening",
            state: {
                controls: { map: "carentan", grid: false, defaultArty: true },
                elements: [
                    {
                        left: 100,
                        top: 200,
                        angle: 45,
                        scaleX: 1,
                        scaleY: 1,
                        type: { type: "tank", modifier: "heavy" },
                    },
                    {
                        left: 20,
                        top: 30,
                        width: 40,
                        height: 50,
                        fill: "#f00",
                        opacity: 0.5,
                        type: { type: "rectangle" },
                    },
                    {
                        left: 10,
                        top: 20,
                        text: "Hold here",
                        fontSize: 24,
                        width: 100,
                        fill: "#fff",
                        type: { type: "textbox" },
                    },
                ],
                drawings: [
                    {
                        left: 0,
                        top: 0,
                        stroke: "#0f0",
                        strokeWidth: 3,
                        type: { type: "drawing" },
                        path: [
                            ["M", 2, 3],
                            ["L", 4, 5],
                        ],
                    },
                ],
            },
        },
    ])

    assert.equal(result.baseMapId, "carentan")
    assert.equal(result.state.slides[0].overlays.showGrid, false)
    assert.equal(result.state.slides[0].overlays.showArtillery, true)
    assert.deepEqual(
        result.state.slides[0].elements.map((element) => element.kind),
        ["icon", "rectangle", "text", "freehand"]
    )
    assert.equal(
        (result.state.slides[0].elements[0] as { iconId: string }).iconId,
        "tank-heavy"
    )
    assert.equal(result.skippedElements, 0)
})

test("keeps slides importable when an upstream asset is unknown", () => {
    const result = importMapsLetLooseJson({
        name: "Unknown",
        state: { elements: [{ type: { type: "not-an-asset" } }], drawings: [] },
    })
    assert.equal(result.state.slides.length, 1)
    assert.equal(result.skippedElements, 1)
})
