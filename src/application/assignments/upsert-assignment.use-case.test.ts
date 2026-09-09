import assert from "node:assert/strict"
import test from "node:test"

import {
    InMemoryAssignmentCommandRepository,
    RecordingAssignmentRosterSyncPort,
} from "@/infrastructure/testing/in-memory-assignment-command"
import { FakeClock } from "@/infrastructure/testing/fake-clock"

import { UpsertAssignmentUseCase } from "./upsert-assignment.use-case"

test("UpsertAssignmentUseCase saves assignment, rebuilds membership, and syncs open rosters", async () => {
    const repository = new InMemoryAssignmentCommandRepository(
        new Map(),
        new Set(["guild-1"]),
        new Set(["user-1"]),
        new Map([["guild-1", new Map([["group-1", "Infantry"]])]]),
        new Map([["guild-1", ["event-1", "event-2"]]])
    )
    const sync = new RecordingAssignmentRosterSyncPort()
    const useCase = new UpsertAssignmentUseCase(
        repository,
        sync,
        new FakeClock(new Date("2026-07-22T12:00:00.000Z"))
    )

    const assignmentId = await useCase.execute({
        userId: "user-1",
        serverDiscordId: "guild-1",
        type: "member",
        status: "active",
        primaryGroupId: "group-1",
        secondaryGroupIds: ["group-1"],
        paused: false,
    })

    assert.equal(assignmentId, "assignment-1")
    assert.equal(
        repository.assignments.get("assignment-1")?.primaryGroupId,
        "group-1"
    )
    assert.equal(repository.serverMembershipPatches.length, 1)
    assert.equal(repository.userMembershipPatches.length, 1)
    assert.deepEqual(sync.eventIds, ["event-1", "event-2"])
})

test("UpsertAssignmentUseCase permits one membership per game", async () => {
    const repository = new InMemoryAssignmentCommandRepository(
        new Map(),
        new Set(["guild-1"]),
        new Set(["user-1"]),
        new Map([["guild-1", new Map()]]),
        new Map()
    )
    const useCase = new UpsertAssignmentUseCase(
        repository,
        new RecordingAssignmentRosterSyncPort(),
        new FakeClock(new Date("2026-07-22T12:00:00.000Z"))
    )

    await useCase.execute({
        userId: "user-1",
        serverDiscordId: "guild-1",
        gameId: "hell_let_loose",
        type: "member",
        status: "active",
        secondaryGroupIds: [],
        paused: false,
    })
    await useCase.execute({
        userId: "user-1",
        serverDiscordId: "guild-1",
        gameId: "hell_let_loose_vietnam",
        type: "mercenary",
        status: "active",
        secondaryGroupIds: [],
        paused: false,
    })

    assert.equal(repository.assignments.size, 2)
})
