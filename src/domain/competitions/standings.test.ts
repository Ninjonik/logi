import { deriveDivisionStandings } from "./standings"
import assert from "node:assert/strict"
import test from "node:test"

test("ECL standings award each side its cap score and rank regular wins", () => {
    const rows = deriveDivisionStandings(
        [
            { id: "a", name: "A" },
            { id: "b", name: "B" },
        ],
        [
            {
                id: "1",
                divisionId: "d",
                teamAId: "a",
                teamBId: "b",
                scoreA: 5,
                scoreB: 0,
                status: "final",
            },
        ]
    )
    assert.deepEqual(
        rows.map(({ teamId, capScore, regularWins, totalMatches }) => ({
            teamId,
            capScore,
            regularWins,
            totalMatches,
        })),
        [
            { teamId: "a", capScore: 5, regularWins: 1, totalMatches: 1 },
            { teamId: "b", capScore: 0, regularWins: 0, totalMatches: 1 },
        ]
    )
})

test("three-team Wardogs results count every participant in the recorded order", () => {
    const teams = [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
    ]
    const rows = deriveDivisionStandings(teams, [
        {
            id: "three",
            teamAId: "a",
            teamBId: "b",
            participantTeamIds: ["a", "b", "c"],
            participantScores: [60, 80, 100],
            status: "final",
        },
    ])
    assert.deepEqual(
        rows.map((row) => [
            row.teamId,
            row.capScore,
            row.totalMatches,
            row.totalWins,
        ]),
        [
            ["c", 100, 1, 1],
            ["b", 80, 1, 0],
            ["a", 60, 1, 0],
        ]
    )
})
test("incomplete multi-team scores do not partially change standings, and tied leaders have no win", () => {
    const teams = [
        { id: "a", name: "A" },
        { id: "b", name: "B" },
        { id: "c", name: "C" },
    ]
    const fixture = {
        id: "three",
        teamAId: "a",
        teamBId: "b",
        participantTeamIds: ["a", "b", "c"],
        status: "final" as const,
    }
    assert.ok(
        deriveDivisionStandings(teams, [
            { ...fixture, participantScores: [100, 80, null] },
        ]).every((row) => row.totalMatches === 0)
    )
    assert.ok(
        deriveDivisionStandings(teams, [
            { ...fixture, participantScores: [100, 100, 60] },
        ]).every((row) => row.totalWins === 0)
    )
})
