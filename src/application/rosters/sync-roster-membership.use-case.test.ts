import assert from "node:assert/strict";
import test from "node:test";

import { SyncRosterMembershipForEventUseCase, SyncRosterMembershipForUserUseCase } from "./sync-roster-membership.use-case";
import { FakeClock } from "@/infrastructure/testing/fake-clock";
import { InMemoryAssignmentRepository, InMemoryEventRepository, InMemoryRosterRepository } from "@/infrastructure/testing/in-memory-repositories";

test("SyncRosterMembershipForEventUseCase syncs tracked participants into roster buckets", async () => {
  const events = new InMemoryEventRepository(new Map([
    ["event-1", {
      id: "event-1",
      guildId: "guild-1",
      kind: "match" as const,
      registrationEnd: "2026-01-01T12:00:00.000Z",
      meetingStart: "2026-01-01T13:00:00.000Z",
      gameEnd: "2026-01-01T15:00:00.000Z",
      participants: [
        { userId: "user-1", status: "attending" as const, updatedAt: "2026-01-01T08:00:00.000Z" },
        { userId: "user-2", status: "not_attending" as const, updatedAt: "2026-01-01T08:00:00.000Z" },
      ],
    }],
  ]));
  const rosters = new InMemoryRosterRepository(new Map([
    ["event-1", {
      eventId: "event-1",
      squads: [],
      reservePlayerIds: [],
      reserveAttendances: [],
      notAttendingPlayerIds: [],
      published: false,
    }],
  ]));
  const assignments = new InMemoryAssignmentRepository([]);
  const useCase = new SyncRosterMembershipForEventUseCase(
    events,
    rosters,
    assignments,
    new FakeClock(new Date("2026-01-01T09:00:00.000Z")),
  );

  const result = await useCase.execute("event-1");
  const saved = await rosters.getByEventId("event-1");

  assert.equal(result, true);
  assert.deepEqual(saved?.reservePlayerIds, ["user-1"]);
  assert.deepEqual(saved?.notAttendingPlayerIds, ["user-2"]);
});

test("SyncRosterMembershipForUserUseCase updates only the targeted user placement", async () => {
  const events = new InMemoryEventRepository(new Map([
    ["event-1", {
      id: "event-1",
      guildId: "guild-1",
      kind: "match" as const,
      registrationEnd: "2026-01-01T12:00:00.000Z",
      meetingStart: "2026-01-01T13:00:00.000Z",
      gameEnd: "2026-01-01T15:00:00.000Z",
      participants: [
        { userId: "user-1", status: "attending" as const, updatedAt: "2026-01-01T08:00:00.000Z" },
      ],
    }],
  ]));
  const rosters = new InMemoryRosterRepository(new Map([
    ["event-1", {
      eventId: "event-1",
      squads: [],
      reservePlayerIds: [],
      reserveAttendances: [],
      notAttendingPlayerIds: [],
      published: false,
    }],
  ]));
  const assignments = new InMemoryAssignmentRepository([]);
  const useCase = new SyncRosterMembershipForUserUseCase(
    events,
    rosters,
    assignments,
    new FakeClock(new Date("2026-01-01T09:00:00.000Z")),
  );

  const result = await useCase.execute("event-1", "user-1");
  const saved = await rosters.getByEventId("event-1");

  assert.equal(result, true);
  assert.deepEqual(saved?.reservePlayerIds, ["user-1"]);
});
