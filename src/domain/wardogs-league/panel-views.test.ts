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
    layoutMessageView,
    layoutTextLength,
    type MessageLayoutOptions,
} from "../discord-messages/message-layout"
import {
    boardLeagueFixtures,
    boardLeagueResults,
} from "../../infrastructure/testing/league-fixtures"
import {
    buildFixturesView,
    buildStandingsView,
    DEFAULT_LEAGUE_PANEL_OPTIONS,
} from "./panels"
import { validateMessageView } from "../discord-messages/message-validation"
import { getIntlLocaleForClanLanguage } from "../../lib/clan-language/core"
import { renderedView } from "../../infrastructure/testing/message-views"
import type { MessageView } from "../discord-messages/message-view"
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
        resultsCollected: true,
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

/** Installed application emoji, as the bot passes them (res. 79). */
const installedFactions = {
    valkyra: "<:logi_valkyra_b7775e08:1300000000000000008>",
    manticore: "<:logi_manticore_1e9e0bd4:1300000000000000009>",
    lonestar: "<:logi_lonestar_4d040007:1300000000000000010>",
}
const installedChips = {
    success: "<:logi_live_006a48ed:1300000000000000012>",
    warning: "<:logi_seeding_a5888993:1300000000000000013>",
    neutral: "<:logi_empty_c2d52697:1300000000000000014>",
    danger: "<:logi_offline_acd5f92f:1300000000000000015>",
}
const installedLook = (
    language: string,
    paused: LeaguePanelLook["paused"]
): LeaguePanelLook => {
    const base = look(language)
    return {
        ...base,
        layout: { ...base.layout, chipIcons: installedChips },
        emoji: installedFactions,
        chipIcons: installedChips,
        paused,
    }
}
/** What Discord counts, and whether the kit would accept the message. */
const posted = (view: MessageView, layout: MessageLayoutOptions) => {
    const laid = layoutMessageView(view, layout)
    const fields = view.blocks.find((block) => block.kind === "fields")
    return {
        length: layoutTextLength(laid),
        validation: validateMessageView(view, layout),
        shown: fields?.kind === "fields" ? fields.items.length : 0,
        text: laid.nodes
            .flatMap((node) =>
                node.type === "text"
                    ? [node.content]
                    : node.type === "section"
                      ? node.texts
                      : []
            )
            .join("\n"),
    }
}
const pausedSince = { since: now - 3600_000 }

test("a paused fixtures message filled to the limit with installed emoji is measured with its chip (L3-54, P6-B05)", () => {
    for (const language of ["cs", "en", "de"]) {
        const live = installedLook(language, null)
        const paused = installedLook(language, pausedSince)
        const running = posted(
            leagueFixturesMessage(fixtures, live, { fixtures: true }),
            live.layout
        )
        const stopped = posted(
            leagueFixturesMessage(fixtures, paused, { fixtures: true }),
            paused.layout
        )
        assert.deepEqual(stopped.validation, { ok: true, issues: [] })
        assert.ok(stopped.length <= 4000, `${language} ${stopped.length}`)
        assert.ok(stopped.shown <= running.shown)
        assert.ok(stopped.text.includes(installedChips.neutral))
        assert.ok(stopped.text.includes(paused.copy.pausedReason))
    }
    // The board fixtures with installed emoji: the live message shows five of
    // six; the paused chip and its detail leave room for four (was 4018).
    const cs = installedLook("cs", pausedSince)
    const board = posted(
        leagueFixturesMessage(fixtures, cs, { fixtures: true }),
        cs.layout
    )
    assert.equal(board.shown, 4)
    assert.match(board.text, /\*\*Pozastaveno\*\* · správce zastavil/)
    assert.match(board.text, /… a další 2 zápasy na webu ligy/)
    // Longer team names move the fit across the whole paused overhead.
    let tight = 0
    for (let pad = 0; pad <= 120; pad += 4) {
        const view = {
            ...fixtures,
            fixtures: fixtures.fixtures.map((fixture) => ({
                ...fixture,
                teams: fixture.teams.map((team) => ({
                    ...team,
                    name: `${team.name ?? team.code} ${"x".repeat(pad)}`,
                })),
            })),
        }
        const live = installedLook("cs", null)
        const running = posted(
            leagueFixturesMessage(view, live, { fixtures: true }),
            live.layout
        )
        const stopped = posted(
            leagueFixturesMessage(view, cs, { fixtures: true }),
            cs.layout
        )
        assert.deepEqual(
            stopped.validation,
            { ok: true, issues: [] },
            `pad ${pad}`
        )
        assert.ok(stopped.length <= 4000, `pad ${pad}: ${stopped.length}`)
        if (stopped.shown < running.shown) tight++
    }
    assert.ok(tight > 0, "some list sits within the paused overhead")
})

test("a paused table filled to the limit is measured with its chip (L3-54, P6-B05)", () => {
    const last = standings.rows[standings.rows.length - 1]
    const rows = Array.from({ length: 160 }, (_, index) => ({
        ...last,
        rank: index + 1,
        teamCode: `T${String(index).padStart(3, "0")}`,
        teamName: `Team ${index}`,
        ours: index === 1,
    }))
    for (const count of [140, 141, 142, 143, 144, 145, 150, 160]) {
        const view = { ...standings, rows: rows.slice(0, count) }
        for (const language of ["cs", "en", "de"]) {
            const paused = installedLook(language, pausedSince)
            const stopped = posted(
                leagueStandingsMessage(view, paused),
                paused.layout
            )
            assert.deepEqual(
                stopped.validation,
                { ok: true, issues: [] },
                `${language} ${count}`
            )
            assert.ok(stopped.length <= 4000, `${language} ${count}`)
            assert.ok(stopped.text.includes(paused.copy.pausedReason))
        }
    }
})
