import assert from "node:assert/strict";
import test from "node:test";

import { buildScheduledEventDescription, resolveScheduledEventEndTime } from "./scheduled-event-content";

test("buildScheduledEventDescription includes match metadata and trims empty lines", () => {
  const description = buildScheduledEventDescription({
    id: "event-1",
    guildId: "guild-1",
    kind: "match",
    name: "Operation Test",
    requiredRoleIds: [],
    rewardRoleIds: [],
    registrationEnd: "2026-01-01T08:00:00.000Z",
    meetingStart: "2026-01-01T10:00:00.000Z",
    gameStart: "2026-01-01T10:30:00.000Z",
    gameEnd: "2026-01-01T12:00:00.000Z",
    pingClan: false,
    createForumChannel: true,
    status: "registration",
    statusUpdatedAt: "2026-01-01T07:00:00.000Z",
    attendanceReminderLog: [],
    signUps: [],
    participants: [],
    updatedAt: "event-v1",
    description: "Briefing",
    map: "Kharkov",
    side: "Allies",
  }, "en");

  assert.match(description, /Briefing/);
  assert.match(description, /Kharkov/);
  assert.match(description, /Allies/);
});

test("resolveScheduledEventEndTime falls back to ninety minutes after meeting start", () => {
  const endTime = resolveScheduledEventEndTime({
    meetingStart: "2026-01-01T10:00:00.000Z",
    gameEnd: "invalid",
  });

  assert.equal(endTime.toISOString(), "2026-01-01T11:30:00.000Z");
});
