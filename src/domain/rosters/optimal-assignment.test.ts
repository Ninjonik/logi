import { optimalAssignment } from "./optimal-assignment"
import assert from "node:assert/strict"
import test from "node:test"

test("global allocation moves a flexible player to preserve a specialist's only choice", () => {
    const result = optimalAssignment({
        players: [
            { score: 1000, kd: 10 },
            { score: 1, kd: 1 },
        ],
        slotCount: 2,
        choices: [
            { player: 0, slot: 0, rank: 0 },
            { player: 0, slot: 1, rank: 1 },
            { player: 1, slot: 0, rank: 0 },
        ],
    })
    assert.deepEqual(
        result.sort((a, b) => a.player - b.player),
        [
            { player: 0, slot: 1 },
            { player: 1, slot: 0 },
        ]
    )
})

test("signup rank beats score, and score beats K/D", () => {
    const players = [
        { score: 100, kd: 1 },
        { score: 20, kd: 10 },
    ]
    const choices = [
        { player: 0, slot: 0, rank: 1 },
        { player: 1, slot: 0, rank: 0 },
    ]
    assert.equal(
        optimalAssignment({ players, choices, slotCount: 1 })[0].player,
        1
    )
    choices[0].rank = 0
    assert.equal(
        optimalAssignment({ players, choices, slotCount: 1 })[0].player,
        0
    )
    players[1].score = 100
    assert.equal(
        optimalAssignment({ players, choices, slotCount: 1 })[0].player,
        1
    )
})

test("50 players with five preferences produce a full unique allocation", (t) => {
    const players = Array.from({ length: 50 }, (_, index) => ({
        score: index,
        kd: index / 10,
    }))
    const choices = players.flatMap((_, player) =>
        Array.from({ length: 50 }, (_, slot) => ({
            player,
            slot,
            rank: Math.floor(slot / 10),
        }))
    )
    const start = performance.now()
    const result = optimalAssignment({ players, slotCount: 50, choices })
    t.diagnostic(
        `50-player allocation: ${(performance.now() - start).toFixed(1)}ms`
    )
    assert.equal(result.length, 50)
    assert.equal(new Set(result.map((item) => item.player)).size, 50)
    assert.equal(new Set(result.map((item) => item.slot)).size, 50)
})

test("exhaustive small-case oracle agrees on cardinality and preference ranks", () => {
    for (let seed = 1; seed <= 30; seed++) {
        const players = Array.from({ length: 4 }, () => ({ score: 0, kd: 0 }))
        const choices = players.flatMap((_, player) =>
            Array.from({ length: 3 }, (_, slot) => ({
                player,
                slot,
                rank: (seed + player * 7 + slot * 3) % 3,
            })).filter(
                (choice) => (choice.player * 3 + choice.slot + seed) % 4 !== 0
            )
        )
        let best = -1
        function visit(player: number, slots: Set<number>, value: number) {
            if (player === 4) {
                best = Math.max(best, value)
                return
            }
            visit(player + 1, slots, value)
            for (const choice of choices.filter(
                (choice) => choice.player === player && !slots.has(choice.slot)
            )) {
                const next = new Set(slots)
                next.add(choice.slot)
                visit(player + 1, next, value + 1000 + 5 ** (2 - choice.rank))
            }
        }
        visit(0, new Set(), 0)
        const actual = optimalAssignment({ players, slotCount: 3, choices })
        const value = actual.reduce(
            (sum, item) =>
                sum +
                1000 +
                5 **
                    (2 -
                        choices.find(
                            (choice) =>
                                choice.player === item.player &&
                                choice.slot === item.slot
                        )!.rank),
            0
        )
        assert.equal(value, best, `seed ${seed}`)
    }
})
