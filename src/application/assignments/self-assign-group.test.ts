import {
    InMemoryAssignmentCommandRepository,
    RecordingAssignmentRosterSyncPort,
} from "@/infrastructure/testing/in-memory-assignment-command"
import { FakeClock } from "@/infrastructure/testing/fake-clock"
import { SelfAssignGroupUseCase } from "./self-assign-group"
import type { AssignmentRecord } from "./ports"
import assert from "node:assert/strict"
import test from "node:test"

function fixture() {
    const assignment: AssignmentRecord = {
        id: "assignment",
        serverId: "guild",
        userId: "user",
        gameId: "hell_let_loose",
        type: "member",
        status: "active",
        paused: false,
        primaryGroupId: "primary",
        secondaryGroupIds: ["staff"],
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
        membershipCategoryId: "category",
    }
    const repository = new InMemoryAssignmentCommandRepository(
        new Map([[assignment.id, assignment]]),
        new Set(["guild"]),
        new Set(["user"]),
        new Map([
            [
                "guild",
                new Map([
                    ["primary", "Infantry"],
                    ["staff", "Staff"],
                    ["tank", "Tanker"],
                ]),
            ],
        ]),
        new Map([["guild", ["event"]]])
    )
    const sync = new RecordingAssignmentRosterSyncPort()
    const allowed = ["tank", "primary"]
    const useCase = new SelfAssignGroupUseCase(
        repository,
        sync,
        new FakeClock(new Date("2026-01-02")),
        {
            allowedGroupIds: async (guild, game) =>
                guild === "guild" && game === "hell_let_loose" ? allowed : [],
        }
    )
    return { repository, sync, useCase, allowed }
}
const request = {
    guildId: "guild",
    gameId: "hell_let_loose",
    userId: "user",
    groupId: "tank",
    enabled: true,
}

test("self-service adds/removes only an allowed secondary group and syncs once per change", async () => {
    const { useCase, repository, sync } = fixture()
    await useCase.execute(request)
    const saved = repository.assignments.get("assignment")
    assert.deepEqual(saved?.secondaryGroupIds, ["staff", "tank"])
    assert.equal(saved?.primaryGroupId, "primary")
    assert.equal(saved?.membershipCategoryId, "category")
    assert.equal(saved?.status, "active")
    await useCase.execute(request)
    assert.deepEqual(sync.eventIds, ["event"])
    await useCase.execute({ ...request, enabled: false })
    assert.deepEqual(
        repository.assignments.get("assignment")?.secondaryGroupIds,
        ["staff"]
    )
    assert.deepEqual(sync.eventIds, ["event", "event"])
})

test("self-service rejects foreign games/clans/users, manager groups, primary groups, and revoked options", async () => {
    const { useCase, repository, allowed, sync } = fixture()
    for (const change of [
        { groupId: "staff" },
        { groupId: "primary", enabled: false },
        { guildId: "foreign" },
        { userId: "other" },
        { gameId: "wardogs" },
    ])
        await assert.rejects(useCase.execute({ ...request, ...change }))
    allowed.length = 0
    await assert.rejects(useCase.execute(request))
    assert.deepEqual(
        repository.assignments.get("assignment")?.secondaryGroupIds,
        ["staff"]
    )
    assert.deepEqual(sync.eventIds, [])
})

test("pending and paused memberships cannot self-assign", async () => {
    for (const patch of [{ status: "pending" as const }, { paused: true }]) {
        const { useCase, repository } = fixture()
        const assignment = repository.assignments.get("assignment")!
        repository.assignments.set("assignment", { ...assignment, ...patch })
        await assert.rejects(useCase.execute(request), /membership_required/)
    }
})
