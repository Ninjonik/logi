import assert from "node:assert/strict"
import test from "node:test"

import { parsePresetMutation } from "./preset-mutation"

test("topic preset mutation preserves Discord attachment limits", () => {
    const result = parsePresetMutation("topic-presets", {
        name: "Briefing",
        topics: [
            {
                title: "Plan",
                attachments: Array.from(
                    { length: 11 },
                    (_, index) => `https://example.com/${index}.png`
                ),
            },
        ],
    })

    assert.equal(result.success, false)
})

test("squad preset mutation requires a complete roster layout", () => {
    const result = parsePresetMutation("squad-presets", {
        name: "Lineup",
        squads: [],
    })

    assert.equal(result.success, false)
})

test("stratmap mutation accepts dashboard-equivalent optional metadata", () => {
    const result = parsePresetMutation("stratmaps", {
        title: "Attack plan",
        baseMapId: "stmereeglise",
        state: '{"slides":[]}',
    })

    assert.equal(result.success, true)
})
