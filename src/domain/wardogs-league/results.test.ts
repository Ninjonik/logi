import {
    completedLeagueSnapshot,
    leagueSnapshotFixture,
} from "../../infrastructure/testing/league-fixtures"
import {
    leagueSeason,
    recentResults,
    resultRecordFromSnapshot,
    sameResult,
} from "./results"
import { leagueResultRecordSchema } from "./results.schema"
import assert from "node:assert/strict"
import test from "node:test"

test("a season is the calendar year in League time, also around New Year", () => {
    assert.equal(leagueSeason("2026-10-10T18:30:00.000Z"), "2026")
    // 00:30 on 1 January in Prague is still 2025 in UTC.
    assert.equal(leagueSeason("2025-12-31T23:30:00.000Z"), "2026")
    assert.equal(leagueSeason("2026-12-31T22:59:59.000Z"), "2026")
    assert.throws(() => leagueSeason("not a date"))
})

test("a scheduled page has no result; the parser never invents one", () => {
    assert.equal(
        resultRecordFromSnapshot(
            leagueSnapshotFixture(),
            "2026-10-02T18:32:33.561Z"
        ),
        null
    )
})

test("placements become a stored result with names, factions and the published rule", () => {
    const record = resultRecordFromSnapshot(
        completedLeagueSnapshot({
            id: "m37",
            fixtureNumber: 37,
            scheduledAt: "2026-10-08T18:00:00.000Z",
            podium: ["BAMC", "OSP", "DEF"],
        }),
        "2026-10-08T21:00:00.000Z"
    )
    assert.deepEqual(record, {
        matchId: "m37",
        sourceUrl: "https://wardogsleague.net/matches/m37",
        fixtureNumber: 37,
        type: "League",
        occurredAt: "2026-10-08T18:00:00.000Z",
        season: "2026",
        pointsRule: [3, 2, 1],
        pointsRuleSource: "published",
        confirmed: true,
        placements: [
            {
                place: 1,
                teamCode: "BAMC",
                teamName: "Batallón de Asalto, Maniobra y Combate",
                faction: "Lonestar",
            },
            {
                place: 2,
                teamCode: "OSP",
                teamName: "Ospreys",
                faction: "Valkyra",
            },
            {
                place: 3,
                teamCode: "DEF",
                teamName: "Defiant",
                faction: "Valkyra",
            },
        ],
    })
    assert.ok(leagueResultRecordSchema.safeParse(record).success)
})

test("an unreadable rule falls back to 3, 2, 1 and an unknown kickoff uses the first sighting", () => {
    const record = resultRecordFromSnapshot(
        completedLeagueSnapshot({
            id: "m1",
            fixtureNumber: 1,
            scheduledAt: null,
            podium: ["ROG", "VLK", "DEF"],
            scoringRule: "Winner takes it all",
            confirmed: false,
        }),
        "2026-01-01T10:00:00.000Z"
    )!
    assert.deepEqual(record.pointsRule, [3, 2, 1])
    assert.equal(record.pointsRuleSource, "default")
    assert.equal(record.occurredAt, "2026-01-01T10:00:00.000Z")
    assert.equal(record.confirmed, false)
})

test("tied places keep both teams, ordered by place then code", () => {
    const snapshot = completedLeagueSnapshot({
        id: "tie",
        fixtureNumber: 2,
        scheduledAt: "2026-10-01T18:00:00.000Z",
        podium: ["ROG", "VLK", "BAMC"],
    })
    snapshot.results = {
        confirmed: true,
        placements: [
            { place: 2, teamCode: "VLK" },
            { place: 1, teamCode: "ROG" },
            { place: 2, teamCode: "BAMC" },
        ],
    }
    const record = resultRecordFromSnapshot(snapshot, snapshot.fetchedAt)!
    assert.deepEqual(
        record.placements.map((entry) => [entry.place, entry.teamCode]),
        [
            [1, "ROG"],
            [2, "BAMC"],
            [2, "VLK"],
        ]
    )
    assert.equal(sameResult(record, { ...record }), true)
    assert.equal(sameResult(record, { ...record, confirmed: false }), false)
})

test("recent results keep the last seven days, newest first, podium only", () => {
    const now = Date.parse("2026-10-09T20:00:00.000Z")
    const make = (
        id: string,
        fixtureNumber: number,
        scheduledAt: string,
        podium: ["ROG", "VLK", "DEF"] | ["BAMC", "OSP", "DEF"]
    ) =>
        resultRecordFromSnapshot(
            completedLeagueSnapshot({ id, fixtureNumber, scheduledAt, podium }),
            scheduledAt
        )!
    const records = [
        make("m33", 33, "2026-10-03T18:00:00.000Z", ["ROG", "VLK", "DEF"]),
        make("m37", 37, "2026-10-08T18:00:00.000Z", ["BAMC", "OSP", "DEF"]),
        make("old", 20, "2026-10-01T18:00:00.000Z", ["ROG", "VLK", "DEF"]),
        make("future", 50, "2026-10-12T18:00:00.000Z", ["ROG", "VLK", "DEF"]),
    ]
    // A fourth finisher never shows in recent results.
    records[1].placements.push({
        place: 4,
        teamCode: "KOS",
        teamName: "Kosáci",
        faction: null,
    })
    const recent = recentResults(records, now)
    assert.deepEqual(
        recent.map((r) => r.fixtureNumber),
        [37, 33]
    )
    assert.deepEqual(
        recent[0].podium.map((entry) => `${entry.place}. ${entry.teamCode}`),
        ["1. BAMC", "2. OSP", "3. DEF"]
    )
    assert.deepEqual(recentResults(records, now, 2), [recent[0]])
})
