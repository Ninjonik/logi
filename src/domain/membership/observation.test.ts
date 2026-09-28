import {
    isFreshObservation,
    projectMembership,
    type StoredObservation,
} from "./observation"
import assert from "node:assert/strict"
import test from "node:test"

const now = Date.parse("2026-09-28T12:00:00Z")
const subject = {
    guildId: "guild-a",
    discordUserId: "member-a",
    gameId: "wardogs" as const,
}
const row: StoredObservation = {
    epoch: "2",
    revision: "10",
    state: "present",
    roleIds: ["allowed", "private-admin"],
    observedAt: new Date(now - 60_001).toISOString(),
    receivedAt: new Date(now).toISOString(),
}
const input = {
    epoch: "2",
    revision: "10",
    allowedRoleIds: ["allowed"],
    assignment: null,
    maxAgeMs: 60_000,
    now,
}
test("fresh ingestion time cannot disguise an old Discord observation", () => {
    assert.equal(isFreshObservation(row, "2", 60_000, now), false)
    assert.equal(isFreshObservation(row, "2", 300_000, now), true)
    const unavailable = projectMembership(subject, row, input)
    assert.equal(unavailable.state, "unknown")
    assert.equal(unavailable.completeness, "unavailable")
    assert.deepEqual(unavailable.roleIds, [])
    assert.equal(unavailable.observedAt, row.observedAt)
})
test("role changes invalidate the epoch and only configured roles may be returned", () => {
    const fresh = { ...row, observedAt: new Date(now).toISOString() }
    assert.equal(
        projectMembership(subject, fresh, { ...input, epoch: "3" }).state,
        "unknown"
    )
    assert.deepEqual(projectMembership(subject, fresh, input).roleIds, [
        "allowed",
    ])
    assert.equal(
        projectMembership(subject, { ...fresh, state: "left" }, input)
            .completeness,
        "verified_absent"
    )
    assert.deepEqual(
        projectMembership(subject, { ...fresh, state: "left" }, input).roleIds,
        []
    )
    assert.equal(
        projectMembership(subject, { ...fresh, unavailable: true }, input)
            .state,
        "unknown"
    )
    assert.equal(
        isFreshObservation(
            { ...fresh, observedAt: new Date(now + 1).toISOString() },
            "2",
            60_000,
            now
        ),
        false
    )
})
