import assert from "node:assert/strict"
import test from "node:test"

import type { AssignmentAfterDecision } from "../../domain/membership/application-decision"

import {
    decideApplication,
    type DecideApplicationPorts,
} from "./decide-application"

const policy = {
    clanRoleId: "clan",
    roleSync: true,
    category: { recruitRoleIds: ["recruit"], finalRoleIds: ["member"] },
}

function fake(overrides: Partial<DecideApplicationPorts> = {}) {
    const calls: string[] = []
    const changes: AssignmentAfterDecision[] = []
    const ports: DecideApplicationPorts = {
        claim: async () => {
            calls.push("claim")
            return "ok"
        },
        release: async () => {
            calls.push("release")
        },
        writeAssignment: async (change) => {
            calls.push("assignment")
            changes.push(change)
        },
        close: async () => {
            calls.push("close")
        },
        showDecision: async () => {
            calls.push("card")
        },
        sendDm: async () => {
            calls.push("dm")
            return "sent" as const
        },
        finishThread: async () => {
            calls.push("thread")
        },
        report: (step) => {
            calls.push(`report:${step}`)
        },
        ...overrides,
    }
    return { ports, calls, changes }
}

test("accepting writes the membership, closes, edits the card, DMs and locks", async () => {
    const { ports, calls, changes } = fake()
    const result = await decideApplication(ports, {
        outcome: "member",
        categoryType: "member",
        before: "pending",
        policy,
    })
    assert.deepEqual(calls, [
        "claim",
        "assignment",
        "close",
        "card",
        "dm",
        "thread",
    ])
    assert.deepEqual(changes, [
        { kind: "upsert", type: "member", status: "active" },
    ])
    assert.deepEqual(result, {
        status: "decided",
        roles: {
            after: ["clan", "member"],
            added: ["clan", "member"],
            removed: [],
        },
        dm: "sent",
    })
})

test("an application already decided or being decided changes nothing", async () => {
    for (const claim of ["closed", "busy", "missing"] as const) {
        const { ports, calls } = fake({ claim: async () => claim })
        assert.deepEqual(
            await decideApplication(ports, {
                outcome: "denied",
                categoryType: "member",
                before: "recruit",
                policy,
            }),
            { status: claim }
        )
        assert.deepEqual(calls, [])
    }
})

test("a failed membership write releases the claim and leaves the thread open", async () => {
    const { ports, calls } = fake({
        writeAssignment: async () => {
            throw new Error("Convex unavailable")
        },
    })
    await assert.rejects(
        decideApplication(ports, {
            outcome: "member",
            categoryType: "member",
            before: "pending",
            policy,
        })
    )
    assert.deepEqual(calls, ["claim", "release"])
})

test("an undelivered DM is reported in the result, the decision stands (L4-34)", async () => {
    const { ports, calls } = fake({
        sendDm: async () => {
            throw new Error("Cannot send messages to this user")
        },
    })
    const result = await decideApplication(ports, {
        outcome: "denied",
        categoryType: "member",
        before: "recruit",
        policy,
    })
    assert.equal(result.status, "decided")
    assert.equal(result.status === "decided" && result.dm, "failed")
    assert.ok(calls.includes("report:dm"))
    assert.ok(calls.includes("thread"))
})

test("a clan that switched decision DMs off sends none, and says so (N1-39)", async () => {
    const { ports, calls } = fake({
        sendDm: async () => "off" as const,
    })
    const result = await decideApplication(ports, {
        outcome: "member",
        categoryType: "member",
        before: "recruit",
        policy,
    })
    assert.equal(result.status === "decided" && result.dm, "off")
    assert.ok(!calls.includes("report:dm"))
})
