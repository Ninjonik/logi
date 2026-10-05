import {
    buildFixturesView,
    buildStandingsView,
    fitWithinLimit,
    leagueFixturesViewSchema,
    leaguePanelOptionsSchema,
    DEFAULT_LEAGUE_PANEL_OPTIONS,
    LEAGUE_LINKS,
    LEAGUE_PANEL_KEYS,
    LEAGUE_PANEL_ORDER,
    type StoredLeagueFixture,
} from "./panels"
import {
    completedLeagueSnapshot,
    leagueSnapshotFixture,
    LEAGUE_TEAMS,
} from "../../infrastructure/testing/league-fixtures"
import { resultRecordFromSnapshot } from "./results"
import type { LeagueSnapshot } from "./contracts"
import assert from "node:assert/strict"
import test from "node:test"

const now = Date.parse("2026-10-09T12:00:00.000Z")
type Code = keyof typeof LEAGUE_TEAMS
const upcoming = (
    number: number,
    scheduledAt: string,
    codes: [Code, Code, Code],
    extra: Partial<LeagueSnapshot> = {}
): StoredLeagueFixture => ({
    matchId: `m${number}`,
    phase: "upcoming",
    stale: false,
    revision: number,
    snapshot: leagueSnapshotFixture({
        id: `m${number}`,
        fixtureNumber: number,
        scheduledAt,
        teams: codes.map((code) => LEAGUE_TEAMS[code]),
        hosting: { mode: "Self-hosted", teamCode: codes[0] },
        fetchedAt: new Date(now - 60_000).toISOString(),
        ...extra,
    }),
})
const result = (
    number: number,
    scheduledAt: string,
    podium: [Code, Code, Code],
    type = "League"
) =>
    resultRecordFromSnapshot(
        completedLeagueSnapshot({
            id: `m${number}`,
            fixtureNumber: number,
            scheduledAt,
            podium,
            type,
        }),
        scheduledAt
    )!
/** The board's fixtures #38–#43 plus one more than the default six. */
const BOARD_FIXTURES = [
    upcoming(38, "2026-10-10T18:30:00.000Z", ["VLK", "ROG", "BAMC"]),
    upcoming(39, "2026-10-11T16:00:00.000Z", ["OSP", "KOS", "TRN"], {
        map: null,
        rules: { summary: "2 of 3 picked", choices: null },
        moderator: "Kowalski",
    }),
    upcoming(40, "2026-10-11T19:00:00.000Z", ["MNT", "DEF", "HAV"], {
        map: null,
    }),
    upcoming(41, "2026-10-13T18:00:00.000Z", ["ROG", "HAV", "TRN"], {
        map: null,
        mapVote: null,
    }),
    upcoming(42, "2026-10-15T18:00:00.000Z", ["VLK", "MNT", "OSP"], {
        map: null,
        mapVote: null,
        hosting: { mode: "Self-hosted", teamCode: "MNT" },
    }),
    upcoming(43, "2026-10-17T17:00:00.000Z", ["BAMC", "DEF", "KOS"], {
        map: null,
        mapVote: null,
    }),
    upcoming(44, "2026-10-18T17:00:00.000Z", ["BAMC", "VLK", "KOS"]),
]
const RECENT = [
    result(33, "2026-10-03T18:00:00.000Z", ["ROG", "VLK", "DEF"]),
    result(34, "2026-10-04T18:00:00.000Z", ["OSP", "BAMC", "MNT"]),
    result(35, "2026-10-06T18:00:00.000Z", ["ROG", "HAV", "KOS"]),
    result(36, "2026-10-07T18:00:00.000Z", ["VLK", "MNT", "TRN"], "Friendly"),
    result(37, "2026-10-08T18:00:00.000Z", ["BAMC", "OSP", "DEF"]),
]

