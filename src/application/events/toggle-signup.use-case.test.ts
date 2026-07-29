import assert from "node:assert/strict";
import test from "node:test";

import { FakeClock } from "@/infrastructure/testing/fake-clock";
import { InMemoryEventWorkflowRepository, NoopEventWorkflowSyncPort } from "@/infrastructure/testing/in-memory-event-workflow";
import { SIGNUP_GENERAL } from "@/domain/events/types";

import { ToggleSignupUseCase } from "./toggle-signup.use-case";

test("ToggleSignupUseCase persists signups and triggers roster sync", async () => {
  const syncPort = new NoopEventWorkflowSyncPort();
  const events = new InMemoryEventWorkflowRepository(new Map([
    ["event-1", {
      id: "event-1",
      guildId: "guild-1",
      kind: "match" as const,
      registrationEnd: "2026-01-01T12:00:00.000Z",
      meetingStart: "2026-01-01T13:00:00.000Z",
      gameEnd: "2026-01-01T15:00:00.000Z",
      status: "registration" as const,
      participants: [],
      signUps: [],
      absenceNotices: [],
    }],
  ]));
  const useCase = new ToggleSignupUseCase(
    events,
    syncPort,
    new FakeClock(new Date("2026-01-01T09:00:00.000Z")),
  );

  const signUps = await useCase.execute({
    eventId: "event-1",
    userId: "user-1",
    group: "INF",
  });

  assert.equal(signUps.length, 1);
  assert.equal(syncPort.calls.length, 1);
  assert.deepEqual(syncPort.calls[0], { eventId: "event-1", userId: "user-1" });
  assert.equal(events.events.get("event-1")?.participants?.[0]?.status, "attending");
});

test("ToggleSignupUseCase rejects unknown events", async () => {
  const useCase = new ToggleSignupUseCase(
    new InMemoryEventWorkflowRepository(new Map()),
    new NoopEventWorkflowSyncPort(),
    new FakeClock(new Date("2026-01-01T09:00:00.000Z")),
  );

  await assert.rejects(() => useCase.execute({
    eventId: "missing",
    userId: "user-1",
    group: "INF",
  }), /Event not found/);
});

test("ToggleSignupUseCase supports training signups during starting before registration end", async () => {
  const syncPort = new NoopEventWorkflowSyncPort();
  const events = new InMemoryEventWorkflowRepository(new Map([
    ["event-1", {
      id: "event-1",
      guildId: "guild-1",
      kind: "training" as const,
      registrationEnd: "2026-01-01T12:00:00.000Z",
      meetingStart: "2026-01-01T11:00:00.000Z",
      gameEnd: "2026-01-01T13:00:00.000Z",
      status: "starting" as const,
      participants: [],
      signUps: [],
      absenceNotices: [],
    }],
  ]));
  const useCase = new ToggleSignupUseCase(
    events,
    syncPort,
    new FakeClock(new Date("2026-01-01T11:30:00.000Z")),
  );

  const signUps = await useCase.execute({
    eventId: "event-1",
    userId: "user-1",
    group: "INF",
  });

  assert.deepEqual(signUps, [{ userId: "user-1", group: "INF" }]);
  assert.equal(syncPort.calls.length, 1);
});

test("ToggleSignupUseCase resolves general match signup from the primary group and falls back to reserves", async () => {
  const syncPort = new NoopEventWorkflowSyncPort();
  const events = new InMemoryEventWorkflowRepository(
    new Map([
      ["event-1", {
        id: "event-1",
        guildId: "guild-1",
        kind: "match" as const,
        signupGroupIds: ["group-1"],
        useGeneralSignup: true,
        registrationEnd: "2026-01-01T12:00:00.000Z",
        meetingStart: "2026-01-01T13:00:00.000Z",
        gameEnd: "2026-01-01T15:00:00.000Z",
        status: "registration" as const,
        participants: [],
        signUps: [],
        absenceNotices: [],
      }],
    ]),
    new Map([
      ["guild-1:user-1", { primaryGroupId: "group-1" }],
      ["guild-1:user-2", {}],
    ]),
    new Map([["group-1", "INF"]]),
  );
  const useCase = new ToggleSignupUseCase(
    events,
    syncPort,
    new FakeClock(new Date("2026-01-01T09:00:00.000Z")),
  );

  const groupedSignup = await useCase.execute({
    eventId: "event-1",
    userId: "user-1",
    group: SIGNUP_GENERAL,
  });
  const reserveSignup = await useCase.execute({
    eventId: "event-1",
    userId: "user-2",
    group: SIGNUP_GENERAL,
  });

  assert.deepEqual(groupedSignup[0], { userId: "user-1", group: "INF" });
  assert.deepEqual(reserveSignup[1], { userId: "user-2", group: "ATTENDING" });
});
