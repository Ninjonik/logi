import assert from "node:assert/strict"
import test from "node:test"

import type {
    LeagueFixturesView,
    LeagueStandingsView,
} from "@/domain/wardogs-league/panels"
import { renderedView } from "@/infrastructure/testing/message-views"
import { leaguePreviews } from "./editor-preview"

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
    dataAt: new Date(now).toISOString(),
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
    dataAt: new Date(now).toISOString(),
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
const base = {
    standings,
    fixtures,
    options,
    language: "cs",
    timeZone: "Europe/Prague",
    style: null,
    accentColor: null,
    paused: false,
    artwork: true,
    assetOrigin: "https://logi.example",
    now,
}
const text = (view: ReturnType<typeof leaguePreviews>[number]) =>
    JSON.stringify(view)

test("the WD League preview is the bot's two messages: the table and the nearest fixtures (P2-54, P2-55)", () => {
    const views = leaguePreviews(base)
    assert.equal(views.length, 2)
    const [table, next] = views
    assert.equal(table!.header?.title, "WD League · tabulka")
    assert.match(text(table!), /sezóna 2026/)
    assert.match(text(table!), /ROG/)
    assert.equal(next!.header?.title, "WD League · nejbližší zápasy")
    assert.match(text(next!), /Hostuje VLK/)
    assert.match(text(next!), /Hlasování o mapě/)
    // Two of three fixtures shown: one more plus the three the League hides.
    assert.match(text(next!), /… a další 4 zápasy/)
    assert.match(text(next!), /Poslední výsledky/)
    // Built-in map art through the dashboard's image route.
    assert.match(
        text(next!),
        /logi\.example\/_next\/image\?url=%2Fmaps%2Fwardogs%2Fzestafona/
    )
    for (const view of views) {
        const rendered = renderedView(view, "cs")
        assert.ok(rendered.validation.ok, JSON.stringify(rendered.validation))
        assert.ok(rendered.buttons.every((button) => button.kind === "link"))
    }
})

test("switched-off parts post no message, map art follows its switch and a paused panel says so", () => {
    assert.equal(
        leaguePreviews({ ...base, options: { ...options, table: false } })
            .length,
        1
    )
    const [onlyResults] = leaguePreviews({
        ...base,
        options: { ...options, table: false, fixtures: false },
    })
    assert.doesNotMatch(text(onlyResults!), /#41/)
    assert.match(text(onlyResults!), /#40/)
    const [, noArt] = leaguePreviews({ ...base, artwork: false })
    assert.doesNotMatch(text(noArt!), /_next\/image/)
    const [, noRecent] = leaguePreviews({
        ...base,
        options: { ...options, recentResults: false },
    })
    assert.doesNotMatch(text(noRecent!), /#40/)
    const [paused] = leaguePreviews({ ...base, paused: true })
    assert.ok(paused!.header?.paused)
    const [waiting] = leaguePreviews({
        ...base,
        standings: { ...standings, state: "waiting_for_results", rows: [] },
        fixtures: null,
        language: "de",
    })
    assert.doesNotMatch(text(waiting!), /ansi/)
})

test("the League preview shows the installed faction emoji when the overview knows them (P2-B09)", () => {
    const [, plain] = leaguePreviews(base)
    assert.doesNotMatch(text(plain!), /logi_valkyra/)
    const [, signed] = leaguePreviews({
        ...base,
        emoji: { valkyra: "<:logi_valkyra_1a2b3c4d:200000000000000031>" },
    })
    assert.match(text(signed!), /<:logi_valkyra_1a2b3c4d:200000000000000031>/)
})
