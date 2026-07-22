import assert from "node:assert/strict";
import test from "node:test";
import { ChannelType, GuildScheduledEventStatus } from "discord.js";

import { cancelScheduledDiscordEvent, deriveScheduledEventLifecycle, syncScheduledDiscordEvent } from "./scheduled-events";
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

test("syncScheduledDiscordEvent cancels unsupported meeting channels and clears scheduled state", async () => {
  const edits: unknown[] = [];
  const guild = {
    id: "guild-1",
    scheduledEvents: {
      fetch: async () => ({
        status: GuildScheduledEventStatus.Scheduled,
        edit: async (input: unknown) => {
          edits.push(input);
          return {};
        },
      }),
    },
  };

  const result = await syncScheduledDiscordEvent({
    guild: guild as never,
    event: baseEvent,
    language: "en",
    meetingChannel: { type: ChannelType.GuildText } as never,
    scheduledEventId: "sched-1",
    desiredLifecycle: "scheduled",
  });

  assert.deepEqual(result, {
    scheduledEventId: undefined,
    scheduledEventStatus: "canceled",
  });
  assert.deepEqual(edits, [{ status: GuildScheduledEventStatus.Canceled }]);
});

test("syncScheduledDiscordEvent returns completed without creating past lifecycle events", async () => {
  const guild = {
    id: "guild-1",
    scheduledEvents: {
      fetch: async () => null,
      create: async () => {
        throw new Error("should not create");
      },
    },
  };

  const result = await syncScheduledDiscordEvent({
    guild: guild as never,
    event: baseEvent,
    language: "en",
    meetingChannel: { id: "voice-1", type: ChannelType.GuildVoice } as never,
    desiredLifecycle: "completed",
  });

  assert.deepEqual(result, {
    scheduledEventId: undefined,
    scheduledEventStatus: "completed",
  });
});

test("syncScheduledDiscordEvent creates and advances scheduled events when needed", async () => {
  const edits: unknown[] = [];
  const guild = {
    id: "guild-1",
    scheduledEvents: {
      fetch: async () => null,
      create: async () => ({
        id: "sched-1",
        status: GuildScheduledEventStatus.Scheduled,
        edit: async (input: unknown) => {
          edits.push(input);
          return { id: "sched-1", status: GuildScheduledEventStatus.Active, edit: async () => ({}) };
        },
      }),
    },
  };

  const result = await syncScheduledDiscordEvent({
    guild: guild as never,
    event: baseEvent,
    language: "en",
    meetingChannel: { id: "voice-1", type: ChannelType.GuildVoice } as never,
    desiredLifecycle: "active",
  });

  assert.deepEqual(result, {
    scheduledEventId: "sched-1",
    scheduledEventStatus: "active",
  });
  assert.deepEqual(edits, [{ status: GuildScheduledEventStatus.Active }]);
});

test("syncScheduledDiscordEvent edits existing scheduled events and tolerates edit failures", async () => {
  const scheduledEvent = {
    id: "sched-1",
    status: GuildScheduledEventStatus.Scheduled,
    edit: async (input: any) => {
      if (input.status) {
        throw new Error("advance failed");
      }
      throw new Error("metadata failed");
    },
  };
  const guild = {
    id: "guild-1",
    scheduledEvents: {
      fetch: async () => scheduledEvent,
    },
  };

  const result = await syncScheduledDiscordEvent({
    guild: guild as never,
    event: baseEvent,
    language: "en",
    meetingChannel: { id: "voice-1", type: ChannelType.GuildVoice } as never,
    scheduledEventId: "sched-1",
    desiredLifecycle: "active",
  });

  assert.deepEqual(result, {
    scheduledEventId: "sched-1",
    scheduledEventStatus: "active",
  });
});

test("cancelScheduledDiscordEvent returns false when missing and true when already terminal", async () => {
  const missing = await cancelScheduledDiscordEvent({
    scheduledEvents: {
      fetch: async () => null,
    },
  } as never, "sched-404");
  assert.equal(missing, false);

  const terminal = await cancelScheduledDiscordEvent({
    scheduledEvents: {
      fetch: async () => ({
        status: GuildScheduledEventStatus.Completed,
        edit: async () => {
          throw new Error("should not edit");
        },
      }),
    },
  } as never, "sched-1");
  assert.equal(terminal, true);
});
