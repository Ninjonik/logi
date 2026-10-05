import assert from "node:assert/strict"
import test from "node:test"

import {
    clanPlayersOnServer,
    eventNamesServer,
    RUNNING_MATCH_LEAD_MS,
    runningMatchFor,
    type RunningMatchEvent,
} from "./running-match"

const start = Date.parse("2026-10-11T18:00:00.000Z")
const event = (
    overrides: Partial<RunningMatchEvent> = {}
): RunningMatchEvent => ({
    id: "event-1",
    name: "Vlci vs Rogue",
    gameId: "hell_let_loose",
    isDraft: false,
    server: "Vlci #1",
    gameStart: new Date(start).toISOString(),
    gameEnd: new Date(start + 2 * 3_600_000).toISOString(),
    matchType: "friendly",
    side: "allies",
    teams: [
        { slot: "a", side: "Allies", code: "VLK" },
        { slot: "b", side: "Axis", code: "ROG" },
    ],
    ...overrides,
})
const server = {
    gameId: "hell_let_loose",
    names: ["Vlci #1 · Public", "PR158 TEST · HLL synthetic"],
    address: "203.0.113.24:7777",
    categoryLabel: (id: string) => (id === "friendly" ? "Přátelák" : null),
}

test("a match running on the server gives the team codes by side and the category", () => {
    assert.deepEqual(
        runningMatchFor([event()], { ...server, now: start + 60_000 }),
        {
            eventId: "event-1",
            title: "VLK vs ROG",
            category: "Přátelák",
            startedAt: start,
            allies: "VLK",
            axis: "ROG",
        }
    )
})

test("only from the warm-up to the end, never drafts or another game", () => {
    const at = (now: number, overrides: Partial<RunningMatchEvent> = {}) =>
        runningMatchFor([event(overrides)], { ...server, now })
    assert.ok(at(start - RUNNING_MATCH_LEAD_MS))
    assert.equal(at(start - RUNNING_MATCH_LEAD_MS - 1), null)
    assert.equal(at(start + 2 * 3_600_000 + 1), null)
    assert.equal(at(start, { isDraft: true }), null)
    assert.equal(at(start, { gameId: "wardogs" }), null)
})

test("the event's server must name this server exactly", () => {
    assert.equal(eventNamesServer("vlci #1", server), true)
    assert.equal(eventNamesServer("203.0.113.24:7777", server), true)
    assert.equal(eventNamesServer("Vlci #1 · Public", server), true)
    assert.equal(
        eventNamesServer("Vlci #1", { names: ["Vlci #10"], address: null }),
        false
    )
    assert.equal(eventNamesServer("1", server), false)
    assert.equal(eventNamesServer(null, server), false)
})

test("without two team codes the title is the event name", () => {
    const match = runningMatchFor(
        [event({ teams: [{ slot: "a", side: "Allies", code: "VLK" }] })],
        { ...server, now: start }
    )
    assert.equal(match?.title, "Vlci vs Rogue")
    assert.equal(match?.axis, null)
})

test("Z klanu hraje lists verified members once, in the live order", () => {
    assert.deepEqual(
        clanPlayersOnServer(
            [
                { id: "s2", name: "Bizon" },
                { id: null, name: "Guest" },
                { id: "s1", name: "Rex_CZ" },
                { id: "s2", name: "Bizon" },
                { id: "s9", name: "Stranger" },
            ],
            new Set(["s1", "s2"])
        ),
        ["Bizon", "Rex_CZ"]
    )
})
