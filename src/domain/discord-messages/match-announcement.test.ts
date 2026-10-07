import assert from "node:assert/strict"
import test from "node:test"

import { getAnnouncementMessages } from "@/lib/clan-language/announcements"
import { getSystemMessages } from "@/lib/clan-language/system"

import {
    announcementPingLine,
    buildAnnouncementView,
    categoryChipTone,
    matchCardFullTitle,
    matchCardTitle,
    toAnnouncementResult,
    type AnnouncementViewInput,
    type MatchCardEvent,
} from "./match-announcement"
import {
    ANNOUNCEMENT_STATES,
    type AnnouncementState,
} from "../events/announcement-state"
import { layoutMessageView, type MessageLayoutOptions } from "./message-layout"
import type { MessageButton, MessageView } from "./message-view"
import { validateMessageView } from "./message-validation"

const copy = getAnnouncementMessages("cs")
const layoutOptions: MessageLayoutOptions = {
    copy: getSystemMessages("cs").kit,
    locale: "cs-CZ",
    style: { accentColor: "#E8A33D" },
}

const event: MatchCardEvent = {
    kind: "match",
    eventId: "event-1",
    guildId: "111111111111111111",
    name: "Liga · kolo 3",
    category: { label: "Přátelák", color: "#ED4245" },
    teams: [
        { code: "VLK", side: "Allies" },
        { code: "ROG", side: "Axis" },
    ],
    side: "Allies",
    mapLabel: "Foy · den",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    registrationEnd: "2026-10-10T17:30:00.000Z",
    timeZone: "Europe/Prague",
    locale: "cs-CZ",
}

const base: AnnouncementViewInput = {
    event,
    state: "open",
    counts: {
        groups: [
            { id: "inf", name: "Pěchota", count: 12 },
            { id: "tank", name: "Tanky", count: 4, max: 6 },
            { id: "recon", name: "Recon", count: 1, max: 2 },
        ],
        withoutGroup: 0,
        total: 17,
        declined: 2,
    },
    notes: "Tanky drží střed, F2 brání. Mikrofon povinný.",
    meetingChannelId: "444444444444444444",
    forumChannelId: "666666666666666666",
    thumbnail: { url: "attachment://mapa-foy.webp", description: "mapa Foy" },
    links: {
        calendar: "https://calendar.google.com/calendar/render?action=TEMPLATE",
        roster: "https://logi.example/cs/rosters/event-1",
        match: "https://logi.example/cs/matches/event-1",
    },
    copy,
}

function text(view: MessageView) {
    return layoutMessageView(view, layoutOptions)
        .nodes.flatMap((node) =>
            node.type === "text"
                ? [node.content]
                : node.type === "section"
                  ? node.texts
                  : []
        )
        .join("\n")
}

function buttons(view: MessageView) {
    return view.blocks.flatMap((block) =>
        block.kind === "buttons" ? [block.buttons] : []
    )
}

const label = (button: MessageButton) =>
    button.kind === "link"
        ? `${button.label} ↗`
        : `${button.label} (${button.style})`

test("the open card reads like the board (L1-11..24)", () => {
    const view = buildAnnouncementView(base)
    assert.equal(view.header?.title, "VLK vs ROG")
    assert.deepEqual(view.header?.chips, [
        { label: "Přátelák", tone: "danger" },
    ])
    assert.deepEqual(view.header?.thumbnail, base.thumbnail)
    const body = text(view)
    assert.match(body, /`VLK` Spojenci ★ {2}vs {2}`ROG` Osa ✚/)
    assert.match(body, /\*\*<t:1791741600:f>\*\* · <t:1791741600:R>/)
    assert.match(body, /Foy · den · sraz <t:1791739800:t>/)
    assert.match(body, /🟢 \*\*Přihlášky otevřené\*\* · do <t:1791653400:f>/)
    assert.match(
        body,
        /\*\*Přihlášeno 17\*\* · Pěchota 12 · Tanky 4\/6 · Recon 1\/2\n/
    )
    // An open match does not count who declined yet.
    assert.doesNotMatch(body, /Nepřijde/)
    assert.match(body, /Tanky drží střed, F2 brání\. Mikrofon povinný\./)
    assert.match(
        body,
        /-# Fórum zápasu <#666666666666666666> · Spravováno v Logi$/
    )
    assert.deepEqual(
        buttons(view).map((row) => row.map(label)),
        [
            [
                "Přihlásit se (success)",
                "Zkontrolovat přihlášení (secondary)",
                "Nepřijdu (danger)",
            ],
            ["Přidat do kalendáře ↗"],
        ]
    )
})

