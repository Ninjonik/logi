import assert from "node:assert/strict";
import test from "node:test";

import { buildEventComponents, buildEventEmbed } from "./message-builders";
import type { DiscordConfig, EventRecord, Group } from "./types";

const config: DiscordConfig = {
  id: "config-1",
  guildId: "guild-1",
  timezone: "Europe/Berlin",
  defaultLanguage: "cs",
  calendarCategories: [],
  updatedAt: "2026-07-29T10:00:00.000Z",
};

const groups: Group[] = [
  {
    id: "command",
    guildId: "guild-1",
    name: "Command",
    color: "#d4a017",
    updatedAt: "2026-07-29T10:00:00.000Z",
  },
  {
    id: "inf",
    guildId: "guild-1",
    name: "Infantry",
    color: "#dc2626",
    updatedAt: "2026-07-29T10:00:00.000Z",
  },
];

function createMatchEvent(patch: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "event-1",
    guildId: "guild-1",
    kind: "match",
    name: "Test Match",
    requiredRoleIds: [],
    rewardRoleIds: [],
    registrationEnd: "2026-07-29T12:30:00.000Z",
    meetingStart: "2026-07-29T13:00:00.000Z",
    gameStart: "2026-07-29T14:00:00.000Z",
    gameEnd: "2026-07-29T16:00:00.000Z",
    pingClan: false,
    createForumChannel: false,
    status: "registration",
    statusUpdatedAt: "2026-07-29T10:00:00.000Z",
    attendanceReminderLog: [],
    signUps: [],
    participants: [],
    updatedAt: "2026-07-29T10:00:00.000Z",
    ...patch,
  };
}

test("buildEventComponents omits group buttons when signupGroupIds is empty", () => {
  const rows = buildEventComponents(
    config,
    groups,
    createMatchEvent({
      signupGroupIds: [],
      useGeneralSignup: true,
    }),
  );

  const buttons = rows.flatMap((row) => row.toJSON().components);
  assert.deepEqual(
    buttons.map((button) => ("label" in button ? button.label : undefined)),
    ["Přihlásit se", "Odmítnout", "Přidat do kalendáře"],
  );
  assert.equal(buttons[0]?.style, 3);
  assert.equal("emoji" in (buttons[0] ?? {}) ? buttons[0]?.emoji?.name : undefined, "✅");
});

test("buildEventEmbed omits group fields when signupGroupIds is empty", () => {
  const embed = buildEventEmbed(
    config,
    groups,
    createMatchEvent({
      signupGroupIds: [],
      participants: [
        {
          userId: "user-1",
          status: "not_attending",
          updatedAt: "2026-07-29T10:00:00.000Z",
        },
      ],
    }),
  );

  const fields = embed.toJSON().fields ?? [];
  assert.equal(fields.length, 1);
  assert.match(fields[0]?.name ?? "", /Neúčastní se|Not attending/i);
});
