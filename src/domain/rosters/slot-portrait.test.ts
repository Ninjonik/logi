import { rosterSlotPortrait } from "./slot-portrait"
import assert from "node:assert/strict"
import test from "node:test"

test("slot portraits are local to the clan viewing the shared roster", () => {
    assert.equal(
        rosterSlotPortrait({
            localGuildId: "guest",
            hostGuildId: "host",
            playerAvatar: "player.png",
            clans: [{ guildId: "host", avatar: "host.png" }],
        }),
        "host.png"
    )
    const slot = {
        allocatedGuildId: "guest",
        playerAvatar: "player.png",
        clans: [{ guildId: "guest", avatar: "guest.png" }],
    }
    assert.equal(
        rosterSlotPortrait({ ...slot, localGuildId: "host" }),
        "guest.png"
    )
    assert.equal(
        rosterSlotPortrait({ ...slot, localGuildId: "guest" }),
        "player.png"
    )
    assert.equal(
        rosterSlotPortrait({
            ...slot,
            allocatedGuildId: undefined,
            localGuildId: "host",
        }),
        "player.png"
    )
    assert.equal(
        rosterSlotPortrait({ ...slot, clans: [], localGuildId: "host" }),
        undefined
    )
})