test("the bar is the clan colour whatever the state or category (L1-02, L1-07)", () => {
    for (const state of ANNOUNCEMENT_STATES) {
        const view = buildAnnouncementView({ ...base, state })
        assert.equal(view.accent, "clan")
        assert.equal(
            layoutMessageView(view, layoutOptions).accentColor,
            0xe8a33d
        )
    }
})

test("the announcement keeps the offered groups and declined people visible", () => {
    const view = buildAnnouncementView({
        ...base,
        signupRoster: {
            groups: [
                {
                    name: "Pěchota",
                    icon: "🟢",
                    names: ["Ninjonik", "Sandiary"],
                },
                { name: "Recon", icon: "🔵", names: [] },
            ],
            declined: ["Baller", "Cilis"],
        },
        image: { url: "https://cdn.example/briefing.png" },
    })
    const body = text(view)
    assert.match(body, /\*\*🟢 Pěchota \(2\)\*\*\nNinjonik, Sandiary/)
    assert.match(body, /\*\*🔵 Recon \(0\)\*\*/)
    assert.match(body, /\*\*❌ Odmítli \(2\)\*\*\nBaller, Cilis/)
    const gallery = view.blocks.find((block) => block.kind === "gallery")
    assert.equal(gallery?.kind, "gallery")
    if (gallery?.kind === "gallery")
        assert.equal(gallery.items[0]?.url, "https://cdn.example/briefing.png")
    assert.doesNotMatch(JSON.stringify(buttons(view)), /Zobrazit přihlášené/)
})

test("a full capped group is named and the counts say plno and Zálohy (L1-28, L1-29)", () => {
    const body = text(
        buildAnnouncementView({
            ...base,
            counts: {
                groups: [
                    { id: "inf", name: "Pěchota", count: 15 },
                    { id: "tank", name: "Tanky", count: 6, max: 6 },
                    { id: "recon", name: "Recon", count: 2, max: 2 },
                ],
                withoutGroup: 2,
                total: 25,
                declined: 3,
            },
        })
    )
    assert.match(body, /· Tanky a Recon jsou plné/)
    assert.match(
        body,
        /\*\*Přihlášeno 23\*\* · Pěchota 15 · Tanky 6\/6 plno · Recon 2\/2 plno · Zálohy 2/
    )
})

test("closed sign-ups show velení skládá soupisku, plain counts and Nepřijde (L1-33..35)", () => {
    const view = buildAnnouncementView({
        ...base,
        state: "closed",
        counts: { ...base.counts, withoutGroup: 2, total: 19, declined: 3 },
    })
    const body = text(view)
    assert.match(body, /⚪ \*\*Přihlášky uzavřené\*\* · velení skládá soupisku/)
    assert.match(
        body,
        /\*\*Přihlášeno 17\*\* · Pěchota 12 · Tanky 4 · Recon 1 · Zálohy 2 · Nepřijde 3/
    )
    assert.deepEqual(
        buttons(view).map((row) => row.map(label)),
        [["Přidat do kalendáře ↗"]]
    )
})

test("a published roster names its size and channel and offers Zobrazit zařazení (L1-37..42)", () => {
    const view = buildAnnouncementView({
        ...base,
        state: "roster",
        roster: { players: 18, reserves: 7, channelId: "777777777777777777" },
    })
    const body = text(view)
    assert.match(
        body,
        /🔵 \*\*Soupiska zveřejněna\*\* · 18 hráčů a 7 záloh v <#777777777777777777>/
    )
    assert.doesNotMatch(body, /Přihlášeno/)
    assert.match(body, /Tanky drží střed/)
    assert.deepEqual(
        buttons(view).map((row) => row.map(label)),
        [
            ["Zobrazit zařazení (primary)", "Otevřít soupisku ↗"],
            ["Přidat do kalendáře ↗"],
        ]
    )
})

test("without a roster channel the card shows the roster picture (L1-43, L1-B16)", () => {
    const view = buildAnnouncementView({
        ...base,
        state: "roster",
        roster: {
            players: 1,
            reserves: 0,
            image: { url: "attachment://roster.png", description: "soupiska" },
        },
    })
    assert.match(text(view), /Soupiska zveřejněna\*\* · 1 hráč$/m)
    assert.ok(
        view.blocks.some(
            (block) =>
                block.kind === "gallery" &&
                block.items[0]?.url === "attachment://roster.png"
        )
    )
})

