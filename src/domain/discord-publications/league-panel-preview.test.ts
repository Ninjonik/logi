import assert from "node:assert/strict"
import test from "node:test"

import type {
    LeagueFixturesView,
    LeagueStandingsView,
} from "../wardogs-league/panels"
import { renderedView } from "../../infrastructure/testing/message-views"
import { leaguePanelPreviews } from "./league-panel-preview"

const now = Date.parse("2026-10-05T16:00:00.000Z")
const standings: LeagueStandingsView = {
    kind: "standings",
    season: "2026",
    state: "ready",
    matchesCounted: 7,
    pointsRule: [3, 2, 1],
    rows: [
        ["ROG", "Rogues", 21],
        ["VLK", "Vlci", 18],
        ["BAM", "BAMC", 15],
        ["MNT", "Mantis", 9],
        ["KRT", "Kartel", 8],
        ["OWL", "Owls", 7],
    ].map(([teamCode, teamName, points], index) => ({
        rank: index + 1,
        teamCode: String(teamCode),
        teamName: String(teamName),
        points: Number(points),
        played: 7,
        firsts: 0,
        seconds: 0,
        thirds: 0,
        ours: teamCode === "VLK",
    })),
    revision: 1,
    links: { league: "https://wardogsleague.net" },
}
const fixture = (id: string, days: number) => ({
    matchId: id,
    sourceUrl: `https://wardogsleague.net/matches/${id}`,
    fixtureNumber: Number(id),
    type: "League",
    phase: "upcoming" as const,
    scheduledAt: new Date(now + days * 86_400_000).toISOString(),
    teams: [
        {
            code: "VLK",
            name: "Vlci",
            nations: null,
            memberCount: null,
            faction: "Valkyra",
            ours: true,
        },
        {
            code: "ROG",
            name: "Rogues",
            nations: null,
            memberCount: null,
            faction: "Manticore",
            ours: false,
        },
        {
            code: "BAM",
            name: "BAMC",
            nations: null,
            memberCount: null,
            faction: "Lonestar",
            ours: false,
        },
    ],
    map: { name: "Zestafona", zone: null, lighting: null },
    host: { teamCode: "VLK", mode: null },
    preparation: [
        {
            kind: "mapVote" as const,
            tone: "running" as const,
            closesAt: null,
            opensAt: null,
        },
    ],
    ours: true,
    stale: false,
    fetchedAt: new Date(now).toISOString(),
})
const fixtures: LeagueFixturesView = {
    kind: "fixtures",
    fixtures: [fixture("41", 5), fixture("42", 6), fixture("43", 8)],
    hidden: 3,
    total: 6,
    recentResults: {
        from: new Date(now - 7 * 86_400_000).toISOString(),
        to: new Date(now).toISOString(),
        items: [
            {
                matchId: "40",
                sourceUrl: "https://wardogsleague.net/matches/40",
                fixtureNumber: 40,
                type: "League",
                occurredAt: "2026-10-04T19:00:00.000Z",
                podium: [
                    { place: 2, teamCode: "VLK", teamName: "Vlci", ours: true },
                    {
                        place: 1,
                        teamCode: "ROG",
                        teamName: "Rogues",
                        ours: false,
                    },
                    {
                        place: 3,
                        teamCode: "BAM",
                        teamName: "BAMC",
                        ours: false,
                    },
                ],
            },
        ],
    },
    revision: 1,
    stale: false,
    links: {
        fixtures: "https://wardogsleague.net/matches",
        results: "https://wardogsleague.net/results",
    },
}
const options = {
    table: true,
    fixtures: true,
    recentResults: true,
    fixtureCount: 2,
}
const text = (view: ReturnType<typeof leaguePanelPreviews>[number]) =>
    JSON.stringify(view)

test("the WD League panel previews two messages: the table and the nearest fixtures (P2-54, P2-55)", () => {
    const views = leaguePanelPreviews({
        standings,
        fixtures,
        options,
        language: "cs",
        timeZone: "Europe/Prague",
        accentColor: null,
        now,
    })
    assert.equal(views.length, 2)
    const [table, next] = views
    assert.equal(table!.header?.label, "WD League · Tabulka")
    assert.match(text(table!), /Sezóna 2026/)
    assert.match(text(table!), /ROG/)
    assert.match(text(table!), /… a další 2 týmy/)
    assert.match(text(table!), /Celá tabulka/)
    assert.match(text(table!), /Body podle pravidel ligy/)
    assert.equal(next!.header?.label, "WD League · Nejbližší zápasy")
    assert.equal(next!.header?.title, "Tento týden")
    assert.match(text(next!), /hostí VLK/)
    assert.match(text(next!), /Příprava: hlasování o mapě/)
    // Two of three fixtures shown: one more plus the three the League hides.
    assert.match(text(next!), /… a další 4 zápasy/)
    assert.match(text(next!), /POSLEDNÍ VÝSLEDKY/)
    assert.match(text(next!), /ROG 1\. · VLK 2\. · BAM 3\./)
    assert.match(text(next!), /Otevřít na webu ligy/)
    assert.match(text(next!), /Zdroj wardogsleague\.net/)
    for (const view of views) {
        const rendered = renderedView(view, "cs")
        assert.ok(rendered.validation.ok, JSON.stringify(rendered.validation))
        assert.ok(rendered.buttons.every((button) => button.kind === "link"))
    }
})

test("switched-off parts post no message, and the table waits for results", () => {
    assert.equal(
        leaguePanelPreviews({
            standings,
            fixtures,
            options: { ...options, table: false },
            language: "en",
            timeZone: "UTC",
            accentColor: "#2bb3a3",
            now,
        }).length,
        1
    )
    const [waiting] = leaguePanelPreviews({
        standings: { ...standings, state: "waiting_for_results", rows: [] },
        fixtures: null,
        options: { ...options, fixtures: false, recentResults: false },
        language: "de",
        timeZone: "UTC",
        accentColor: null,
        now,
    })
    assert.match(
        text(waiting!),
        /Die Tabelle erscheint nach den ersten Ergebnissen/
    )
})
