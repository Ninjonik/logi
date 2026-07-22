import assert from "node:assert/strict";
import test from "node:test";

import { FakeClock } from "@/infrastructure/testing/fake-clock";
import { InMemoryAssignmentCommandRepository, RecordingAssignmentRosterSyncPort } from "@/infrastructure/testing/in-memory-assignment-command";

import { RemoveAssignmentUseCase } from "./remove-assignment.use-case";

test("RemoveAssignmentUseCase deletes assignment, rebuilds membership, and syncs open rosters", async () => {
  const repository = new InMemoryAssignmentCommandRepository(
    new Map([["assignment-1", {
      id: "assignment-1",
      userId: "user-1",
      serverId: "guild-1",
      type: "member",
      status: "active",
      secondaryGroupIds: [],
      paused: false,
      createdAt: "2026-07-21T12:00:00.000Z",
      updatedAt: "2026-07-21T12:00:00.000Z",
    }]]),
    new Set(["guild-1"]),
    new Set(["user-1"]),
    new Map([["guild-1", new Map()]]),
    new Map([["guild-1", ["event-1"]]]),
  );
  const sync = new RecordingAssignmentRosterSyncPort();
  const useCase = new RemoveAssignmentUseCase(
    repository,
    sync,
    new FakeClock(new Date("2026-07-22T12:00:00.000Z")),
  );

  const result = await useCase.execute("assignment-1");

  assert.deepEqual(result, { ok: true });
  assert.equal(repository.assignments.has("assignment-1"), false);
  assert.equal(repository.serverMembershipPatches.length, 1);
  assert.equal(repository.userMembershipPatches.length, 1);
  assert.deepEqual(sync.eventIds, ["event-1"]);
});
