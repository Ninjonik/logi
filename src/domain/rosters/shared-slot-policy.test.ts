import assert from "node:assert/strict"
import test from "node:test"

import { canEditSharedSlot } from "./shared-slot-policy"

test("the host can edit any slot, including a locked guest slot", () => {
    assert.equal(
        canEditSharedSlot({
            hostGuildId: "host",
            actorGuildId: "host",
            invitationActive: false,
            slot: { allocatedGuildId: "guest", locked: true },
        }),
        true
    )
})

test("an invited clan can edit only its own unlocked slots", () => {
    const input = {
        hostGuildId: "host",
        actorGuildId: "guest",
        invitationActive: true,
        slot: { allocatedGuildId: "guest" },
    }
    assert.equal(canEditSharedSlot(input), true)
    assert.equal(
        canEditSharedSlot({ ...input, invitationActive: false }),
        false
    )
    assert.equal(
        canEditSharedSlot({ ...input, slot: { ...input.slot, locked: true } }),
        false
    )
    assert.equal(
        canEditSharedSlot({ ...input, slot: { allocatedGuildId: "other" } }),
        false
    )
    assert.equal(canEditSharedSlot({ ...input, slot: {} }), false)
})
