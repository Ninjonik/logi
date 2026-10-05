import assert from "node:assert/strict"
import test from "node:test"

import {
    dashboardManagers,
    roleMemberCounts,
    type StoredMemberAccess,
} from "./role-access"

function member(
    userId: string,
    overrides: Partial<StoredMemberAccess> = {}
): StoredMemberAccess {
    return {
        userId,
        roleIds: [],
        isAdmin: false,
        hasDashboardAccess: false,
        ...overrides,
    }
}

test("role counts count each member once per role, most held first", () => {
    assert.deepEqual(
        roleMemberCounts([
            member("a", { roleIds: ["clan", "mod", "clan"] }),
            member("b", { roleIds: ["clan"] }),
            member("c", { roleIds: ["zeta"] }),
        ]),
        [
            { roleId: "clan", count: 2 },
            { roleId: "mod", count: 1 },
            { roleId: "zeta", count: 1 },
        ]
    )
    assert.deepEqual(roleMemberCounts([]), [])
})

test("managers are administrators, manager role holders and people added in Logi", () => {
    const managers = dashboardManagers({
        rows: [
            member("owner", { isAdmin: true, hasDashboardAccess: true }),
            member("officer", {
                roleIds: ["managers"],
                hasDashboardAccess: true,
            }),
            member("player", { roleIds: ["clan"] }),
            member("both", {
                isAdmin: true,
                hasDashboardAccess: true,
                roleIds: ["managers"],
            }),
        ],
        serverAdminIds: ["added"],
        managerRoleId: "managers",
    })
    assert.deepEqual(managers, [
        { userId: "both", reasons: ["administrator", "role"] },
        { userId: "owner", reasons: ["administrator"] },
        { userId: "added", reasons: ["granted"] },
        { userId: "officer", reasons: ["role"] },
    ])
})

test("a manual setting decides, except for Discord administrators", () => {
    const managers = dashboardManagers({
        rows: [
            member("revoked", {
                roleIds: ["managers"],
                hasDashboardAccess: true,
            }),
            member("admin", { isAdmin: true, hasDashboardAccess: true }),
            member("manual", { roleIds: ["clan"] }),
        ],
        serverAdminIds: ["revoked"],
        adminAccessOverrides: { revoked: false, admin: false, manual: true },
        managerRoleId: "managers",
    })
    assert.deepEqual(managers, [
        { userId: "admin", reasons: ["administrator"] },
        { userId: "manual", reasons: ["granted"] },
    ])
})

test("without a manager role only the stored access counts", () => {
    assert.deepEqual(
        dashboardManagers({
            rows: [
                member("synced", { hasDashboardAccess: true }),
                member("player", { roleIds: ["managers"] }),
            ],
            serverAdminIds: [],
        }),
        [{ userId: "synced", reasons: ["role"] }]
    )
})