test("from the meeting the card counts confirmations and offers Potvrdím účast (L1-44..49)", () => {
    const view = buildAnnouncementView({
        ...base,
        state: "starting",
        roster: { players: 18, reserves: 7 },
        confirmation: { confirmed: 15, total: 18, late: 1, cannotCome: 1 },
    })
    const body = text(view)
    assert.match(body, /<t:1791741600:R>/)
    assert.match(body, /^Foy · den$/m)
    assert.match(
        body,
        /🟡 \*\*Začíná\*\* · sraz běží v kanálu <#444444444444444444>/
    )
    assert.match(
        body,
        /\*\*Potvrzeno 15 z 18\*\* · přijde později 1 · nepřijde 1/
    )
    assert.deepEqual(
        buttons(view).map((row) => row.map(label)),
        [
            [
                "Potvrdím účast (primary)",
                "Přijdu později (secondary)",
                "Zobrazit zařazení (secondary)",
            ],
        ]
    )
})

test("after the start the chip is Hraje se · od 20:00 and the buttons are gone (L1-50)", () => {
    const view = buildAnnouncementView({
        ...base,
        state: "playing",
        roster: { players: 18, reserves: 7 },
        confirmation: { confirmed: 15, total: 18, late: 1, cannotCome: 1 },
    })
    const body = text(view)
    assert.match(body, /🟢 \*\*Hraje se\*\* · od <t:1791741600:t>/)
    assert.match(body, /Potvrzeno 15 z 18/)
    assert.doesNotMatch(body, /<t:1791741600:R>/)
    assert.deepEqual(buttons(view), [])
})

test("a played match shows the result, the match link and the results channel (L1-51..55)", () => {
    const view = buildAnnouncementView({
        ...base,
        state: "played",
        result: { outcome: "win", scores: [4, 1], reviewer: "Kowalski" },
        resultsChannelId: "888888888888888888",
    })
    const body = text(view)
    assert.match(body, /⚪ \*\*Odehráno\*\* · <t:1791741600:f> · Foy · den/)
    assert.match(body, /\*\*Výhra 4 : 1\*\* · potvrdil Kowalski/)
    assert.doesNotMatch(body, /Tanky drží|Přihlášeno|sraz/)
    assert.match(
        body,
        /-# Výsledek je i v <#888888888888888888> · Spravováno v Logi$/
    )
    assert.deepEqual(
        buttons(view).map((row) => row.map(label)),
        [["Zobrazit zápas ↗"]]
    )
})

