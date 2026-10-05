import assert from "node:assert/strict"
import test from "node:test"

import { resolveClanOutcome } from "./match-result"
import { calendarDayOffset } from "./calendar-day"
import { factionEmblem } from "./faction-emblem"

const hll = (allies: number | null, axis: number | null) => [
    { label: "Allies", score: allies },
    { label: "Axis", score: axis },
]

test("the clan's outcome follows the side it played", () => {
    assert.deepEqual(
        resolveClanOutcome({ participants: hll(3, 2), clanSide: "Allies" }),
        { outcome: "win", clanIndex: 0 }
    )
    assert.deepEqual(
        resolveClanOutcome({ participants: hll(3, 2), clanSide: " axis " }),
        { outcome: "loss", clanIndex: 1 }
    )
    assert.equal(
        resolveClanOutcome({ participants: hll(2, 2), clanSide: "Axis" })
            ?.outcome,
        "draw"
    )
    // Wardogs: three factions, the best other score decides.
    assert.equal(
        resolveClanOutcome({
            participants: [
                { label: "Valkyra", score: 40 },
                { label: "Manticore", score: 55 },
                { label: "Lonestar", score: 10 },
            ],
            clanSide: "Valkyra",
        })?.outcome,
        "loss"
    )
})

test("an unknown side or missing score never claims an outcome", () => {
    assert.equal(
        resolveClanOutcome({ participants: hll(3, 2), clanSide: null }),
        null
    )
    assert.equal(
        resolveClanOutcome({ participants: hll(3, 2), clanSide: "Blue" }),
        null
    )
    assert.equal(
        resolveClanOutcome({ participants: hll(null, 2), clanSide: "Allies" }),
        null
    )
    assert.equal(
        resolveClanOutcome({ participants: hll(3, null), clanSide: "Allies" }),
        null
    )
    assert.equal(
        resolveClanOutcome({
            participants: [{ label: "Allies", score: 3 }],
            clanSide: "Allies",
        }),
        null
    )
})

test("older imports keep their recorded outcome only while the scores match", () => {
    const imported = {
        outcome: "defeat" as const,
        score: { sideA: 1, sideB: 4 },
    }
    assert.deepEqual(
        resolveClanOutcome({
            participants: [
                { label: "Axis", score: 1 },
                { label: "Allies", score: 4 },
            ],
            imported,
        }),
        { outcome: "loss", clanIndex: null }
    )
    assert.equal(
        resolveClanOutcome({
            participants: [
                { label: "Axis", score: 2 },
                { label: "Allies", score: 4 },
            ],
            imported,
        }),
        null
    )
})

test("calendar day offsets use the clan's time zone", () => {
    const game = Date.parse("2026-10-11T18:00:00.000Z")
    assert.equal(
        calendarDayOffset(
            game,
            Date.parse("2026-10-10T21:59:00Z"),
            "Europe/Prague"
        ),
        1
    )
    assert.equal(
        calendarDayOffset(
            game,
            Date.parse("2026-10-10T22:01:00Z"),
            "Europe/Prague"
        ),
        0
    )
    assert.equal(
        calendarDayOffset(game, Date.parse("2026-10-10T22:01:00Z"), "UTC"),
        1
    )
    assert.equal(calendarDayOffset(game, game + 86400000, "UTC"), -1)
    assert.equal(calendarDayOffset(Number.NaN, game, "UTC"), undefined)
    assert.equal(
        calendarDayOffset(game, Date.parse("2026-10-11T01:00:00Z"), "Bad/Zone"),
        0
    )
})

test("faction emblems prefer installed emoji and fall back per faction", () => {
    assert.equal(factionEmblem("Allies"), "★")
    assert.equal(factionEmblem("axis"), "✚")
    assert.equal(factionEmblem("Valkyra"), "◈")
    assert.equal(
        factionEmblem("Valkyra", { valkyra: "<:logi_valkyra:1>" }),
        "<:logi_valkyra:1>"
    )
    assert.equal(factionEmblem("Alpha"), undefined)
    assert.equal(factionEmblem(null), undefined)
})
