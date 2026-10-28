import { getRosterImageAttendanceStyle as style } from "./roster-image-attendance"
import assert from "node:assert/strict"
import test from "node:test"

test("absence makes the entire row red and overrides confirmation", () => {
    for (const player of [
        { ack: false },
        { ack: true },
        { ack: true, confirmed: true },
    ]) {
        assert.deepEqual(style(player, "cannot_come"), {
            background: "#991b1b",
            showCheck: false,
            indicator: "absent",
        })
    }
})
test("admin confirmation has both a green row and check", () => {
    assert.deepEqual(style({ ack: true, confirmed: true }), {
        background: "#166534",
        showCheck: true,
        indicator: null,
    })
})
test("late and legacy notices do not become absences", () => {
    assert.deepEqual(style({ ack: false }, "late"), {
        background: "#18324a",
        showCheck: false,
        indicator: "late",
    })
    assert.equal(style({ ack: false }).indicator, null)
    assert.equal(style({ ack: true }).showCheck, false)
})

test("acknowledged reserves and squad players share green styling without an admin check", () => {
    assert.deepEqual(style({ ack: true, confirmed: false }), {
        background: "#166534",
        showCheck: false,
        indicator: null,
    })
})

test("meeting confirmation shows a check even without a separate acknowledgement", () => {
    assert.deepEqual(style({ ack: false, confirmed: true }), {
        background: "#166534",
        showCheck: true,
        indicator: null,
    })
})
