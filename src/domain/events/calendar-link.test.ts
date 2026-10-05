import assert from "node:assert/strict"
import test from "node:test"

import { getAnnouncementMessages } from "@/lib/clan-language/announcements"

import {
    buildCalendarLink,
    clanClock,
    plainText,
    type CalendarLinkInput,
} from "./calendar-link"

const input: CalendarLinkInput = {
    kind: "match",
    title: "VLK vs ROG · Přátelák",
    meetingStart: "2026-10-11T17:30:00.000Z",
    gameStart: "2026-10-11T18:00:00.000Z",
    gameEnd: "2026-10-11T20:00:00.000Z",
    mapLabel: "Foy · den",
    clanName: "Vlci",
    meetingChannelName: "Sraz",
    announcementUrl:
        "https://discord.com/channels/111111111111111111/333333333333333333",
    locale: "cs-CZ",
    timeZone: "Europe/Prague",
    copy: getAnnouncementMessages("cs"),
}

const fields = (url: string) => Object.fromEntries(new URL(url).searchParams)

test("the calendar link spans meeting to end with a readable place and a link back (L1-142, L1-B18)", () => {
    const url = buildCalendarLink(input)
    assert.ok(url.startsWith("https://calendar.google.com/calendar/render?"))
    assert.deepEqual(fields(url), {
        action: "TEMPLATE",
        text: "VLK vs ROG · Přátelák",
        dates: "20261011T173000Z/20261011T200000Z",
        details:
            "Sraz 19:30, start 20:00. Foy · den. Přihláška a zařazení: https://discord.com/channels/111111111111111111/333333333333333333",
        location: "Discord · Vlci · kanál Sraz",
    })
})

test("the old fallbacks are gone: no channel ID and no 'Briefing k operaci' (L1-143)", () => {
    const url = buildCalendarLink({ ...input, meetingChannelName: null })
    assert.equal(fields(url).location, "Discord · Vlci")
    assert.doesNotMatch(decodeURIComponent(url), /Briefing k operaci|444444/)
})

test("a training names its server, never its password", () => {
    const details = fields(
        buildCalendarLink({
            ...input,
            kind: "training",
            title: "Trénink · komunikace a souhra",
            server: "Vlci Trénink",
            mapLabel: "Foy · den",
        })
    ).details
    assert.equal(
        details,
        "Sraz 19:30, start 20:00. Server Vlci Trénink. Přihláška: https://discord.com/channels/111111111111111111/333333333333333333"
    )
})

test("the link fits Discord's 512 characters, dropping details first", () => {
    const long = buildCalendarLink({
        ...input,
        title: "Ž".repeat(300),
        clanName: "Ů".repeat(120),
    })
    assert.ok(long.length <= 512, String(long.length))
    const normal = buildCalendarLink({ ...input, mapLabel: "M".repeat(200) })
    assert.ok(normal.length <= 512)
    assert.equal(fields(normal).text, "VLK vs ROG · Přátelák")
})

test("an end before the meeting lasts ninety minutes", () => {
    assert.equal(
        fields(buildCalendarLink({ ...input, gameEnd: "invalid" })).dates,
        "20261011T173000Z/20261011T190000Z"
    )
})

test("times are written in the clan's zone; markdown escapes are removed", () => {
    assert.equal(
        clanClock("2026-10-11T17:30:00.000Z", "cs-CZ", "Europe/Prague"),
        "19:30"
    )
    assert.equal(
        clanClock("2026-10-11T17:30:00.000Z", "en-GB", "Not/AZone"),
        "17:30"
    )
    assert.equal(plainText("Custom \\*map\\*"), "Custom *map*")
})
