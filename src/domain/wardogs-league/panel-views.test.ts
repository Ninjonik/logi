import {
    fixtureField,
    leagueDay,
    leagueFixturesMessage,
    leagueLinkReplyMessage,
    leagueStandingsMessage,
    preparationLine,
    type LeaguePanelLook,
} from "./panel-views"
import {
    boardLeagueFixtures,
    boardLeagueResults,
} from "../../infrastructure/testing/league-fixtures"
import {
    buildFixturesView,
    buildStandingsView,
    DEFAULT_LEAGUE_PANEL_OPTIONS,
} from "./panels"
import { getIntlLocaleForClanLanguage } from "../../lib/clan-language/core"
import { renderedView } from "../../infrastructure/testing/message-views"
import { getSystemMessages } from "../../lib/clan-language/system"
import { getLeagueMessages } from "../../lib/clan-language/league"
import assert from "node:assert/strict"
import test from "node:test"

const now = Date.parse("2026-10-09T20:00:00.000Z")
const look = (language = "cs", extra: Partial<LeaguePanelLook> = {}) => {
    const copy = getLeagueMessages(language)
    return {
        copy,
        locale: copy.locale,
        timeZone: "Europe/Prague",
        accentColor: null,
        layout: {
            copy: getSystemMessages(language).kit,
            locale: getIntlLocaleForClanLanguage(language),
        },
        emoji: {},
        paused: null,
        now,
        ...extra,
    } satisfies LeaguePanelLook
}
const standings = buildStandingsView(boardLeagueResults(), {
    now,
    ourTeamCodes: ["VLK"],
    revision: 1,
    dataAt: now,
})
const fixtures = buildFixturesView(
    boardLeagueFixtures(now),
    boardLeagueResults(),
    {
        now,
        ourTeamCodes: ["VLK"],
        options: DEFAULT_LEAGUE_PANEL_OPTIONS,
        revision: 1,
        dataAt: now,
    }
)

test("both panels and the reply are valid Discord messages in every clan language", () => {
    for (const language of ["cs", "en", "de"]) {
        for (const view of [
            leagueStandingsMessage(standings, look(language)),
            leagueFixturesMessage(fixtures, look(language), { fixtures: true }),
            leagueLinkReplyMessage(
                {
                    matchId: "m",
                    sourceUrl: "https://wardogsleague.net/matches/m",
                    fixtureNumber: 41,
                    teamCodes: ["VLK", "MNT", "DEF"],
                    scheduledAt: "2026-10-24T18:00:00.000Z",
                    panelChannelId: "100000000000000002",
                    panelMessageUrl: null,
                },
                look(language)
            ),
        ]) {
            const rendered = renderedView(view, language)
            assert.deepEqual(rendered.validation, { ok: true, issues: [] })
            assert.equal(view.accent, "clan")
        }
    }
})

test("a panel colour of its own replaces the clan colour, state stays in chips", () => {
    const view = leagueStandingsMessage(
        standings,
        look("cs", { accentColor: "#4F9DE0" })
    )
    assert.deepEqual(view.accent, { custom: "#4F9DE0" })
})

test("preparation chips read green done, orange running, grey not yet with the vote deadline", () => {
    const line = preparationLine(
        [
            { kind: "rules", tone: "done", picked: 3, total: 3 },
            {
                kind: "mapVote",
                tone: "running",
                closesAt: "2026-10-10T11:00:00.000Z",
                opensAt: null,
            },
            {
                kind: "mapVote",
                tone: "pending",
                closesAt: null,
                opensAt: "2026-10-10T08:00:00.000Z",
            },
            { kind: "readyCheck", tone: "running" },
            { kind: "readyCheck", tone: "done" },
        ],
        look()
    )
    assert.equal(
        line,
        "🟢 **Pravidla 3/3** · 🟡 **Hlasování o mapě** · končí <t:1791630000:R> · ⚪ **Hlasování o mapě od so 10. 10.** · 🟡 **Ready check běží** · 🟢 **Ready check hotový**"
    )
})

test("a live fixture carries the Živě chip, no relative time and no preparation", () => {
    const field = fixtureField(
        { ...fixtures.fixtures[0], phase: "live", preparation: [] },
        look()
    )
    assert.deepEqual(field.chip, { label: "Živě", tone: "success" })
    assert.doesNotMatch(field.text ?? "", /:R>/)
    assert.doesNotMatch(field.text ?? "", /Pravidla/)
    const unknown = fixtureField(
        {
            ...fixtures.fixtures[0],
            fixtureNumber: null,
            type: null,
            scheduledAt: null,
            host: { teamCode: null, mode: "League-hosted" },
            map: null,
        },
        look("en")
    )
    assert.equal(unknown.title, "—")
    assert.match(
        unknown.text ?? "",
        /Map after the vote · Hosted by the league/
    )
})

test("days and ranges follow the clan's time zone", () => {
    assert.deepEqual(
        leagueDay("2026-10-02T22:30:00.000Z", "cs-CZ", "Europe/Prague"),
        { day: 3, month: 10, monthShort: "říj" }
    )
    const copy = getLeagueMessages("cs").recent
    assert.equal(
        copy.range(
            { day: 3, month: 10, monthShort: "" },
            { day: 9, month: 10, monthShort: "" }
        ),
        "3.–9. 10."
    )
    assert.equal(
        copy.range(
            { day: 28, month: 9, monthShort: "" },
            { day: 4, month: 10, monthShort: "" }
        ),
        "28. 9.–4. 10."
    )
    assert.equal(
        getLeagueMessages("en").recent.range(
            { day: 3, month: 10, monthShort: "Oct" },
            { day: 9, month: 10, monthShort: "Oct" }
        ),
        "3–9 Oct"
    )
})

test("Czech counts use the right plural forms", () => {
    const copy = getLeagueMessages("cs")
    assert.equal(copy.standings.played(1), "Po 1 zápase")
    assert.equal(copy.standings.played(16), "Po 16 zápasech")
    assert.equal(copy.fixtures.members(1), "1 člen")
    assert.equal(copy.fixtures.members(3), "3 členové")
    assert.equal(copy.fixtures.members(48), "48 členů")
    assert.equal(
        copy.fixtures.meta(6),
        "6 nejbližších zápasů · časy v tvém pásmu"
    )
    assert.equal(
        copy.fixtures.meta(2),
        "2 nejbližší zápasy · časy v tvém pásmu"
    )
    assert.equal(copy.fixtures.more(1), "… a další zápas na webu ligy")
    assert.equal(copy.fixtures.more(4), "… a další 4 zápasy na webu ligy")
    assert.equal(copy.fixtures.more(8), "… a dalších 8 zápasů na webu ligy")
    assert.equal(copy.standings.moreTeams(8), "… a dalších 8 týmů")
    assert.equal(
        copy.standings.rule([3, 2, 1]),
        "body: 1. místo 3 · 2. místo 2 · 3. místo 1"
    )
})
