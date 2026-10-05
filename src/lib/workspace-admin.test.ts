import assert from "node:assert/strict"
import test from "node:test"

import { canAdminWorkspace } from "./workspace-admin"

const member = { canAdmin: false, adminIds: ["someone-else"] }

test("members of a clan are not its admins", () => {
    assert.equal(canAdminWorkspace(member, "user-1"), false)
})

test("Discord admin rights or a stored admin ID make an admin", () => {
    assert.equal(
        canAdminWorkspace({ ...member, canAdmin: true }, "user-1"),
        true
    )
    assert.equal(
        canAdminWorkspace({ ...member, adminIds: ["user-1"] }, "user-1"),
        true
    )
})

test("a clan override wins in both directions", () => {
    assert.equal(
        canAdminWorkspace(
            {
                ...member,
                canAdmin: true,
                adminAccessOverrides: { "user-1": false },
            },
            "user-1"
        ),
        false
    )
    assert.equal(
        canAdminWorkspace(
            { ...member, adminAccessOverrides: { "user-1": true } },
            "user-1"
        ),
        true
    )
})
