import assert from "node:assert/strict"
import test from "node:test"

import {
    draftChanges,
    draftFromSettings,
    draftProblems,
    draftToSettings,
    freeResultsGame,
    moveServer,
    newPanelDraft,
    panelTypeOptions,
    passwordAllowed,
    resultsGamesTaken,
    serverJoinDraft,
    serverJoinPatch,
    serverJoinProblems,
    takenPanelKinds,
    toggleServer,
} from "./panel-editor"
import { DEFAULT_PANEL_CONTENT, panelSaveSchema } from "./settings"

const channelId = "123456789012345678"

test("a new panel is a live server with everything on except the password", () => {
    const draft = newPanelDraft()
    assert.equal(draft.kind, "server")
    assert.equal(draft.content.password, false)
    assert.equal(draft.content.footerTiming, true)
    assert.equal(draft.accent, "clan")
    assert.equal(draft.style, null)
    assert.deepEqual(draft.league, {
        table: true,
        fixtures: true,
        recentResults: true,
        fixtureCount: 6,
    })
})

test("the draft saves exactly the panel's own fields and the save schema accepts it", () => {
    const draft = {
        ...newPanelDraft({ connectionId: "hll-1" }),
        channelId,
        title: "  Vlci #1 · Public ",
        description: "Veřejný server klanu Vlci.",
        report: true,
        reportCategoryId: "report",
        accent: "custom" as const,
        accentColor: "#2BB3A3",
        style: "b" as const,
    }
    const settings = draftToSettings(draft)
    assert.equal(settings.connectionId, "hll-1")
    assert.equal(settings.title, "Vlci #1 · Public")
    assert.equal("connectionIds" in settings, false)
    assert.equal("league" in settings, false)
    assert.deepEqual(settings.presentation.factionEmoji, {})
    assert.equal(settings.presentation.accentColor, "#2bb3a3")
    assert.equal(settings.presentation.style, "b")
    const parsed = panelSaveSchema.safeParse(settings)
    assert.ok(parsed.success, JSON.stringify(parsed.error?.issues))
})

test("report and colour are not saved half-set; the League sends its options", () => {
    const off = draftToSettings({
        ...newPanelDraft({ connectionId: "hll-1" }),
        channelId,
        report: false,
        reportCategoryId: "report",
    })
    assert.equal("reportCategoryId" in off, false)
    const clan = draftToSettings({
        ...newPanelDraft({ connectionId: "hll-1" }),
        channelId,
        accent: "clan",
        accentColor: "#123456",
    })
    assert.equal(clan.presentation.accentColor, null)
    const league = draftToSettings({
        ...newPanelDraft({ kind: "league" }),
        channelId,
        league: {
            table: true,
            fixtures: true,
            recentResults: false,
            fixtureCount: 4,
        },
    })
    assert.equal(league.league?.fixtureCount, 4)
    assert.ok(panelSaveSchema.safeParse(league).success)
})

test("a stored panel loads into the draft and back without changes", () => {
    const draft = draftFromSettings({
        kind: "servers",
        channelId,
        connectionIds: ["hll-1", "wd-1"],
        title: "Naše servery",
        showPlayers: true,
        showLeaders: false,
        artwork: true,
        content: { ...DEFAULT_PANEL_CONTENT, nextMap: false },
        presentation: { accentColor: "#7c8cf0", style: "c" },
    })
    assert.equal(draft.accent, "custom")
    assert.equal(draft.accentColor, "#7C8CF0")
    assert.equal(draft.style, "c")
    assert.equal(draftChanges(draft, draft), 0)
    assert.equal(
        draftChanges({ ...draft, title: "Jinak" }, draft),
        1,
        "one unsaved change"
    )
    assert.equal(
        draftChanges(
            {
                ...draft,
                content: { ...draft.content, queue: false, nextMap: true },
            },
            draft
        ),
        2
    )
})

test("missing required settings keep saving off", () => {
    const problems = draftProblems({
        ...newPanelDraft(),
        report: true,
        accent: "custom",
        accentColor: "blue",
    })
    assert.deepEqual(problems, [
        "channel",
        "server",
        "reportCategory",
        "accentColor",
    ])
    assert.deepEqual(
        draftProblems({ ...newPanelDraft({ kind: "servers" }), channelId }),
        ["servers"]
    )
    assert.deepEqual(
        draftProblems({
            ...newPanelDraft({ connectionId: "hll-1" }),
            channelId,
        }),
        []
    )
})

test("a sent panel keeps its type; single-instance types already taken are off (P2-05)", () => {
    const sent = panelTypeOptions({ current: "server", sent: true })
    assert.ok(
        sent.every((option) => option.disabled === (option.kind !== "server"))
    )
    const fresh = panelTypeOptions({
        current: "servers",
        sent: false,
        taken: ["league"],
    })
    assert.equal(
        fresh.find((option) => option.kind === "league")?.disabled,
        true
    )
    assert.equal(
        fresh.find((option) => option.kind === "server")?.disabled,
        false
    )
    assert.equal(
        fresh.find((option) => option.kind === "servers")?.selected,
        true
    )
})

