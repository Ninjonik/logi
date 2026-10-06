import assert from "node:assert/strict"
import test from "node:test"

import { renderToStaticMarkup } from "react-dom/server"
import { createElement } from "react"

import type { ReminderDeliveryNoticeView } from "@/lib/read-models/reminder-delivery"
import { enMessages } from "@/i18n/messages/en"
import { csMessages } from "@/i18n/messages/cs"

import {
    DISCORD_SERVER_DM_HELP_URL,
    ReminderDeliveryNotice,
} from "./reminder-delivery-notice"

const textOf = (html: string) =>
    html
        .replace(/<[^>]+>/g, " ")
        .replace(/&#x27;/g, "'")
        .replace(/\s+/g, " ")
        .trim()

const partial: ReminderDeliveryNoticeView = {
    kind: "partial",
    automatic: false,
    audience: "unconfirmed",
    sent: 9,
    total: 12,
    failedUserIds: ["1", "2", "3"],
    failedNames: ["Mrak", "Ježek", "Liška"],
    sentAt: "2026-10-11T15:05:00.000Z",
    requestedBy: "4",
    senderName: "Kowalski",
}

const render = (
    notice: ReminderDeliveryNoticeView,
    messages: typeof csMessages | typeof enMessages = csMessages,
    locale = "cs"
) =>
    renderToStaticMarkup(
        createElement(ReminderDeliveryNotice, {
            notice,
            copy: messages.reminderDelivery,
            errorLabel: messages.common.error,
            clanName: "Vlci",
            locale,
            timeZone: "Europe/Prague",
        })
    )

test("names the players a reminder missed, as on board L2-60..62", () => {
    const html = render(partial)
    const text = textOf(html)
    assert.match(text, /Připomínka došla 9 z 12 hráčů/)
    assert.match(
        text,
        /Mrak, Ježek a Liška mají v Discordu vypnuté soukromé zprávy od členů serveru\. Napiš jim jinak, nebo je požádej, ať si zprávy od serveru Vlci zapnou\./
    )
    assert.match(text, /Zkopírovat jména/)
    assert.match(text, /Jak zapnout zprávy od serveru/)
    assert.match(
        text,
        /Připomínka docházky · odeslána ne 11\. 10\. v 17:05 · poslal Kowalski/
    )
    assert.ok(html.includes(`href="${DISCORD_SERVER_DM_HELP_URL}"`))
    assert.ok(html.includes('rel="noreferrer"'))
})

test("one player reads in the singular, unknown names have a fallback", () => {
    const text = textOf(
        render({
            ...partial,
            sent: 11,
            failedUserIds: ["1"],
            failedNames: [null],
            senderName: null,
            audience: "unanswered",
        })
    )
    assert.match(text, /Připomínka došla 11 z 12 hráčů/)
    assert.match(text, /neznámý hráč má v Discordu vypnuté/)
    assert.match(text, /Připomínka přihlášky · odeslána .* · poslal správce/)
})

test("a failed send says so in the admin's language without names", () => {
    const text = textOf(
        render(
            {
                kind: "failed",
                automatic: false,
                audience: "unconfirmed",
                sentAt: "2026-10-11T15:05:00.000Z",
                requestedBy: "4",
                senderName: "Kowalski",
                failedNames: [],
            },
            enMessages,
            "en"
        )
    )
    assert.match(text, /The reminder could not be sent\./)
    assert.doesNotMatch(text, /The bot could not send the reminders/)
    assert.doesNotMatch(text, /Copy names/)
    assert.match(text, /Attendance reminder · sent .* · by Kowalski/)
})

test("a scheduled reminder that missed players has no sender (L2-64)", () => {
    const scheduled: ReminderDeliveryNoticeView = {
        ...partial,
        automatic: true,
        requestedBy: null,
        senderName: null,
    }
    const cs = textOf(render(scheduled))
    assert.match(cs, /Připomínka došla 9 z 12 hráčů/)
    assert.match(cs, /Mrak, Ježek a Liška mají v Discordu vypnuté/)
    assert.match(
        cs,
        /Připomínka docházky · odeslána ne 11\. 10\. v 17:05 · automaticky podle plánu/
    )
    assert.doesNotMatch(cs, /poslal/)
    const en = textOf(render(scheduled, enMessages, "en"))
    assert.match(
        en,
        /Attendance reminder · sent .* · automatically, as scheduled/
    )
    assert.doesNotMatch(en, /by an admin/)
})
