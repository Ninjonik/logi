import type { MembershipObservation } from "@/domain/membership/observation"
import { readMembership, type MembershipReadPorts } from "./read-membership"
import assert from "node:assert/strict"
import test from "node:test"
const subject = {
    guildId: "guild",
    discordUserId: "user",
    gameId: "wardogs" as const,
}
const data: MembershipObservation = {
    ...subject,
    state: "unknown",
    roleIds: [],
    assignment: null,
    observedAt: null,
    receivedAt: null,
    epoch: "1",
    revision: "0",
    completeness: "unavailable",
}
const token = {
    epoch: "1",
    revision: "0",
    fence: 1,
    policyVersion: "1",
    startedAt: "2026-09-28T12:00:00Z",
}
test("membership use case rechecks authority after failed refresh and validates cached subject", async () => {
    const calls: string[] = []
    const ports: MembershipReadPorts = {
        prepare: async () => {
            calls.push("prepare")
            return { kind: "refresh", token }
        },
        refresh: async () => {
            calls.push("refresh")
            throw new Error("provider unavailable")
        },
        complete: async (_subject, expected, result) => {
            calls.push("complete")
            assert.deepEqual(expected, token)
            assert.equal(result.state, "unknown")
            return null
        },
    }
    assert.equal(await readMembership(subject, 60000, ports), null)
    assert.deepEqual(calls, ["prepare", "refresh", "complete"])
    await assert.rejects(
        () =>
            readMembership(subject, 60000, {
                ...ports,
                prepare: async () => ({
                    kind: "cached",
                    data: { ...data, guildId: "other" },
                }),
            }),
        /subject mismatch/
    )
})
