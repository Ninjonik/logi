import {
    ANSI_OUR_ROW,
    ANSI_RESET,
    codeBlockCell,
    layoutStandingsTable,
} from "./standings-table"
import {
    completedLeagueSnapshot,
    LEAGUE_TEAMS,
} from "../../infrastructure/testing/league-fixtures"
import { resultRecordFromSnapshot, type LeagueResultRecord } from "./results"
import { computeStandings } from "./standings"
import assert from "node:assert/strict"
import test from "node:test"

type Code = keyof typeof LEAGUE_TEAMS
/**
 * Sixteen synthetic results that reproduce the board's table (P6-08); the
 * last five are the board's recent results #33–#37.
 */
const BOARD_RESULTS: Array<[Code, Code, Code]> = [
    ["ROG", "BAMC", "OSP"],
    ["ROG", "HAV", "KOS"],
    ["BAMC", "ROG", "HAV"],
    ["BAMC", "KOS", "VLK"],
    ["VLK", "KOS", "ROG"],
    ["VLK", "OSP", "TRN"],
    ["OSP", "BAMC", "MNT"],
    ["MNT", "DEF", "HAV"],
    ["MNT", "TRN", "BAMC"],
    ["KOS", "HAV", "VLK"],
    ["DEF", "ROG", "OSP"],
    ["ROG", "VLK", "DEF"],
    ["OSP", "BAMC", "MNT"],
    ["ROG", "HAV", "KOS"],
    ["VLK", "MNT", "TRN"],
    ["BAMC", "OSP", "DEF"],
]
function results(
    rows: Array<[Code, Code, Code]>,
    options: { season?: string; scoringRule?: string } = {}
): LeagueResultRecord[] {
    return rows.map((podium, index) => {
        const day = String(1 + index).padStart(2, "0")
        const scheduledAt = `${options.season ?? "2026"}-09-${day}T18:00:00.000Z`
        return resultRecordFromSnapshot(
            completedLeagueSnapshot({
                id: `m${index + 22}`,
                fixtureNumber: index + 22,
                scheduledAt,
                podium,
                scoringRule: options.scoringRule,
            }),
            scheduledAt
        )!
    })
}
const LABELS = {
    rank: "#",
    team: "Tým",
    points: "B",
    played: "Z",
    first: "1.",
    second: "2.",
    third: "3.",
    name: "Název",
}

test("the board's table: 16 matches, 3/2/1 points, matches and podium counts", () => {
    const table = computeStandings(results(BOARD_RESULTS), {
        season: "2026",
        ourTeamCodes: ["VLK"],
    })
    assert.equal(table.matchesCounted, 16)
    assert.deepEqual(table.pointsRule, [3, 2, 1])
    assert.deepEqual(
        table.rows.map((row) => [
            row.rank,
            row.teamCode,
            row.points,
            row.played,
            row.firsts,
            row.seconds,
            row.thirds,
            row.ours,
        ]),
        [
            [1, "ROG", 17, 7, 4, 2, 1, false],
            [2, "BAMC", 16, 7, 3, 3, 1, false],
            [3, "VLK", 13, 6, 3, 1, 2, true],
            [4, "OSP", 12, 6, 2, 2, 2, false],
            [5, "MNT", 10, 5, 2, 1, 2, false],
            [6, "KOS", 9, 5, 1, 2, 2, false],
            [7, "HAV", 8, 5, 0, 3, 2, false],
            [8, "DEF", 7, 4, 1, 1, 2, false],
            [9, "TRN", 4, 3, 0, 1, 2, false],
        ]
    )
})

test("the code block matches the board character for character", () => {
    const table = computeStandings(results(BOARD_RESULTS), {
        season: "2026",
        ourTeamCodes: ["VLK"],
    })
    assert.equal(
        layoutStandingsTable(table.rows, LABELS).text,
        [
            " #  Tým    B   Z  1.  2.  3.  Název",
            " 1  ROG   17   7   4   2   1  Team Rogue",
            " 2  BAMC  16   7   3   3   1  Batallón de Asalto, Manio…",
            "›3  VLK   13   6   3   1   2  Valkyria",
            " 4  OSP   12   6   2   2   2  Ospreys",
            " 5  MNT   10   5   2   1   2  Mountain Rangers",
            " 6  KOS    9   5   1   2   2  Kosáci",
            " 7  HAV    8   5   0   3   2  Havran Squad",
            " 8  DEF    7   4   1   1   2  Defiant",
            " 9  TRN    4   3   0   1   2  Tarantula",
        ].join("\n")
    )
    const ansi = layoutStandingsTable(table.rows, LABELS, { ansi: true })
    assert.equal(
        ansi.lines[3],
        `${ANSI_OUR_ROW}›3  VLK   13   6   3   1   2  Valkyria${ANSI_RESET}`
    )
    assert.equal(ansi.lines[1], " 1  ROG   17   7   4   2   1  Team Rogue")
})

