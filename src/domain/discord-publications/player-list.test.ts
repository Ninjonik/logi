import assert from "node:assert/strict"
import test from "node:test"

import { playerListPage, sideQuotas } from "./player-list"
import type { LivePlayer } from "./live-panel"

const player = (name: string, side: string | null, kills: number | null) =>
    ({ id: null, name, side, kills, deaths: 0, cash: null }) as LivePlayer
const sides = [
    { key: "allies", label: "Spojenci", sign: "★" },
    { key: "axis", label: "Osa", sign: "✚" },
]
const other = { key: "", label: "Bez strany", sign: "" }

test("eight rows per page are split evenly between the sides", () => {
    assert.deepEqual(sideQuotas(2), [4, 4])
    assert.deepEqual(sideQuotas(3), [3, 3, 2])
    assert.deepEqual(sideQuotas(0), [])
})

test("each side is sorted by kills, ties by name, players without kills last", () => {
    const page = playerListPage(
        [
            player("b", "allies", 5),
            player("a", "allies", 5),
            player("c", "allies", null),
            player("z", "Axis", 9),
        ],
        sides,
        0,
        other
    )
    assert.deepEqual(
        page.groups.map((group) => [
            group.side.key,
            group.total,
            group.players.map((p) => p.name),
        ]),
        [
            ["allies", 3, ["a", "b", "c"]],
            ["axis", 1, ["z"]],
        ]
    )
})

test("pages count from the longest side and clamp out-of-range requests", () => {
    const roster = [
        ...Array.from({ length: 39 }, (_, i) => player(`al${i}`, "allies", i)),
        ...Array.from({ length: 39 }, (_, i) => player(`ax${i}`, "axis", i)),
    ]
    const first = playerListPage(roster, sides, 0, other)
    assert.equal(first.pages, 10)
    assert.equal(first.groups[0]?.players.length, 4)
    const last = playerListPage(roster, sides, 99, other)
    assert.equal(last.page, 9)
    assert.equal(last.groups[0]?.players.length, 3)
    assert.equal(playerListPage(roster, sides, -5, other).page, 0)
})

test("players without a known side are listed last, not dropped", () => {
    const page = playerListPage(
        [player("x", null, 1), player("y", "allies", 2)],
        sides,
        0,
        other
    )
    assert.deepEqual(
        page.groups.map((group) => group.side.label),
        ["Spojenci", "Bez strany"]
    )
})