test("a cancelled match strikes the start and tells players to do nothing (L1-56..59)", () => {
    const view = buildAnnouncementView({
        ...base,
        state: "cancelled",
        scheduledEvent: true,
    })
    const body = text(view)
    assert.match(body, /~~<t:1791741600:f>~~/)
    assert.match(body, /🔴 \*\*Zrušeno\*\* · zápas se nehraje/)
    assert.match(
        body,
        /Událost na Discordu je zrušená\. Kdo byl přihlášený, nemusí nic dělat\./
    )
    assert.match(body, /-# Spravováno v Logi$/)
    assert.deepEqual(buttons(view), [])
    assert.match(
        text(buildAnnouncementView({ ...base, state: "cancelled" })),
        /^Kdo byl přihlášený, nemusí nic dělat\.$/m
    )
})

test("a training shows its server but no category, teams, map or forum (L1-61..68)", () => {
    const training: MatchCardEvent = {
        ...event,
        kind: "training",
        name: "komunikace a souhra",
        category: null,
        teams: [],
        server: "Vlci Trénink",
        meetingStart: "2026-10-12T16:45:00.000Z",
        gameStart: "2026-10-12T17:00:00.000Z",
        registrationEnd: "2026-10-12T15:00:00.000Z",
    }
    const view = buildAnnouncementView({
        ...base,
        event: training,
        counts: { groups: [], withoutGroup: 0, total: 8, declined: 1 },
    })
    assert.equal(view.header?.title, "Trénink · komunikace a souhra")
    assert.deepEqual(view.header?.chips, [])
    assert.equal(view.header?.thumbnail, undefined)
    const body = text(view)
    assert.match(body, /sraz <t:1791823500:t> · server Vlci Trénink/)
    assert.match(body, /\*\*Přihlášeno 8\*\* · Nepřijde 1/)
    assert.doesNotMatch(body, /Fórum zápasu|Spojenci|Foy/)
    assert.deepEqual(buttons(view).flat().length, 4)
})

test("no state ever shows a server password or internal IDs (L1-03, L1-08, L1-B07)", () => {
    const leaky = {
        ...base,
        event: { ...event, server: "VLK Scrim" },
        notes: "Poznámky",
    }
    for (const state of ANNOUNCEMENT_STATES) {
        const body = text(
            buildAnnouncementView({
                ...leaky,
                state,
                roster: { players: 18, reserves: 7 },
                confirmation: {
                    confirmed: 1,
                    total: 18,
                    late: 0,
                    cannotCome: 0,
                },
            })
        )
        assert.doesNotMatch(body, /k7-sraz|heslo|VLK Scrim|event-1/)
    }
})

test("every state stays within the board rules and Discord's limits", () => {
    const long = "Dlouhá poznámka. ".repeat(100)
    for (const state of ANNOUNCEMENT_STATES as readonly AnnouncementState[]) {
        const view = buildAnnouncementView({
            ...base,
            state,
            notes: long,
            roster: { players: 18, reserves: 7, channelId: "7" },
            confirmation: { confirmed: 15, total: 18, late: 1, cannotCome: 1 },
            result: { outcome: "draw", scores: [2, 2] },
        })
        assert.deepEqual(
            validateMessageView(view, layoutOptions).issues,
            [],
            state
        )
    }
})

test("team codes cannot break out of their chip or form mentions and links", () => {
    const body = text(
        buildAnnouncementView({
            ...base,
            event: {
                ...event,
                teams: [
                    { code: "`@everyone`", side: "Allies" },
                    { code: "-----", side: null },
                ],
            },
        })
    )
    assert.match(body, /`@everyone`/)
    assert.doesNotMatch(body, /``/)
    assert.match(body, /`-----`/)
})

test("the title is the team codes, else the event name (L1-11)", () => {
    assert.equal(matchCardTitle(event, copy), "VLK vs ROG")
    assert.equal(
        matchCardTitle(
            { ...event, teams: [{ code: "VLK", side: null }] },
            copy
        ),
        "Liga · kolo 3"
    )
    assert.equal(matchCardFullTitle(event, copy), "VLK vs ROG · Přátelák")
    assert.equal(
        matchCardTitle(
            { ...event, kind: "training", name: "Trénink tanků" },
            copy
        ),
        "Trénink tanků"
    )
})

test("the category colour picks the nearest chip dot", () => {
    assert.equal(categoryChipTone("#3BA55C"), "success")
    assert.equal(categoryChipTone("#dc2626"), "danger")
    assert.equal(categoryChipTone("#2563EB"), "info")
    assert.equal(categoryChipTone("#FAA61A"), "warning")
    assert.equal(categoryChipTone(undefined), "neutral")
    assert.equal(categoryChipTone("not a colour"), "neutral")
})

test("the ping is a line above the card, once per role", () => {
    assert.equal(
        announcementPingLine(["222", " 222 ", "333", ""]),
        "<@&222> <@&333>"
    )
    assert.equal(announcementPingLine([]), undefined)
})

test("a reviewed result puts the clan first and never invents an outcome", () => {
    assert.deepEqual(
        toAnnouncementResult({
            participants: [
                { label: "Axis", score: 1 },
                { label: "Allies", score: 4 },
            ],
            clanSide: "Allies",
            reviewer: " Kowalski ",
        }),
        { outcome: "win", scores: [4, 1], reviewer: "Kowalski" }
    )
    assert.deepEqual(
        toAnnouncementResult({
            participants: [
                { label: "A", score: 3 },
                { label: "B", score: 2 },
            ],
        }),
        { outcome: null, scores: [3, 2], reviewer: null }
    )
    assert.equal(toAnnouncementResult({ participants: [] }), null)
})

test("English and German clans read their own words", () => {
    for (const language of ["en", "de"] as const) {
        const view = buildAnnouncementView({
            ...base,
            copy: getAnnouncementMessages(language),
            event: { ...event, locale: language === "en" ? "en-GB" : "de-DE" },
        })
        const body = text(view)
        assert.doesNotMatch(body, /Přihlášky|Přihlásit|sraz|Fórum zápasu/)
    }
})
