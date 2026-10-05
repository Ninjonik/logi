import assert from "node:assert/strict"
import test from "node:test"

import { getClanDiscordMessages } from "../../../src/lib/clan-language"

import {
    buildAttendanceReminderMessage,
    playersWithAbsenceNotice,
} from "./attendance-reminders"

test("attendance reminder includes the player's roster position and notes", () => {
    const embed = buildAttendanceReminderMessage({
        eventName: "Operation Test",
        meetingStartMs: Date.parse("2026-09-08T06:30:00.000Z"),
        gameStartMs: Date.parse("2026-09-08T07:00:00.000Z"),
        assignment: {
            squadName: "Red",
            roleName: "Squad Leader",
            note: "Join the briefing voice channel early.",
        },
        messages: getClanDiscordMessages("en"),
        accentColor: 0x123456,
    }).toJSON()
    const description = embed.description ?? ""

    assert.equal(embed.title, "You're playing Operation Test")
    assert.equal(embed.color, 0x123456)
    assert.match(
        description,
        /^Start <t:1788850800:t> · meeting <t:1788849000:t> · Red · Squad Leader$/m
    )
    assert.match(description, /Notes: Join the briefing voice channel early\./)
    assert.doesNotMatch(description, /discord\.com/)
    assert.equal(
        embed.footer?.text,
        "Confirm so command knows who to count on."
    )
})

test("attendance reminder speaks the clan language and escapes roster text", () => {
    const embed = buildAttendanceReminderMessage({
        eventName: "VLK vs ROG",
        meetingStartMs: Date.parse("2026-10-11T17:30:00.000Z"),
        gameStartMs: Date.parse("2026-10-11T18:00:00.000Z"),
        assignment: { squadName: "Able", roleName: "Medic", note: "*bold*" },
        messages: getClanDiscordMessages("cs"),
    }).toJSON()

    assert.equal(embed.title, "Hraješ VLK vs ROG")
    assert.equal(embed.footer?.text, "Potvrď, ať velení ví, s kým počítat.")
    assert.match(
        embed.description ?? "",
        /^Start <t:\d+:t> · sraz <t:\d+:t> · Able · Medic$/m
    )
    assert.match(embed.description ?? "", /Poznámky: \\\*bold\\\*/)
    assert.doesNotMatch(JSON.stringify(embed), /heslo|password/i)
})

test("the reminder title says today or tomorrow in the clan's time zone", () => {
    const title = (now: string, timeZone = "Europe/Prague") =>
        buildAttendanceReminderMessage({
            eventName: "VLK vs ROG",
            meetingStartMs: Date.parse("2026-10-11T17:30:00.000Z"),
            gameStartMs: Date.parse("2026-10-11T18:00:00.000Z"),
            messages: getClanDiscordMessages("cs"),
            now: Date.parse(now),
            timeZone,
        }).toJSON().title

    // 24 h before the meeting: Saturday evening in Prague.
    assert.equal(title("2026-10-10T17:30:00.000Z"), "Zítra hraješ VLK vs ROG")
    assert.equal(title("2026-10-11T08:00:00.000Z"), "Dnes hraješ VLK vs ROG")
    assert.equal(title("2026-10-08T17:30:00.000Z"), "Hraješ VLK vs ROG")
    // Just after midnight in Prague is still the day before in UTC.
    assert.equal(
        title("2026-10-10T22:30:00.000Z", "UTC"),
        "Zítra hraješ VLK vs ROG"
    )
    assert.equal(title("2026-10-10T22:30:00.000Z"), "Dnes hraješ VLK vs ROG")
    assert.equal(
        title("2026-10-10T17:30:00.000Z", "Not/AZone"),
        "Zítra hraješ VLK vs ROG"
    )
})

test("players who declined or sent a notice get no further reminders", () => {
    assert.deepEqual(
        [
            ...playersWithAbsenceNotice({
                absenceNotices: [{ userId: "player-1" }],
            }),
        ],
        ["player-1"]
    )
    assert.equal(playersWithAbsenceNotice({}).size, 0)
})
