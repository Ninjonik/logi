import assert from "node:assert/strict"
import test from "node:test"

import { canCloseSupportThread } from "./thread-close-authority"

const base = {
    isAdministrator: false,
    memberRoleIds: ["member"],
    dashboardAdminRoleId: "logi-admin",
    supportRoleIds: ["support"],
}

test("administrators, Logi admins and category support may close", () => {
    assert.equal(
        canCloseSupportThread({ ...base, isAdministrator: true }),
        true
    )
    assert.equal(
        canCloseSupportThread({ ...base, memberRoleIds: ["logi-admin"] }),
        true
    )
    assert.equal(
        canCloseSupportThread({ ...base, memberRoleIds: ["x", "support"] }),
        true
    )
})

test("anyone else may not, and a missing admin role grants nothing", () => {
    assert.equal(canCloseSupportThread(base), false)
    assert.equal(
        canCloseSupportThread({
            ...base,
            dashboardAdminRoleId: undefined,
            memberRoleIds: [""],
            supportRoleIds: [],
        }),
        false
    )
    assert.equal(
        canCloseSupportThread({
            ...base,
            dashboardAdminRoleId: "",
            memberRoleIds: [""],
        }),
        false
    )
})
