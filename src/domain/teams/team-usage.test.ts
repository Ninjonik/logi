import {
    changedTeamFields,
    isSimilarTeam,
    similarTeams,
    teamCatalogueState,
    teamUsageSchema,
} from "./team-usage"
import assert from "node:assert/strict"
import test from "node:test"

test("catalogue state separates active, archived and merged entries", () => {
    assert.equal(
        teamCatalogueState({ archivedAt: null, mergedIntoTeamId: null }),
        "active"
    )
    assert.equal(
        teamCatalogueState({
            archivedAt: "2026-10-01",
            mergedIntoTeamId: null,
        }),
        "archived"
    )
    assert.equal(
        teamCatalogueState({
            archivedAt: "2026-10-01",
            mergedIntoTeamId: "t2",
        }),
        "merged"
    )
})

test("similar teams share a name, a short code or all words of the shorter name", () => {
    const team = (name: string, shortCode: string | null = null) => ({
        name,
        shortCode,
    })
    assert.equal(isSimilarTeam(team("DEF Squad"), team("DEF")), true)
    assert.equal(isSimilarTeam(team("  def   squad "), team("DEF Squad")), true)
    assert.equal(
        isSimilarTeam(team("Iron Wolves"), team("Wolves of War")),
        false
    )
    assert.equal(isSimilarTeam(team("Wolves"), team("Wolves of War")), true)
    assert.equal(isSimilarTeam(team("Rogue", "ROG"), team("ROG")), true)
    assert.equal(isSimilarTeam(team("Rogue Unit"), team("Other", "RU")), false)
    assert.equal(isSimilarTeam(team("Rogue"), team("Other", "ROGUE")), true)
    assert.equal(isSimilarTeam(team("Alpha", "AL"), team("Beta", "al")), true)
    // A single letter or symbols alone never make teams look alike.
    assert.equal(isSimilarTeam(team("A Team"), team("A")), false)
    assert.equal(isSimilarTeam(team("!!!"), team("Omen")), false)
    // Accents stay significant, like the catalogue's own uniqueness.
    assert.equal(isSimilarTeam(team("Café"), team("Cafe")), false)
})

test("similar teams keep the given order, skip the request's own team and are bounded", () => {
    const candidates = [
        { id: "t1", name: "DEF", shortCode: null },
        { id: "t2", name: "DEF Squad", shortCode: null },
        { id: "t3", name: "Omen", shortCode: null },
        { id: "t4", name: "Squad", shortCode: null },
        { id: "t5", name: "def squad two", shortCode: null },
    ]
    assert.deepEqual(
        similarTeams({ name: "DEF Squad", shortCode: null }, candidates).map(
            (team) => team.id
        ),
        ["t1", "t2", "t4"]
    )
    assert.deepEqual(
        similarTeams(
            { name: "DEF Squad", shortCode: null, teamId: "t2" },
            candidates,
            2
        ).map((team) => team.id),
        ["t1", "t4"]
    )
})

test("usage rows are strict and bounded", () => {
    const usage = {
        teamId: "t1",
        competitions: [
            {
                id: "c1",
                name: "ECL",
                season: "2026",
                division: "Division 2",
                fixtures: 4,
                withdrawn: false,
            },
        ],
        competitionCount: 1,
        pendingRequests: 1,
        pendingRequestId: "r1",
    }
    assert.equal(teamUsageSchema.safeParse(usage).success, true)
    assert.equal(
        teamUsageSchema.safeParse({ ...usage, extra: true }).success,
        false
    )
    assert.equal(
        teamUsageSchema.safeParse({ ...usage, pendingRequests: -1 }).success,
        false
    )
})

test("a change request names the presentation fields it changes, in table order", () => {
    const team = {
        name: "ROG",
        shortCode: "ROG",
        description: null,
        links: [],
        logoAssetId: "a1",
    }
    assert.deepEqual(changedTeamFields(team, team), [])
    assert.deepEqual(
        changedTeamFields(
            {
                ...team,
                logoAssetId: "a2",
                links: ["https://rog.example"],
                description: "Since 2023.",
            },
            team
        ),
        ["logo", "links", "description"]
    )
    assert.deepEqual(
        changedTeamFields({ ...team, name: "Rogue", shortCode: null }, team),
        ["name", "shortCode"]
    )
})
