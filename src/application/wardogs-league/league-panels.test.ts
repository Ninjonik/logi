import {
    completedLeagueSnapshot,
    InMemoryLeagueStore,
    leagueReadOf,
    leagueSnapshotFixture,
} from "../../infrastructure/testing/league-fixtures"
import { DEFAULT_LEAGUE_PANEL_OPTIONS } from "../../domain/wardogs-league/panels"
import type { LeagueSnapshot } from "../../domain/wardogs-league/contracts"
import { collectLeagueFixtures } from "./league-fixtures"
import { loadLeaguePanels } from "./league-panels"
import assert from "node:assert/strict"
import test from "node:test"

const now = Date.parse("2026-10-09T12:00:00.000Z")
const url = (id: string) => `https://wardogsleague.net/matches/${id}`

async function collect(
    store: InMemoryLeagueStore,
    pages: Record<string, LeagueSnapshot>
) {
    return collectLeagueFixtures(
        store.collectionPorts(async (source) =>
            leagueReadOf(pages[source.split("/").pop()!] ?? null, store.current)
        ),
        20
    )
}

test("before any parsed result: fixtures ship and the table waits for the first results", async () => {
    const store = new InMemoryLeagueStore(now)
    store.admit({
        fixtureUrls: [url("m38"), url("m39")],
        resultUrls: [url("m37")],
    })
    await collect(store, {
        m38: leagueSnapshotFixture({
            id: "m38",
            sourceUrl: url("m38"),
            fetchedAt: new Date(now - 1000).toISOString(),
        }),
        m39: leagueSnapshotFixture({
            id: "m39",
            sourceUrl: url("m39"),
            fixtureNumber: 39,
            scheduledAt: "2026-10-11T16:00:00.000Z",
            fetchedAt: new Date(now - 1000).toISOString(),
        }),
        // A finished match page as parsed today: no placements.
        m37: leagueSnapshotFixture({
            id: "m37",
            sourceUrl: url("m37"),
            fixtureNumber: 37,
            status: "Completed",
            scheduledAt: "2026-10-08T18:00:00.000Z",
            fetchedAt: new Date(now - 1000).toISOString(),
        }),
    })
    const panels = await loadLeaguePanels(store.panelSource(), {
        now,
        ourTeamCodes: ["VLK"],
        options: DEFAULT_LEAGUE_PANEL_OPTIONS,
    })
    assert.equal(panels.standings?.state, "waiting_for_results")
    assert.deepEqual(
        panels.fixtures?.fixtures.map((f) => f.fixtureNumber),
        [38, 39]
    )
    assert.deepEqual(panels.fixtures?.recentResults?.items, [])
    assert.equal(store.fixtures.get("m37")?.phase, "completed")
})

test("once results are parsed the table, recent results and revisions follow", async () => {
    const store = new InMemoryLeagueStore(now)
    store.admit({
        fixtureUrls: [url("m38")],
        resultUrls: [url("m33"), url("m37")],
    })
    const pages: Record<string, LeagueSnapshot> = {
        m38: leagueSnapshotFixture({
            id: "m38",
            sourceUrl: url("m38"),
            fetchedAt: new Date(now - 1000).toISOString(),
        }),
        m33: completedLeagueSnapshot({
            id: "m33",
            fixtureNumber: 33,
            scheduledAt: "2026-10-03T18:00:00.000Z",
            podium: ["ROG", "VLK", "DEF"],
            fetchedAt: new Date(now - 1000).toISOString(),
        }),
        m37: completedLeagueSnapshot({
            id: "m37",
            fixtureNumber: 37,
            scheduledAt: "2026-10-08T18:00:00.000Z",
            podium: ["BAMC", "OSP", "DEF"],
            fetchedAt: new Date(now - 1000).toISOString(),
        }),
    }
    await collect(store, pages)
    const panels = await loadLeaguePanels(store.panelSource(), {
        now,
        ourTeamCodes: ["VLK"],
        options: DEFAULT_LEAGUE_PANEL_OPTIONS,
    })
    assert.equal(panels.standings?.state, "ready")
    assert.equal(panels.standings?.matchesCounted, 2)
    assert.deepEqual(
        panels.standings?.rows.map((r) => [r.teamCode, r.points, r.ours]),
        [
            ["BAMC", 3, false],
            ["ROG", 3, false],
            // A 2nd place outranks DEF's two 3rd places at equal points.
            ["OSP", 2, false],
            ["VLK", 2, true],
            ["DEF", 2, false],
        ]
    )
    assert.deepEqual(
        panels.fixtures?.recentResults?.items.map((r) => r.fixtureNumber),
        [37, 33]
    )
    assert.equal(panels.standings?.revision, 2)
    assert.equal(panels.fixtures?.revision, 6)
})

test("switched-off content produces no panel", async () => {
    const store = new InMemoryLeagueStore(now)
    const panels = await loadLeaguePanels(store.panelSource(), {
        now,
        ourTeamCodes: [],
        options: {
            table: false,
            fixtures: false,
            recentResults: false,
            fixtureCount: 6,
        },
    })
    assert.deepEqual(panels, { standings: null, fixtures: null })
    const onlyResults = await loadLeaguePanels(store.panelSource(), {
        now,
        ourTeamCodes: [],
        options: { ...DEFAULT_LEAGUE_PANEL_OPTIONS, fixtures: false },
    })
    assert.deepEqual(onlyResults.fixtures?.fixtures, [])
    assert.ok(onlyResults.fixtures?.recentResults)
})
