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
    assert.equal(
        (result.state.slides[0].elements[0] as { color: string }).color,
        "#0080ff"
    )
    assert.equal(result.skippedElements, 0)
    assert.equal(
        (result.state.slides[0].elements[3] as { strokeColor: string })
            .strokeColor,
        "#00ff00"
    )
})

test("normalizes imported green aliases to the quick-select green", () => {
    const result = importMapsLetLooseJson({
        state: {
            elements: [],
            drawings: [
                {
                    left: 0,
                    top: 0,
                    stroke: "green",
                    type: { type: "drawing" },
                    path: [
                        ["M", 0, 0],
                        ["L", 4, 4],
                    ],
                },
            ],
        },
    })

    assert.equal(
        (result.state.slides[0].elements[0] as { strokeColor: string })
            .strokeColor,
        "#00ff00"
    )
})

test("uses Maps Let Loose's enemy red for enemy icon assets", () => {
    const result = importMapsLetLooseJson({
        name: "Enemy markers",
        state: {
            elements: [
                {
                    type: { type: "tank", modifier: "heavy", side: "enemy" },
                },
            ],
            drawings: [],
        },
    })

    assert.equal(
        (result.state.slides[0].elements[0] as { color: string }).color,
        "#ff8080"
    )
})

test("keeps slides importable when an upstream asset is unknown", () => {
    const result = importMapsLetLooseJson({
        name: "Unknown",
        state: { elements: [{ type: { type: "not-an-asset" } }], drawings: [] },
    })
    assert.equal(result.state.slides.length, 1)
    assert.equal(result.skippedElements, 1)
})
