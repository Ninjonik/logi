import assert from "node:assert/strict"
import test from "node:test"

import { renderedView } from "../../../src/infrastructure/testing/message-views"
import { buildCalendarPanelView, calendarEntriesFromPayload } from "./calendar"

const now = Date.parse("2026-10-05T10:00:00.000Z")
const hours = (value: number) => new Date(now + value * 3_600_000).toISOString()

const payload = {
    config: {
        guildId: "100000000000000099",
        defaultLanguage: "cs",
        timezone: "Europe/Prague",
        updatedAt: hours(-48),
    },
    guild: {
        id: "guilds:1",
        name: "Vlci",
        eventCategories: [{ id: "friendly", label: "Přátelák" }],
    },
    events: [
        {
            id: "events:1",
            name: "Vlci vs Rogue",
            kind: "match",
            matchType: "friendly",
            gameStart: hours(30),
            gameEnd: hours(32),
            registrationEnd: hours(20),
            status: "planned",
            isDraft: false,
            updatedAt: hours(-1),
        },
        {
            id: "events:2",
            name: "Trénink",
            kind: "training",
            gameStart: hours(6),
            gameEnd: hours(8),
            status: "planned",
            isDraft: false,
            updatedAt: hours(-2),
        },
        {
            id: "events:3",
            name: "Skrytý koncept",
            kind: "match",
            gameStart: hours(3),
            gameEnd: hours(5),
            status: "planned",
            isDraft: true,
            updatedAt: hours(-2),
        },
    ],
    calendarItems: [],
    syncStates: [
        {
            eventId: "events:1",
            announcementChannelId: "123456789012345678",
            announcementMessageId: "223456789012345678",
        },
    ],
} as unknown as Parameters<typeof buildCalendarPanelView>[0]

test("calendar entries come from events, never drafts, with the type as a word", () => {
    const entries = calendarEntriesFromPayload(payload, now)
    assert.deepEqual(
        entries.map((entry) => [entry.id, entry.typeWord, entry.category]),
        [
            ["events:1", "Přátelák", "friendly"],
            ["events:2", "Trénink", "training"],
        ]
    )
    assert.equal(
        entries[0]?.url,
        "https://discord.com/channels/100000000000000099/123456789012345678/223456789012345678"
    )
})

test("the calendar panel highlights the next event and links the Logi calendar", () => {
    const view = renderedView(
        buildCalendarPanelView(payload, {
            now,
            siteUrl: "https://logi.app",
            categories: [],
        })
    )
    assert.deepEqual(view.validation, { ok: true, issues: [] })
    assert.match(view.text, /KALENDÁŘ · VLCI/)
    assert.match(view.text, /\*\*Další:\*\* \[Vlci vs Rogue · Přátelák\]/)
    assert.match(view.text, /Trénink/)
    assert.doesNotMatch(view.text, /Skrytý koncept/)
    const open = view.buttons[0]
    assert.ok(open?.kind === "link")
    assert.equal(
        open.url,
        "https://logi.app/cs/dashboard/servers/guilds%3A1/calendar"
    )
})

test("the category filter keeps only the chosen kinds of events", () => {
    const view = renderedView(
        buildCalendarPanelView(payload, {
            now,
            siteUrl: "https://logi.app",
            categories: ["training"],
        })
    )
    assert.doesNotMatch(view.text, /Vlci vs Rogue/)
    assert.match(view.text, /Trénink/)
})
