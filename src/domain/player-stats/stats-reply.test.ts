import assert from "node:assert/strict"
import test from "node:test"

import {
    statsFooter,
    statsNumber,
    statsPeriodLabel,
    statsReplyButtons,
    statsTitle,
    wardogsOverviewFields,
    type WardogsOverviewPlayer,
} from "./stats-reply"
import { statsCopy } from "./stats-copy"

const player: WardogsOverviewPlayer = {
    matches: 23,
    wins: 14,
    winRate: 14 / 23,
    unknownResults: 0,
    kd: 1.37,
    metrics: {
        kills: { value: 412, knownGames: 23 },
        deaths: { value: 301, knownGames: 23 },
        cashDelta: { value: 1500, knownGames: 21 },
        seconds: { value: 36_000, knownGames: 23 },
    },
}

test("the Wardogs overview lists combat, record, cash and coverage", () => {
    const copy = statsCopy("cs")
    const fields = wardogsOverviewFields(copy, player, statsNumber("cs"))
    assert.deepEqual(
        fields.map((field) => field.name),
        ["🎯 Boj", "🏆 Bilance", "💰 Cash / odehraný čas", "Pokrytí metrik"]
    )
    assert.equal(
        fields[0]!.value,
        "Zabití **412** · Úmrtí **301**\nK/D **1,37**"
    )
    assert.match(
        fields[1]!.value,
        /^Výhry \*\*14\/23\*\* · Úspěšnost \*\*60,87 %\*\*/
    )
    // Cash is known for 21 of 23 games, so it is marked and listed.
    assert.match(
        fields[2]!.value,
        /Změna cash \*\*1\s500\*\*\* · Odehráno \*\*10 h\*\*/
    )
    assert.equal(fields[3]!.value, "cashDelta: 21/23")
})

test("title, period and footer follow the game", () => {
    const copy = statsCopy("en")
    assert.equal(statsTitle("wardogs", "Player 17"), "WARDOGS · Player 17")
    assert.equal(statsTitle("hll", "x".repeat(300)).length, 256)
    assert.equal(statsPeriodLabel(copy, "30d"), "30 d")
    assert.equal(statsPeriodLabel(copy, "all"), copy.all)
    assert.match(statsFooter(copy, "wardogs"), /^Logi \/ Warcon · /)
    assert.match(statsFooter(copy, "hll"), /^HLL Records · /)
    assert.equal(statsNumber("en")(null), "—")
})

test("buttons depend on the game, the requester and sharing", () => {
    const copy = statsCopy("en")
    const actions = (rows: ReturnType<typeof statsReplyButtons>) =>
        rows.map((row) => row.map((button) => button.action))
    assert.deepEqual(
        actions(
            statsReplyButtons(copy, {
                game: "wardogs",
                publishable: true,
                self: true,
                shared: false,
            })
        ),
        [
            ["overview", "refresh", "recent", "factions"],
            ["link", "share"],
        ]
    )
    assert.deepEqual(
        actions(
            statsReplyButtons(copy, {
                game: "hll",
                publishable: true,
                self: false,
                shared: true,
            })
        ),
        [["overview", "refresh", "recent", "weapons", "maps"]]
    )
    assert.deepEqual(
        actions(
            statsReplyButtons(copy, {
                game: "wardogs",
                publishable: false,
                self: false,
                shared: false,
            })
        ),
        [["overview", "refresh"]]
    )
    assert.equal(
        statsReplyButtons(copy, {
            game: "wardogs",
            publishable: true,
            self: false,
            shared: false,
        })[1]?.[0]?.primary,
        true
    )
})
