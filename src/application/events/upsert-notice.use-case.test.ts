import assert from "node:assert/strict";
import test from "node:test";

import { FakeClock } from "@/infrastructure/testing/fake-clock";
import { InMemoryEventWorkflowRepository } from "@/infrastructure/testing/in-memory-event-workflow";

import { UpsertNoticeUseCase } from "./upsert-notice.use-case";

test("UpsertNoticeUseCase persists a notice for an attending user within the notice window", async () => {
  const events = new InMemoryEventWorkflowRepository(new Map([
    ["event-1", {
      id: "event-1",
      guildId: "guild-1",
      kind: "match" as const,
      registrationEnd: "2026-01-01T10:00:00.000Z",
      meetingStart: "2026-01-01T11:00:00.000Z",
      gameEnd: "2026-01-01T13:00:00.000Z",
      status: "starting" as const,
      participants: [
        { userId: "user-1", status: "attending" as const, updatedAt: "2026-01-01T08:00:00.000Z" },
      ],
      signUps: [{ userId: "user-1", group: "INF" }],
      absenceNotices: [],
    }],
  ]));
  const useCase = new UpsertNoticeUseCase(
    events,
    new FakeClock(new Date("2026-01-01T10:30:00.000Z")),
  );

  const result = await useCase.execute({
    eventId: "event-1",
    userId: "user-1",
    reason: "Late by 10 min",
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(events.events.get("event-1")?.absenceNotices?.length, 1);
  assert.equal(events.events.get("event-1")?.absenceNotices?.[0]?.reason, "Late by 10 min");
});
