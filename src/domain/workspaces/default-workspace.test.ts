import assert from "node:assert/strict"
import test from "node:test"

import {
    getDefaultWorkspaceCandidatesFromMemberships,
    getDefaultWorkspaceFromMemberships,
} from "./default-workspace"

test("uses the first recruit, member, or reserve-member clan", () => {
    assert.equal(
        getDefaultWorkspaceFromMemberships([
            { serverId: "merc", type: "mercenary", status: "active" },
            { serverId: "pending", type: "member", status: "pending" },
            { serverId: "reserve", type: "reserve_member", status: "active" },
            { serverId: "later", type: "member", status: "recruit" },
        ]),
        "reserve"
    )
})

test("does not choose pending or mercenary assignments", () => {
    assert.equal(
        getDefaultWorkspaceFromMemberships([
            { serverId: "pending", type: "member", status: "pending" },
            { serverId: "merc", type: "mercenary", status: "active" },
        ]),
        undefined
    )
})

test("keeps every eligible clan as a fallback candidate", () => {
    assert.deepEqual(
        getDefaultWorkspaceCandidatesFromMemberships([
            { serverId: "first", type: "member", status: "active" },
            { serverId: "first", type: "member", status: "recruit" },
            { serverId: "second", type: "reserve_member", status: "active" },
            { serverId: "pending", type: "member", status: "pending" },
        ]),
        ["first", "second"]
    )
})
