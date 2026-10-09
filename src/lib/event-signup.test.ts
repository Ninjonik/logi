import assert from "node:assert/strict"
import test from "node:test"

import { SIGNUP_NOT_ATTENDING } from "@/domain/events/types"

import {
    buildEventSignupActions,
    formatSignupResultMessage,
    resolveEventSignupSelection,
} from "./event-signup"

const labels = {
    attend: "Attend",
    generalSignup: "Sign up",
    decline: "Command",
    signupUpdatedWithType: "Signup updated - {type}.",
    signupRemovedWithType: "Removed signup from {type}.",
    markedNotAttending: "Marked as not attending.",
}

test("formatSignupResultMessage keeps first not attending click distinct from removal", () => {
    assert.equal(
        formatSignupResultMessage({
            removed: false,
            appliedSignupLabel: SIGNUP_NOT_ATTENDING,
            labels,
            emoji: "❌",
        }),
        "Marked as not attending."
    )

    assert.equal(
        formatSignupResultMessage({
            removed: true,
            appliedSignupLabel: SIGNUP_NOT_ATTENDING,
            labels,
            emoji: "❌",
        }),
        "Removed signup from ❌ Command."
    )
})

const signupLabels = {
    registrationClosed: "Closed",
    invalidSignupButton: "Invalid",
    unableToResolveMembership: "Membership unavailable",
    missingRequiredRole: "Missing role",
    membershipStatusNotAllowed: "Membership status not allowed",
    signupUpdated: "Updated",
    markedNotAttending: "Not attending",
}

const event = {
    kind: "match" as const,
    signupGroupIds: ["group-1"],
    allowedSignupStatuses: undefined,
    useGeneralSignup: false,
    requiredRoleIds: [],
    registrationEnd: "2099-01-01T00:00:00.000Z",
    status: "registration" as const,
}

test("dashboard group assignment permits signup without the linked Discord role", () => {
    const result = resolveEventSignupSelection({
        event,
        groups: [
            {
                id: "group-1",
                name: "Alpha",
                color: "#000",
                discordRoleId: "role-1",
            },
        ],
        memberRoleIds: [],
        assignedGroupIds: ["group-1"],
        membershipStatus: "member",
        actionId: "group-1",
        labels: signupLabels,
    })

    assert.deepEqual(result, {
        ok: true,
        group: "Alpha",
        successMessage: "Updated",
    })
})

test("unassigned users still need the linked Discord role to sign up", () => {
    const result = resolveEventSignupSelection({
        event,
        groups: [
            {
                id: "group-1",
                name: "Alpha",
                color: "#000",
                discordRoleId: "role-1",
            },
        ],
        memberRoleIds: [],
        assignedGroupIds: [],
        membershipStatus: "member",
        actionId: "group-1",
        labels: signupLabels,
    })

    assert.deepEqual(result, {
        ok: false,
        error: "Missing role",
        reason: "group_role",
        group: {
            id: "group-1",
            name: "Alpha",
            color: "#000",
            discordRoleId: "role-1",
        },
    })
})

test("an explicitly empty group list creates an ungrouped signup action", () => {
    const ungrouped = { ...event, signupGroupIds: [] }
    const actions = buildEventSignupActions(ungrouped, [], labels)

    assert.deepEqual(actions, [
        { id: "GENERAL", label: "Sign up", kind: "general" },
        { id: SIGNUP_NOT_ATTENDING, label: "Command", kind: "decline" },
    ])

    assert.deepEqual(
        resolveEventSignupSelection({
            event: ungrouped,
            groups: [],
            memberRoleIds: [],
            membershipStatus: "member",
            actionId: "GENERAL",
            labels: signupLabels,
        }),
        {
            ok: true,
            group: "GENERAL",
            successMessage: "Not attending",
        }
    )
})

test("refusals name their reason so Discord can explain the next step", () => {
    const base = {
        groups: [{ id: "group-1", name: "Alpha", color: "#000" }],
        memberRoleIds: [],
        assignedGroupIds: [],
        membershipStatus: "member" as const,
        actionId: "group-1",
        labels: signupLabels,
    }
    const reasonOf = (
        patch: Partial<Parameters<typeof resolveEventSignupSelection>[0]>
    ) => {
        const result = resolveEventSignupSelection({ ...base, event, ...patch })
        return result.ok ? null : result.reason
    }
    assert.equal(reasonOf({ event: { ...event, status: "closed" } }), "closed")
    assert.equal(reasonOf({ membershipStatus: null }), "membership")
    assert.equal(reasonOf({ memberRoleIds: null }), "unresolved")
    assert.equal(reasonOf({ actionId: "gone" }), "invalid")
    assert.equal(
        reasonOf({ event: { ...event, requiredRoleIds: ["role-x"] } }),
        "required_role"
    )
})
