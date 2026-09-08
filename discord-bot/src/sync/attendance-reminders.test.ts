import assert from "node:assert/strict"
import test from "node:test"

import { getClanDiscordMessages } from "../../../src/lib/clan-language"

import { buildAttendanceReminderMessage } from "./attendance-reminders"

test("attendance reminder includes the player's roster position, notes, and event-info link", () => {
    const message = buildAttendanceReminderMessage({
        eventName: "Operation Test",
        meetingStartMs: Date.parse("2026-09-08T06:30:00.000Z"),
        eventMessageUrl:
            "https://discord.com/channels/guild/event-info/message",
        assignment: {
            squadName: "Red",
            roleName: "Squad Leader",
            note: "Join the briefing voice channel early.",
        },
        messages: getClanDiscordMessages("en"),
    })

    assert.match(message, /Your roster assignment: \*\*Red — Squad Leader\*\*/)
    assert.match(message, /Notes: Join the briefing voice channel early\./)
    assert.match(
        message,
        /https:\/\/discord\.com\/channels\/guild\/event-info\/message/
    )
})
