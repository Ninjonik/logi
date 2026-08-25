import assert from "node:assert/strict";
import test from "node:test";

import { FakeClock } from "@/infrastructure/testing/fake-clock";
import { InMemoryEventWorkflowRepository, NoopEventWorkflowSyncPort } from "@/infrastructure/testing/in-memory-event-workflow";
import { SIGNUP_GENERAL } from "@/domain/events/types";

import { ToggleSignupUseCase } from "./toggle-signup.use-case";

test("ToggleSignupUseCase persists signups and triggers roster sync", async () => {
  const syncPort = new NoopEventWorkflowSyncPort();
  const events = new InMemoryEventWorkflowRepository(
    new Map([
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
    ]),
    new Map([["guild-1:user-1", { type: "member", status: "active" }]]),
  );
  const useCase = new ToggleSignupUseCase(
    events,
    syncPort,
    new FakeClock(new Date("2026-01-01T09:00:00.000Z")),
  );

  const result = await useCase.execute({
    eventId: "event-1",
    userId: "user-1",
    group: "INF",
  });

  assert.equal(result.signUps.length, 1);
  assert.equal(result.appliedSignupLabel, "INF");
  assert.equal(result.removed, false);
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

  const result = await useCase.execute({
    eventId: "event-1",
    userId: "user-1",
    group: "INF",
  });

  assert.deepEqual(result.signUps, [{ userId: "user-1", group: "INF" }]);
  assert.equal(result.appliedSignupLabel, "INF");
  assert.equal(result.removed, false);
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
      ["guild-1:user-1", { primaryGroupId: "group-1", type: "member", status: "active" }],
      ["guild-1:user-2", { type: "member", status: "active" }],
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

  assert.deepEqual(groupedSignup.signUps[0], { userId: "user-1", group: "INF" });
  assert.equal(groupedSignup.appliedSignupLabel, "INF");
  assert.equal(groupedSignup.removed, false);
  assert.deepEqual(reserveSignup.signUps[1], { userId: "user-2", group: "ATTENDING" });
  assert.equal(reserveSignup.appliedSignupLabel, SIGNUP_GENERAL);
  assert.equal(reserveSignup.removed, false);
});

test("ToggleSignupUseCase requires a clan membership status for match signups by default", async () => {
  const useCase = new ToggleSignupUseCase(
    new InMemoryEventWorkflowRepository(new Map([
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
    ])),
    new NoopEventWorkflowSyncPort(),
    new FakeClock(new Date("2026-01-01T09:00:00.000Z")),
  );

  await assert.rejects(() => useCase.execute({
    eventId: "event-1",
    userId: "user-1",
    group: "INF",
  }), /membership status is not allowed/i);
});

test("ToggleSignupUseCase enforces allowed match signup statuses", async () => {
  const useCase = new ToggleSignupUseCase(
    new InMemoryEventWorkflowRepository(
      new Map([
        ["event-1", {
          id: "event-1",
          guildId: "guild-1",
          kind: "match" as const,
          allowedSignupStatuses: ["reserve_member"],
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
        ["guild-1:user-1", { type: "member", status: "active" }],
        ["guild-1:user-2", { type: "reserve_member", status: "active" }],
      ]),
    ),
    new NoopEventWorkflowSyncPort(),
    new FakeClock(new Date("2026-01-01T09:00:00.000Z")),
  );

  await assert.rejects(() => useCase.execute({
    eventId: "event-1",
    userId: "user-1",
    group: "INF",
  }), /membership status is not allowed/i);

  const result = await useCase.execute({
    eventId: "event-1",
    userId: "user-2",
    group: "INF",
  });

  assert.deepEqual(result.signUps, [{ userId: "user-2", group: "INF" }]);
});

test("ToggleSignupUseCase marks repeated signup clicks as removed", async () => {
  const syncPort = new NoopEventWorkflowSyncPort();
  const events = new InMemoryEventWorkflowRepository(
    new Map([
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
    ]),
    new Map([["guild-1:user-1", { type: "member", status: "active" }]]),
  );
  const useCase = new ToggleSignupUseCase(
    events,
    syncPort,
    new FakeClock(new Date("2026-01-01T09:00:00.000Z")),
  );

  await useCase.execute({
    eventId: "event-1",
    userId: "user-1",
    group: "INF",
  });

  const result = await useCase.execute({
    eventId: "event-1",
    userId: "user-1",
    group: "INF",
  });

  assert.equal(result.removed, true);
  assert.deepEqual(result.signUps, []);
});
