import assert from "node:assert/strict"
import test from "node:test"

import { parseClanResultReviews } from "./result-reviews"

test("clan result heads become review states by event", () => {
    const reviews = parseClanResultReviews([
        {
            eventId: "e1",
            status: "provisional",
            origin: "legacy_import",
            participants: [
                { id: "side-a", label: "VLK", score: 3 },
                { id: "side-b", label: "DEF", score: 2 },
            ],
        },
        {
            eventId: "e2",
            status: "confirmed",
            origin: "collected",
            participants: [
                { id: "axis", label: "Axis", score: 5 },
                { id: "allied", label: "Allies", score: null },
            ],
        },
    ])
    assert.deepEqual(reviews.get("e1"), {
        status: "provisional",
        origin: "legacy_import",
        scores: [3, 2],
    })
    assert.deepEqual(reviews.get("e2"), {
        status: "confirmed",
        origin: "collected",
        scores: null,
    })
})

test("unexpected rows are left out instead of failing the page", () => {
    assert.equal(parseClanResultReviews(null).size, 0)
    assert.equal(
        parseClanResultReviews([
            { eventId: "e1", status: "unknown", origin: "manual" },
            { eventId: 2, status: "confirmed" },
        ]).size,
        0
    )
})
