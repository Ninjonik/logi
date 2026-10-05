import assert from "node:assert/strict"
import test from "node:test"

import {
    APPLICATION_OUTCOMES,
    assignmentAfterDecision,
    decisionRoles,
    decisionTable,
    isApplicationOutcome,
} from "./application-decision"

const policy = {
    clanRoleId: "clan",
    roleSync: true,
    category: { recruitRoleIds: ["recruit"], finalRoleIds: ["member"] },
}

test("outcomes follow the /close_application choice order (M3-38)", () => {
    assert.deepEqual(APPLICATION_OUTCOMES, [
        "member",
        "recruit",
        "mercenary",
        "pending",
        "denied",
    ])
    assert.equal(isApplicationOutcome("member"), true)
    assert.equal(isApplicationOutcome("reserve_member"), false)
})

test("each outcome writes the membership (L6-B08, M3-B07)", () => {
    assert.deepEqual(assignmentAfterDecision("member", "member"), {
        kind: "upsert",
        type: "member",
        status: "active",
    })
    // A reserve category keeps its reserve type when accepted.
    assert.deepEqual(assignmentAfterDecision("member", "reserve_member"), {
        kind: "upsert",
        type: "reserve_member",
        status: "active",
    })
    assert.deepEqual(assignmentAfterDecision("recruit", "mercenary"), {
        kind: "upsert",
        type: "member",
        status: "recruit",
    })
    assert.deepEqual(assignmentAfterDecision("mercenary", "member"), {
        kind: "upsert",
        type: "mercenary",
        status: "active",
    })
    assert.deepEqual(assignmentAfterDecision("pending", "member"), {
        kind: "upsert",
        type: "member",
        status: "pending",
    })
    assert.deepEqual(assignmentAfterDecision("denied", "member"), {
        kind: "remove",
    })
})

test("roles after the decision: added, kept and removed", () => {
    assert.deepEqual(decisionRoles(policy, "pending", "member", "member"), {
        after: ["clan", "member"],
        added: ["clan", "member"],
        removed: [],
    })
    assert.deepEqual(decisionRoles(policy, "recruit", "member", "member"), {
        after: ["clan", "member"],
        added: ["member"],
        removed: ["recruit"],
    })
    assert.deepEqual(decisionRoles(policy, "recruit", "denied", "member"), {
        after: [],
        added: [],
        removed: ["clan", "recruit"],
    })
    assert.deepEqual(
        decisionRoles({ ...policy, roleSync: false }, null, "member", "member"),
        { after: [], added: [], removed: [] }
    )
})

test("the settings table shows what each button does (N4-40)", () => {
    assert.deepEqual(decisionTable(policy, "member"), [
        { outcome: "member", add: ["clan", "member"], remove: ["recruit"] },
        { outcome: "recruit", add: ["clan", "recruit"], remove: [] },
        { outcome: "mercenary", add: ["clan", "member"], remove: ["recruit"] },
        { outcome: "denied", add: [], remove: ["clan", "recruit"] },
    ])
})