test("results are one panel per game: an HLL one never blocks a Wardogs one (P2-04, P2-35)", () => {
    const panels = [
        { id: "r-hll", kind: "results", gameId: "hell_let_loose" },
        { id: "lg", kind: "league", gameId: "wardogs" },
        { id: "cal", kind: "calendar", gameId: "any" },
    ]
    const both = ["hell_let_loose", "wardogs"]
    assert.deepEqual(resultsGamesTaken(panels, null), ["hell_let_loose"])
    // Výsledky stays free while Wardogs has none; League and Calendar are taken.
    assert.deepEqual(
        takenPanelKinds({ panels, currentId: null, enabledGames: both }),
        ["league", "calendar"]
    )
    // Picking Výsledky starts on the free game.
    assert.equal(
        freeResultsGame({
            current: "hell_let_loose",
            taken: resultsGamesTaken(panels, null),
            enabledGames: both,
        }),
        "wardogs"
    )
    // A clan with HLL only has nothing left; with both games taken, neither.
    assert.deepEqual(
        takenPanelKinds({
            panels,
            currentId: null,
            enabledGames: ["hell_let_loose"],
        }),
        ["league", "calendar", "results"]
    )
    const all = [...panels, { id: "r-wd", kind: "results", gameId: "wardogs" }]
    assert.ok(
        takenPanelKinds({
            panels: all,
            currentId: null,
            enabledGames: both,
        }).includes("results")
    )
    // The edited panel never takes its own kind.
    assert.deepEqual(
        takenPanelKinds({ panels: all, currentId: "r-wd", enabledGames: both }),
        ["league", "calendar"]
    )
    assert.deepEqual(resultsGamesTaken(all, "r-wd"), ["hell_let_loose"])
    assert.equal(
        freeResultsGame({
            current: "wardogs",
            taken: ["hell_let_loose"],
            enabledGames: both,
        }),
        "wardogs"
    )
})

test("the password is allowed only for a live server in a verified private channel (P2-B03)", () => {
    assert.equal(
        passwordAllowed({ kind: "server", channelPrivate: true }),
        true
    )
    assert.equal(
        passwordAllowed({ kind: "server", channelPrivate: false }),
        false
    )
    assert.equal(
        passwordAllowed({ kind: "server", channelPrivate: null }),
        false
    )
    assert.equal(
        passwordAllowed({ kind: "servers", channelPrivate: true }),
        false
    )
})

test("join details: only changed fields are sent, a password is never echoed back", () => {
    const saved = {
        address: "203.0.113.24:7777",
        joinCode: null,
        hasPassword: true,
    }
    const draft = serverJoinDraft(saved)
    assert.equal(draft.password, "")
    assert.equal(serverJoinPatch(draft, saved), null)
    assert.deepEqual(
        serverJoinPatch({ ...draft, password: "k7-sraz-2026" }, saved),
        { password: "k7-sraz-2026" }
    )
    assert.deepEqual(
        serverJoinPatch({ ...draft, clearPassword: true }, saved),
        { password: null }
    )
    assert.deepEqual(serverJoinPatch({ ...draft, address: "" }, saved), {
        address: null,
    })
    assert.deepEqual(
        serverJoinProblems({ ...draft, address: "nope", joinCode: "a b" }),
        ["address", "joinCode"]
    )
})

test("Naše servery keeps the drag order (P2-36)", () => {
    assert.deepEqual(moveServer(["a", "b", "c"], 2, 0), ["c", "a", "b"])
    assert.deepEqual(moveServer(["a", "b", "c"], 0, 5), ["b", "c", "a"])
    assert.deepEqual(toggleServer(["a", "b"], "c", true), ["a", "b", "c"])
    assert.deepEqual(toggleServer(["a", "b", "c"], "b", false), ["a", "c"])
})

test("the results panel's compact look is saved from the editor and loads back (L3-31, L3-B05)", () => {
    const draft = {
        ...newPanelDraft({ kind: "results" }),
        channelId,
        gameId: "hell_let_loose" as const,
    }
    draft.layout = { ...draft.layout, compact: true }
    const settings = draftToSettings(draft)
    assert.equal(settings.presentation.layout.compact, true)
    assert.equal(panelSaveSchema.safeParse(settings).success, true)
    assert.equal(
        draftFromSettings(panelSaveSchema.parse(settings)).layout.compact,
        true
    )
})

test("Naše servery keeps its own style (P7-19)", () => {
    const draft = {
        ...newPanelDraft({ kind: "servers" }),
        channelId,
        connectionIds: ["hll-1"],
        style: "b" as const,
    }
    const settings = draftToSettings(draft)
    assert.equal(settings.presentation.style, "b")
    assert.equal(panelSaveSchema.safeParse(settings).success, true)
})
