import assert from "node:assert/strict";
import test from "node:test";

import {
  assertInternalSecret,
  handleAppendAttendanceReminderLog,
  handleConcludeEvent,
  handleFindNoticeTarget,
  handleSetEventResult,
  handleToggleSignup,
  handleUpsertEvent,
  handleUpsertNotice,
} from "./event-handlers";

test("assertInternalSecret rejects invalid secrets", () => {
  assert.throws(() => assertInternalSecret("bad", "good"), /Unauthorized/);
});

test("handleUpsertEvent rejects unknown guilds and maps guild identity for the use case", async () => {
  await assert.rejects(() => handleUpsertEvent({
    secret: "secret",
    expectedSecret: "secret",
    args: {
      secret: "secret",
      serverId: "guild-1",
      name: "Event",
      registrationEnd: "2026-07-23T10:00:00.000Z",
      meetingStart: "2026-07-23T11:00:00.000Z",
      gameStart: "2026-07-23T12:00:00.000Z",
      gameEnd: "2026-07-23T14:00:00.000Z",
      pingClan: false,
    },
    getGuildById: async () => null,
    getGuildDiscordId: () => "discord-1",
    createUseCase: () => ({ execute: async () => "event-1" }),
  }), /Server not found/);

  const calls: Array<Record<string, unknown>> = [];
  const result = await handleUpsertEvent({
    secret: "secret",
    expectedSecret: "secret",
    args: {
      secret: "secret",
      serverId: "guild-1",
      eventId: "event-1",
      topicPresetId: "preset-1",
      name: "Event",
      registrationEnd: "2026-07-23T10:00:00.000Z",
      meetingStart: "2026-07-23T11:00:00.000Z",
      gameStart: "2026-07-23T12:00:00.000Z",
      gameEnd: "2026-07-23T14:00:00.000Z",
      pingClan: false,
    },
    getGuildById: async () => ({ discordId: "discord-1" }),
    getGuildDiscordId: (guild) => guild.discordId ?? "",
    createUseCase: () => ({
      execute: async (input) => {
        calls.push(input as Record<string, unknown>);
        return "event-1";
      },
    }),
  });

  assert.equal(result, "event-1");
  assert.equal(calls[0]?.guildId, "discord-1");
  assert.equal(calls[0]?.topicPresetId, "preset-1");
});

test("handleToggleSignup, handleConcludeEvent, and handleUpsertNotice delegate after auth", async () => {
  const signups = await handleToggleSignup({
    secret: "secret",
    expectedSecret: "secret",
    args: { eventId: "event-1", userId: "user-1", group: "INF" },
    createUseCase: () => ({ execute: async (input) => [input] }),
  });
  assert.deepEqual(signups, [{ eventId: "event-1", userId: "user-1", group: "INF" }]);

  const conclude = await handleConcludeEvent({
    secret: "secret",
    expectedSecret: "secret",
    eventId: "event-1",
    createUseCase: () => ({ execute: async (eventId) => ({ eventId }) }),
  });
  assert.deepEqual(conclude, { eventId: "event-1" });

  const notice = await handleUpsertNotice({
    secret: "secret",
    expectedSecret: "secret",
    args: { eventId: "event-1", userId: "user-1", reason: "Late" },
    createUseCase: () => ({ execute: async () => ({ ok: true as const }) }),
  });
  assert.deepEqual(notice, { ok: true });
});

test("handleAppendAttendanceReminderLog appends reminders and rejects missing events", async () => {
  await assert.rejects(() => handleAppendAttendanceReminderLog({
    secret: "secret",
    expectedSecret: "secret",
    eventId: "event-404",
    reminders: [],
    getEventById: async () => null,
    patchEvent: async () => undefined,
  }), /Event not found/);

  const patches: Array<Record<string, unknown>> = [];
  const result = await handleAppendAttendanceReminderLog({
    secret: "secret",
    expectedSecret: "secret",
    eventId: "event-1",
    reminders: [{ userId: "user-2", offsetHours: 1, sentAt: "2026-07-22T10:00:00.000Z" }],
    getEventById: async () => ({
      registrationEnd: "2026-07-22T09:00:00.000Z",
      meetingStart: "2026-07-22T11:00:00.000Z",
      gameEnd: "2026-07-22T13:00:00.000Z",
      attendanceReminderLog: [{ userId: "user-1", offsetHours: 2, sentAt: "2026-07-22T09:00:00.000Z" }],
    }),
    patchEvent: async (_eventId, patch) => {
      patches.push(patch);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.deepEqual(patches[0]?.attendanceReminderLog, [
    { userId: "user-1", offsetHours: 2, sentAt: "2026-07-22T09:00:00.000Z" },
    { userId: "user-2", offsetHours: 1, sentAt: "2026-07-22T10:00:00.000Z" },
  ]);
});

test("handleSetEventResult patches existing events and rejects missing ones", async () => {
  await assert.rejects(() => handleSetEventResult({
    secret: "secret",
    expectedSecret: "secret",
    eventId: "event-404",
    eventResult: {},
    getEventById: async () => null,
    patchEvent: async () => undefined,
  }), /Event not found/);

  const patches: Array<Record<string, unknown>> = [];
  const result = await handleSetEventResult({
    secret: "secret",
    expectedSecret: "secret",
    eventId: "event-1",
    eventResult: { outcome: "victory" },
    getEventById: async () => ({ id: "event-1" }),
    patchEvent: async (_eventId, patch) => {
      patches.push(patch);
    },
  });

  assert.deepEqual(result, { ok: true });
  assert.equal(patches[0]?.eventResult instanceof Object, true);
});

test("handleFindNoticeTarget maps normalized event records through the notice filter", () => {
  const result = handleFindNoticeTarget({
    events: [{
      _id: "event-1",
      name: "Match Alpha",
      registrationEnd: "2026-07-22T09:00:00.000Z",
      meetingStart: "2026-07-22T11:00:00.000Z",
      gameEnd: "2026-07-22T13:00:00.000Z",
      status: "starting",
      participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-07-22T08:00:00.000Z" }],
    }],
    userId: "user-1",
    query: "alpha",
    now: new Date("2026-07-22T10:30:00.000Z"),
  });

  assert.deepEqual(result, [{
    id: "event-1",
    name: "Match Alpha",
    meetingStart: "2026-07-22T11:00:00.000Z",
  }]);
});
