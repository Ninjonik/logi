import assert from "node:assert/strict"
import test from "node:test"

import { clanTeamsPath, teamSearchParam } from "./team-links"
import { TEAM_SEARCH_MAX } from "./team"

test("the team link opens the clan's Týmy searched for the team (L5-39, L2-57)", () => {
    assert.equal(
        clanTeamsPath({
            language: "cs",
            serverId: "k17abc",
            gameId: "hell_let_loose",
            team: "Vlci",
        }),
        "/cs/dashboard/servers/k17abc/teams?game=hell_let_loose&search=Vlci"
    )
    assert.equal(
        clanTeamsPath({
            language: "en",
            serverId: "k17abc",
            gameId: "wardogs",
            team: "  Rogue & Co.  ",
        }),
        "/en/dashboard/servers/k17abc/teams?game=wardogs&search=Rogue+%26+Co."
    )
    // Without a team it is the list of the game (L5-41).
    assert.equal(
        clanTeamsPath({
            language: "de",
            serverId: "k17abc",
            gameId: "wardogs",
            team: " ",
        }),
        "/de/dashboard/servers/k17abc/teams?game=wardogs"
    )
})

test("the page reads one bounded search value", () => {
    assert.equal(teamSearchParam(" Vlci "), "Vlci")
    assert.equal(teamSearchParam(["Vlci", "ROG"]), "")
    assert.equal(teamSearchParam(undefined), "")
    assert.equal(teamSearchParam("x".repeat(200)).length, TEAM_SEARCH_MAX)
})
