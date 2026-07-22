import assert from "node:assert/strict";
import test from "node:test";

import { FakeClock } from "@/infrastructure/testing/fake-clock";
import { InMemoryAssignmentCommandRepository, RecordingAssignmentRosterSyncPort } from "@/infrastructure/testing/in-memory-assignment-command";

import { ImportDiscordMembersUseCase } from "./import-discord-members.use-case";

test("ImportDiscordMembersUseCase upserts users and assignments then rebuilds membership", async () => {
  const repository = new InMemoryAssignmentCommandRepository(
    new Map(),
    new Set(["guild-1"]),
    new Set(),
    new Map([["guild-1", new Map([["group-1", "Infantry"]])]]),
    new Map([["guild-1", ["event-1"]]]),
  );
  const sync = new RecordingAssignmentRosterSyncPort();
  const useCase = new ImportDiscordMembersUseCase(
    repository,
    sync,
    new FakeClock(new Date("2026-07-22T12:00:00.000Z")),
  );

  const result = await useCase.execute({
    serverDiscordId: "guild-1",
    assignmentType: "member",
    members: [
      {
        userId: "user-1",
        name: "Player One",
        avatar: "",
        secondaryGroupIds: ["group-1"],
      },
    ],
  });

  assert.deepEqual(result, {
    importedCount: 1,
    createdUsers: 1,
    updatedUsers: 0,
    createdAssignments: 1,
    updatedAssignments: 0,
  });
  assert.equal(repository.assignments.size, 1);
  assert.equal(repository.serverMembershipPatches.length, 1);
  assert.equal(repository.userMembershipPatches.length, 1);
  assert.deepEqual(sync.eventIds, ["event-1"]);
});