test("panel options default to all content and six fixtures, and reject unknown keys", () => {
    assert.deepEqual(
        leaguePanelOptionsSchema.parse(DEFAULT_LEAGUE_PANEL_OPTIONS),
        { table: true, fixtures: true, recentResults: true, fixtureCount: 6 }
    )
    assert.equal(
        leaguePanelOptionsSchema.safeParse({
            ...DEFAULT_LEAGUE_PANEL_OPTIONS,
            fixtureCount: 11,
        }).success,
        false
    )
    assert.equal(
        leaguePanelOptionsSchema.safeParse({
            ...DEFAULT_LEAGUE_PANEL_OPTIONS,
            channelId: "1",
        }).success,
        false
    )
    assert.deepEqual(LEAGUE_PANEL_ORDER, ["standings", "fixtures"])
    assert.notEqual(LEAGUE_PANEL_KEYS.standings, LEAGUE_PANEL_KEYS.fixtures)
})

test("without results the table waits: 'Tabulka se zobrazí po prvních výsledcích'", () => {
    const view = buildStandingsView([], {
        now,
        ourTeamCodes: ["VLK"],
        revision: 0,
    })
    assert.deepEqual(view, {
        kind: "standings",
        season: "2026",
        state: "waiting_for_results",
        matchesCounted: 0,
        pointsRule: [3, 2, 1],
        rows: [],
        revision: 0,
        links: { league: LEAGUE_LINKS.league },
    })
})

test("with results the table is ready for the current season and marks our team", () => {
    const view = buildStandingsView(
        [
            ...RECENT,
            result(1, "2025-10-01T18:00:00.000Z", ["VLK", "ROG", "DEF"]),
        ],
        { now, ourTeamCodes: ["VLK"], revision: 9 }
    )
    assert.equal(view.state, "ready")
    assert.equal(view.matchesCounted, 5)
    assert.deepEqual(
        view.rows.map((row) => [row.rank, row.teamCode, row.points, row.ours]),
        [
            [1, "ROG", 6, false],
            [2, "BAMC", 5, false],
            [2, "OSP", 5, false],
            [2, "VLK", 5, true],
            [5, "MNT", 3, false],
            [6, "HAV", 2, false],
            [7, "DEF", 2, false],
            [8, "KOS", 1, false],
            [8, "TRN", 1, false],
        ]
    )
    assert.equal(view.revision, 9)
})

test("nejbližší zápasy: six nearest fixtures of the whole League with teams, map, host and chips", () => {
    const view = buildFixturesView(BOARD_FIXTURES, RECENT, {
        now,
        ourTeamCodes: ["VLK"],
        options: DEFAULT_LEAGUE_PANEL_OPTIONS,
        revision: 3,
    })
    assert.ok(leagueFixturesViewSchema.parse(view))
    assert.deepEqual(
        view.fixtures.map((f) => f.fixtureNumber),
        [38, 39, 40, 41, 42, 43]
    )
    assert.equal(view.hidden, 1)
    assert.equal(view.total, 7)
    const first = view.fixtures[0]
    assert.deepEqual(first.teams[0], {
        code: "VLK",
        name: "Valkyria",
        nations: ["CZE", "SVK"],
        memberCount: 48,
        faction: "Valkyra",
        ours: true,
    })
    assert.equal(first.ours, true)
    assert.deepEqual(first.map, {
        name: "Zestafona",
        zone: "SmallFactory",
        lighting: "DayLateGrayFog",
    })
    assert.deepEqual(first.host, { teamCode: "VLK", mode: "Self-hosted" })
    assert.equal(first.type, "Friendly")
    assert.equal(first.scheduledAt, "2026-10-10T18:30:00.000Z")
    assert.equal(first.sourceUrl, "https://wardogsleague.net/matches/m38")
    // "Mapa po hlasování · Hostuje OSP".
    assert.equal(view.fixtures[1].map, null)
    assert.equal(view.fixtures[1].host?.teamCode, "OSP")
    assert.equal(view.fixtures[1].ours, false)
    assert.deepEqual(
        view.fixtures[1].preparation.map((chip) => [chip.kind, chip.tone]),
        [
            ["rules", "running"],
            ["mapVote", "done"],
            ["moderator", "done"],
            ["readyCheck", "pending"],
        ]
    )
    assert.deepEqual(view.fixtures[3].preparation, [
        { kind: "notStarted", tone: "pending" },
    ])
    assert.deepEqual(view.links, {
        fixtures: "https://wardogsleague.net/matches?tab=fixtures",
        results: "https://wardogsleague.net/matches?tab=results",
    })
    assert.equal(view.stale, false)
    assert.equal(view.revision, 3)
})