test("tie-breakers: points, 1st places, 2nd, 3rd, fewer matches; equal teams share the rank", () => {
    // VLK's 7 points beat ROG's two wins; HAV and KOS have identical
    // records, share third place and are listed by code.
    const table = computeStandings(
        results([
            ["ROG", "VLK", "DEF"],
            ["ROG", "VLK", "DEF"],
            ["VLK", "DEF", "TRN"],
            ["KOS", "HAV", "TRN"],
            ["HAV", "KOS", "TRN"],
        ]),
        { season: "2026", ourTeamCodes: [] }
    )
    assert.deepEqual(
        table.rows.map((r) => [r.rank, r.teamCode, r.points, r.firsts]),
        [
            [1, "VLK", 7, 1],
            [2, "ROG", 6, 2],
            [3, "HAV", 5, 1],
            [3, "KOS", 5, 1],
            [5, "DEF", 4, 0],
            [6, "TRN", 3, 0],
        ]
    )
    // Same points and podiums: fewer matches ranks higher.
    const fewer = computeStandings(
        [
            ...results([["ROG", "VLK", "DEF"]]),
            {
                ...results([["VLK", "ROG", "DEF"]])[0],
                matchId: "four-teams",
                placements: [
                    {
                        place: 1,
                        teamCode: "TRN",
                        teamName: null,
                        faction: null,
                    },
                    {
                        place: 2,
                        teamCode: "MNT",
                        teamName: null,
                        faction: null,
                    },
                    {
                        place: 3,
                        teamCode: "OSP",
                        teamName: null,
                        faction: null,
                    },
                    {
                        place: 4,
                        teamCode: "ROG",
                        teamName: null,
                        faction: null,
                    },
                ],
            },
        ],
        { season: "2026", ourTeamCodes: [] }
    )
    assert.deepEqual(
        fewer.rows.slice(0, 2).map((r) => [r.rank, r.teamCode, r.played]),
        [
            [1, "TRN", 1],
            [2, "ROG", 2],
        ]
    )
})

test("only the requested season counts, duplicates count once, and mixed rules are reported", () => {
    const thisSeason = results([["ROG", "VLK", "DEF"]])
    const lastSeason = results([["VLK", "ROG", "DEF"]], { season: "2025" })
    const table = computeStandings(
        [...thisSeason, ...lastSeason, thisSeason[0]],
        { season: "2026", ourTeamCodes: ["VLK"] }
    )
    assert.equal(table.matchesCounted, 1)
    assert.deepEqual(
        table.rows.map((r) => [r.teamCode, r.points]),
        [
            ["ROG", 3],
            ["VLK", 2],
            ["DEF", 1],
        ]
    )
    const mixed = computeStandings(
        [
            ...thisSeason,
            ...results([["VLK", "ROG", "DEF"]], {
                scoringRule: "1st 5 · 2nd 3 · 3rd 1",
            }).map((r) => ({ ...r, matchId: "other" })),
        ],
        { season: "2026", ourTeamCodes: [] }
    )
    assert.equal(mixed.pointsRule, null)
    assert.deepEqual(
        mixed.rows.map((r) => [r.teamCode, r.points]),
        [
            ["VLK", 7],
            ["ROG", 6],
            ["DEF", 2],
        ]
    )
})

test("an empty season waits for the first results with the default rule", () => {
    const table = computeStandings([], {
        season: "2027",
        ourTeamCodes: ["VLK"],
    })
    assert.deepEqual(table, {
        season: "2027",
        matchesCounted: 0,
        pointsRule: [3, 2, 1],
        rows: [],
    })
    assert.deepEqual(layoutStandingsTable([], LABELS).lines, [
        " #  Tým   B   Z  1.  2.  3.  Název",
    ])
})

test("untrusted names cannot close the code block or inject terminal colours", () => {
    assert.equal(codeBlockCell("Evil```\u001b[31m\nTeam"), "Evil''' [31m Team")
    assert.equal(codeBlockCell(null), "")
    const table = layoutStandingsTable(
        [
            {
                rank: 10,
                teamCode: "X",
                teamName: "A".repeat(40),
                points: 100,
                played: 40,
                firsts: 30,
                seconds: 5,
                thirds: 5,
                ours: true,
            },
        ],
        LABELS,
        { nameWidth: 10 }
    )
    assert.equal(table.lines[1], "›10  X    100  40  30   5   5  AAAAAAAAA…")
    assert.doesNotMatch(table.text, /`/)
})
