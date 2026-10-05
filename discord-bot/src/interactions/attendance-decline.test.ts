import assert from "node:assert/strict"
import test from "node:test"

import {
    buildAttendanceDeclineModal,
    declineRefusal,
    declineReply,
} from "./attendance-decline"
import { getEventMessages } from "../../../src/lib/clan-language/events"
import type { EventRecord, Roster } from "../types"

const messages = getEventMessages("cs")
const roster: Roster = {
    id: "roster-1",
    eventId: "event-1",
    published: true,
    reservePlayerIds: ["reserve"],
    updatedAt: "2026-10-10T10:00:00.000Z",
    squads: [
        {
            name: "Able",
            group: "inf",
            color: "#000",
            order: 1,
            players: [{ id: "medic", ack: false, roleName: "Medic" }],
        },
    ],
}
const event = {
    id: "event-1",
    status: "starting",
    gameStart: "2026-10-11T18:00:00.000Z",
} as EventRecord
const before = Date.parse("2026-10-11T17:00:00.000Z")

test("only rostered players can open the decline form before the game starts", () => {
    assert.equal(
        declineRefusal({ event, roster }, "medic", messages, before),
        null
    )
    assert.equal(
        declineRefusal({ event, roster }, "reserve", messages, before),
        null
    )
    assert.equal(
        declineRefusal({ event, roster }, "stranger", messages, before),
        messages.interaction.notOnRoster
    )
    assert.equal(
        declineRefusal(
            { event, roster: { ...roster, published: false } },
            "medic",
            messages,
            before
        ),
        messages.interaction.rosterNotPublished
    )
    assert.equal(
        declineRefusal({ event, roster: null }, "medic", messages, before),
        messages.interaction.rosterNotPublished
    )
    assert.equal(
        declineRefusal(
            { event, roster },
            "medic",
            messages,
            Date.parse(event.gameStart)
        ),
        messages.attendanceDecline.tooLate
    )
})

test("the reply tells the player what happened in the clan language", () => {
    assert.equal(
        declineReply({ ok: true, changed: true, rejected: null }, messages),
        "Díky, velení ví, že nedorazíš, a tvoje místo obsadí."
    )
    assert.equal(
        declineReply({ ok: true, changed: false, rejected: null }, messages),
        "Velení už ví, že nedorazíš."
    )
    assert.equal(
        declineReply(
            { ok: false, changed: false, rejected: "too_late" },
            messages
        ),
        messages.attendanceDecline.tooLate
    )
    assert.equal(
        declineReply(
            { ok: false, changed: false, rejected: "not_on_roster" },
            messages
        ),
        messages.interaction.notOnRoster
    )
})

test("the decline form asks for an optional reason within Discord limits", () => {
    const modal = buildAttendanceDeclineModal("event-1", messages).toJSON()
    assert.equal(modal.custom_id, "attendance-decline-modal:event-1")
    assert.equal(modal.title, "Nemůžu přijít")
    const row = modal.components[0]
    const input = row && "components" in row ? row.components[0] : undefined
    assert.ok(input && "custom_id" in input)
    assert.equal(input.custom_id, "reason")
    assert.equal(input.required, false)
    assert.equal(input.max_length, 500)
    assert.ok(("label" in input ? (input.label ?? "") : "").length <= 45)
    for (const language of ["en", "de"] as const) {
        const copy = getEventMessages(language).attendanceDecline
        assert.ok(copy.modalTitle.length <= 45)
        assert.ok(copy.reasonLabel.length <= 45)
    }
})
