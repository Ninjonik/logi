import assert from "node:assert/strict"
import test from "node:test"

import { skipsPendingOnApply, syncsMembershipRoles } from "./membership-options"

const settings = { enabled: true, autoAssignRecruitOnApply: false }

test("role sync follows applications until it has its own switch", () => {
    assert.equal(syncsMembershipRoles(settings), true)
    assert.equal(syncsMembershipRoles({ ...settings, enabled: false }), false)
    assert.equal(syncsMembershipRoles(undefined), false)
})

test("role sync can run without applications and stop with them on", () => {
    assert.equal(
        syncsMembershipRoles({
            ...settings,
            enabled: false,
            roleSyncEnabled: true,
        }),
        true
    )
    assert.equal(
        syncsMembershipRoles({ ...settings, roleSyncEnabled: false }),
        false
    )
})

test("a category's own skip switch wins over the clan-wide one", () => {
    const member = { assignmentType: "member" as const }
    assert.equal(skipsPendingOnApply(settings, member), false)
    assert.equal(
        skipsPendingOnApply(
            { autoAssignRecruitOnApply: true },
            { ...member, autoAssignRecruitOnApply: false }
        ),
        false
    )
    assert.equal(
        skipsPendingOnApply(settings, {
            ...member,
            autoAssignRecruitOnApply: true,
        }),
        true
    )
    assert.equal(
        skipsPendingOnApply({ autoAssignRecruitOnApply: true }, member),
        true
    )
})

test("only main members can skip waiting", () => {
    for (const assignmentType of ["reserve_member", "mercenary"] as const)
        assert.equal(
            skipsPendingOnApply(
                { autoAssignRecruitOnApply: true },
                { assignmentType, autoAssignRecruitOnApply: true }
            ),
            false
        )
    assert.equal(skipsPendingOnApply(settings, undefined), false)
})
