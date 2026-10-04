import {
    managedRolePolicy,
    planManagedRoleChanges,
    desiredMembershipRoles,
    canExecuteManagedRoles,
} from "./managed-roles"
import assert from "node:assert/strict"
import test from "node:test"

const config = {
    clanRoleId: "clan",
    dashboardAdminRoleId: "dashboard",
    membershipSettings: {
        enabled: true,
        autoAssignRecruitOnApply: true,
        categories: [
            {
                id: "members",
                recruitRoleIds: ["recruit"],
                finalRoleIds: ["member"],
                supportRoleIds: ["staff"],
            },
        ],
    },
    gameOverrides: {
        wardogs: {
            membershipSettings: {
                enabled: true,
                autoAssignRecruitOnApply: false,
                categories: [
                    {
                        id: "wdg",
                        recruitRoleIds: ["wdg-recruit"],
                        finalRoleIds: ["wdg-member"],
                        supportRoleIds: [],
                    },
                ],
            },
        },
    },
}

test("unmanaged roles and other games are preserved by the role difference", () => {
    assert.deepEqual(
        planManagedRoleChanges({
            observedRoleIds: ["external", "recruit", "wdg-member"],
            desiredManagedRoleIds: ["member"],
            allowedManagedRoleIds: ["recruit", "member"],
        }),
        { add: ["member"], remove: ["recruit"] }
    )
    assert.throws(
        () =>
            planManagedRoleChanges({
                observedRoleIds: [],
                desiredManagedRoleIds: ["admin"],
                allowedManagedRoleIds: ["member"],
            }),
        /scope/i
    )
})
test("pending recruit active reserve and mercenary transitions preserve current outcome policy", () => {
    const policy = managedRolePolicy(config, "hell_let_loose", [])
    for (const type of ["member", "reserve_member", "mercenary"] as const) {
        assert.deepEqual(
            desiredMembershipRoles(policy, {
                type,
                status: "pending",
                membershipCategoryId: "members",
            }),
            []
        )
        assert.deepEqual(
            desiredMembershipRoles(policy, {
                type,
                status: "recruit",
                membershipCategoryId: "members",
            }),
            ["clan", "recruit"]
        )
        assert.deepEqual(
            desiredMembershipRoles(policy, {
                type,
                status: "active",
                membershipCategoryId: "members",
            }),
            ["clan", "member"]
        )
    }
    assert.deepEqual(desiredMembershipRoles(policy, null), [])
})
test("cross-game role ownership and group/dashboard role collisions are rejected", () => {
    assert.deepEqual(managedRolePolicy(config, "wardogs", []).roleIds, [
        "clan",
        "wdg-member",
        "wdg-recruit",
    ])
    const conflicting = structuredClone(config)
    conflicting.gameOverrides.wardogs.membershipSettings.categories[0].finalRoleIds =
        ["member"]
    assert.throws(() => managedRolePolicy(conflicting, "wardogs", []), /owner/i)
    assert.throws(
        () => managedRolePolicy(config, "hell_let_loose", ["member"]),
        /owner/i
    )
    assert.deepEqual(
        managedRolePolicy(config, "hell_let_loose_vietnam", []).roleIds,
        []
    )
})
test("actor authority is current and recruitment permission cannot authorize general dashboard writes", () => {
    const input = {
        kind: "dashboard" as const,
        actorId: "actor",
        targetId: "target",
        actorPresent: true,
        actorAdministrator: false,
        actorRoleIds: ["staff"],
        adminOverride: undefined,
        dashboardRoleId: "dashboard",
        supportRoleIds: ["staff"],
        selfAllowed: false,
    }
    assert.equal(canExecuteManagedRoles(input), false)
    assert.equal(
        canExecuteManagedRoles({ ...input, kind: "recruitment" }),
        true
    )
    assert.equal(
        canExecuteManagedRoles({
            ...input,
            kind: "recruitment",
            actorRoleIds: [],
        }),
        false
    )
    assert.equal(
        canExecuteManagedRoles({
            ...input,
            actorPresent: false,
            actorAdministrator: true,
        }),
        false
    )
    assert.equal(
        canExecuteManagedRoles({
            ...input,
            actorRoleIds: ["dashboard"],
            adminOverride: false,
        }),
        false
    )
})
test("shared categories are owned by the game they name", () => {
    const shared = {
        clanRoleId: "clan",
        membershipSettings: {
            enabled: true,
            autoAssignRecruitOnApply: false,
            categories: [
                {
                    id: "hll",
                    recruitRoleIds: ["hll-recruit"],
                    finalRoleIds: ["hll-member"],
                    supportRoleIds: [],
                },
                {
                    id: "wdg",
                    gameId: "wardogs" as const,
                    recruitRoleIds: ["wdg-recruit"],
                    finalRoleIds: ["wdg-member"],
                    supportRoleIds: [],
                },
            ],
        },
    }
    assert.deepEqual(managedRolePolicy(shared, "hell_let_loose", []).roleIds, [
        "clan",
        "hll-member",
        "hll-recruit",
    ])
    const wardogs = managedRolePolicy(shared, "wardogs", [])
    assert.deepEqual(wardogs.roleIds, ["clan", "wdg-member", "wdg-recruit"])
    assert.deepEqual(
        desiredMembershipRoles(wardogs, {
            type: "member",
            status: "recruit",
            membershipCategoryId: "wdg",
        }),
        ["clan", "wdg-recruit"]
    )
    assert.deepEqual(
        desiredMembershipRoles(wardogs, {
            type: "member",
            status: "active",
            membershipCategoryId: "hll",
        }),
        ["clan"]
    )
    assert.deepEqual(
        managedRolePolicy(shared, "hell_let_loose_vietnam", []).roleIds,
        []
    )
    const reused = structuredClone(shared)
    reused.membershipSettings.categories[1]!.finalRoleIds = ["hll-member"]
    assert.throws(() => managedRolePolicy(reused, "wardogs", []), /owner/i)
})
