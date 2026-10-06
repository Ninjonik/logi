import assert from "node:assert/strict"
import test from "node:test"

import { getAnnouncementPingRoleIds } from "../events/announcement"
import type { EventRecord, SyncPayload } from "../types"

const payload = { config: { clanRoleId: "clan-role" } } as SyncPayload

test("getAnnouncementPingRoleIds resolves the configured clan role", () => {
    const event = { pingClan: true, pingMode: "clan" } as EventRecord

    assert.deepEqual(getAnnouncementPingRoleIds(payload, event), ["clan-role"])
})

test("getAnnouncementPingRoleIds resolves and de-duplicates selected roles", () => {
    const event = {
        pingClan: false,
        pingMode: "roles",
        pingRoleIds: ["role-1", "role-1", " role-2 ", ""],
    } as EventRecord

    assert.deepEqual(getAnnouncementPingRoleIds(payload, event), [
        "role-1",
        "role-2",
    ])
})

test("getAnnouncementPingRoleIds pings nobody when the match pings nobody", () => {
    assert.deepEqual(
        getAnnouncementPingRoleIds(payload, {
            pingClan: true,
            pingMode: "none",
        } as EventRecord),
        []
    )
})
