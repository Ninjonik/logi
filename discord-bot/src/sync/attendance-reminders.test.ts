import assert from "node:assert/strict"
import test from "node:test"

import { getClanDiscordMessages } from "../../../src/lib/clan-language"

import { buildAttendanceReminderMessage } from "./attendance-reminders"

test("attendance reminder includes the player's roster position, notes, and event-info link", () => {
    const embed = buildAttendanceReminderMessage({
        eventName: "Operation Test",
        meetingStartMs: Date.parse("2026-09-08T06:30:00.000Z"),
        gameStartMs: Date.parse("2026-09-08T07:00:00.000Z"),
        eventMessageUrl:
            "https://discord.com/channels/guild/event-info/message",
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
        /^Start <t:1788850800:t> \(<t:1788850800:R>\) · meeting <t:1788849000:t> · \*\*Red · Squad Leader\*\*$/m
    )
    assert.match(description, /Notes: Join the briefing voice channel early\./)
    assert.match(
        description,
        /https:\/\/discord\.com\/channels\/guild\/event-info\/message/
    )
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
        /^Start <t:\d+:t> .* · sraz <t:\d+:t> · \*\*Able · Medic\*\*/
    )
    assert.match(embed.description ?? "", /Poznámky: \\\*bold\\\*/)
    assert.doesNotMatch(JSON.stringify(embed), /heslo|password/i)
})
