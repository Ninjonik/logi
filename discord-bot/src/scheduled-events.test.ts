import assert from "node:assert/strict";
import test from "node:test";

import { deriveScheduledEventLifecycle } from "./scheduled-events";
import type { EventRecord } from "./types";

const baseEvent: EventRecord = {
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
};

function withNow<T>(iso: string, run: () => T) {
  const originalNow = Date.now;
  Date.now = () => new Date(iso).getTime();
  try {
    return run();
  } finally {
    Date.now = originalNow;
  }
}

test("deriveScheduledEventLifecycle returns scheduled before meeting start", () => {
  withNow("2026-01-01T09:00:00.000Z", () => {
    assert.equal(deriveScheduledEventLifecycle(baseEvent), "scheduled");
  });
});

test("deriveScheduledEventLifecycle returns active after meeting start", () => {
  withNow("2026-01-01T10:15:00.000Z", () => {
    assert.equal(deriveScheduledEventLifecycle(baseEvent), "active");
  });
});

test("deriveScheduledEventLifecycle returns completed after game end", () => {
  withNow("2026-01-01T12:01:00.000Z", () => {
    assert.equal(deriveScheduledEventLifecycle(baseEvent), "completed");
  });
});

test("deriveScheduledEventLifecycle cancels concluded events before meeting start", () => {
  withNow("2026-01-01T09:00:00.000Z", () => {
    assert.equal(deriveScheduledEventLifecycle({
      ...baseEvent,
      status: "concluded",
    }), "canceled");
  });
});

test("deriveScheduledEventLifecycle completes concluded events after meeting start", () => {
  withNow("2026-01-01T10:15:00.000Z", () => {
    assert.equal(deriveScheduledEventLifecycle({
      ...baseEvent,
      status: "concluded",
    }), "completed");
  });
});