test("recent results sit under the fixtures: last seven days, podium, our team marked", () => {
    const view = buildFixturesView(BOARD_FIXTURES, RECENT, {
        now: Date.parse("2026-10-09T20:00:00.000Z"),
        ourTeamCodes: ["VLK"],
        options: DEFAULT_LEAGUE_PANEL_OPTIONS,
        revision: 0,
    })
    const recent = view.recentResults!
    assert.equal(recent.from, "2026-10-02T20:00:00.000Z")
    assert.equal(recent.to, "2026-10-09T20:00:00.000Z")
    assert.deepEqual(
        recent.items.map((item) => [
            item.fixtureNumber,
            item.type,
            item.podium.map(
                (p) => `${p.place}. ${p.teamCode}${p.ours ? "*" : ""}`
            ),
        ]),
        [
            [37, "League", ["1. BAMC", "2. OSP", "3. DEF"]],
            [36, "Friendly", ["1. VLK*", "2. MNT", "3. TRN"]],
            [35, "League", ["1. ROG", "2. HAV", "3. KOS"]],
            [34, "League", ["1. OSP", "2. BAMC", "3. MNT"]],
            [33, "League", ["1. ROG", "2. VLK*", "3. DEF"]],
        ]
    )
})

test("switched-off content is left out and live fixtures lead with no preparation chips", () => {
    const live = {
        ...upcoming(37, "2026-10-09T11:30:00.000Z", ["VLK", "ROG", "BAMC"]),
        phase: "live" as const,
        stale: true,
    }
    const view = buildFixturesView([...BOARD_FIXTURES, live], RECENT, {
        now,
        ourTeamCodes: [],
        options: {
            ...DEFAULT_LEAGUE_PANEL_OPTIONS,
            recentResults: false,
            fixtureCount: 2,
        },
        revision: 0,
    })
    assert.equal(view.recentResults, null)
    assert.deepEqual(
        view.fixtures.map((f) => [f.fixtureNumber, f.phase, f.preparation]),
        [
            [37, "live", []],
            [38, "upcoming", view.fixtures[1].preparation],
        ]
    )
    assert.equal(view.fixtures[0].teams[0].ours, false)
    assert.equal(view.hidden, 6)
    assert.equal(view.stale, true)
    const none = buildFixturesView(BOARD_FIXTURES, RECENT, {
        now,
        ourTeamCodes: [],
        options: { ...DEFAULT_LEAGUE_PANEL_OPTIONS, fixtures: false },
        revision: 0,
    })
    assert.deepEqual(none.fixtures, [])
    assert.equal(none.hidden, 0)
    assert.equal(none.recentResults?.items.length, 5)
})

test("fixtures that do not fit 4000 characters are dropped and counted", () => {
    const items = ["a".repeat(1500), "b".repeat(1500), "c".repeat(1500)]
    const measure = (shown: readonly string[], hidden: number) =>
        shown.join("").length + (hidden ? 40 : 0)
    assert.deepEqual(fitWithinLimit(items, measure), {
        shown: items.slice(0, 2),
        hidden: 1,
    })
    assert.deepEqual(fitWithinLimit(items.slice(0, 2), measure, 4000, 3), {
        shown: items.slice(0, 2),
        hidden: 3,
    })
    assert.deepEqual(fitWithinLimit(["x".repeat(5000)], measure), {
        shown: [],
        hidden: 1,
    })
    assert.deepEqual(fitWithinLimit([], measure), { shown: [], hidden: 0 })
})
