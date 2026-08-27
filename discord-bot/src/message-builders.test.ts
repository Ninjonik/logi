import assert from "node:assert/strict";
import test from "node:test";

import { buildCalendarPanelEmbed, buildEventComponents, buildEventEmbed } from "./message-builders";
import type { CalendarItem, DiscordConfig, EventCategory, EventRecord, Group } from "./types";

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

const eventCategories: EventCategory[] = [
  {
    id: "competitive",
    label: "Competitive",
    color: "#dc2626",
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

function createTrainingEvent(patch: Partial<EventRecord> = {}): EventRecord {
  return {
    ...createMatchEvent({
      kind: "training",
      name: "Test Training",
      signupGroupIds: [],
      participants: [],
      signUps: [],
    }),
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
    eventCategories,
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

test("buildEventEmbed uses training-specific start wording for trainings", () => {
  const embed = buildEventEmbed(
    config,
    groups,
    eventCategories,
    createTrainingEvent(),
  );

  assert.match(embed.toJSON().description ?? "", /Začátek trainingu|Training Start/);
  assert.doesNotMatch(embed.toJSON().description ?? "", /Start zápasu|Match Start/);
});

test("buildCalendarPanelEmbed renders chronicle-style grouped rows with matched color chips", () => {
  const embed = buildCalendarPanelEmbed(
    config,
    [
      {
        id: "competitive",
        label: "Kompetitivní zápas",
        color: "#dc2626",
        emoji: "🏆",
      },
    ],
    [
      createMatchEvent({
        id: "event-red",
        name: "Registrace do aktivního výběru",
        matchType: "competitive",
        meetingStart: "2026-08-25T21:59:00.000Z",
        gameStart: "2026-08-25T21:59:00.000Z",
        gameEnd: "2026-08-25T22:04:00.000Z",
      }),
    ],
    [
      {
        id: "calendar-green",
        guildId: "guild-1",
        title: "VLK vs 57TH - Friendly",
        color: "#22c55e",
        emoji: "🤝",
        label: "Přátelský zápas",
        startAt: "2026-08-26T17:00:00.000Z",
        endAt: "2026-08-26T19:30:00.000Z",
        allDay: false,
        createdAt: "2026-07-29T10:00:00.000Z",
        updatedAt: "2026-07-29T10:00:00.000Z",
      } satisfies CalendarItem,
    ],
  );

  const json = embed.toJSON();
  assert.equal(json.title, "📅 Kalendář");
  assert.match(json.description ?? "", /\*\*Kategorie\*\*/);
  assert.match(json.description ?? "", /🟥 🏆 Kompetitivní zápas/);
  assert.match(json.description ?? "", /🟩 🤝 Přátelský zápas/);
  assert.match(json.description ?? "", /\*\*úterý 25\. srpna 2026\*\*/i);
  assert.match(json.description ?? "", /\*\*středa 26\. srpna 2026\*\*/i);
  assert.match(json.description ?? "", /🟥 \[Registrace do aktivního výběru\]\(https:\/\/calendar\.google\.com\/calendar\/render\?action=TEMPLATE/);
  assert.match(json.description ?? "", /🟩 VLK vs 57TH - Friendly <t:\d+:t> - <t:\d+:t>/);
});

test("buildCalendarPanelEmbed tolerates missing event categories", () => {
  const embed = buildCalendarPanelEmbed(
    config,
    undefined as unknown as EventCategory[],
    [
      createMatchEvent({
        id: "event-no-categories",
        name: "Fallback Match",
        meetingStart: "2026-08-25T21:59:00.000Z",
        gameStart: "2026-08-25T21:59:00.000Z",
        gameEnd: "2026-08-25T22:04:00.000Z",
      }),
    ],
    [],
  );

  const json = embed.toJSON();
  assert.equal(json.title, "📅 Kalendář");
  assert.match(json.description ?? "", /Fallback Match/);
});

test("buildEventEmbed uses plain display names instead of Discord mentions", () => {
  const embed = buildEventEmbed(
    config,
    groups,
    eventCategories,
    createMatchEvent({
      participants: [
        {
          userId: "user-1",
          status: "attending",
          updatedAt: "2026-07-29T10:00:00.000Z",
        },
        {
          userId: "user-2",
          status: "not_attending",
          updatedAt: "2026-07-29T10:00:00.000Z",
        },
      ],
    }),
    undefined,
    {
      "user-1": "Alpha Nick",
      "user-2": "Bravo Nick",
    },
  );

  const fields = embed.toJSON().fields ?? [];
  const combinedValues = fields.map((field) => field.value ?? "").join(" | ");
  assert.match(combinedValues, /Alpha Nick/);
  assert.match(combinedValues, /Bravo Nick/);
  assert.doesNotMatch(combinedValues, /<@/);
});

test("buildEventEmbed lays out match signup names in up to three left-to-right columns", () => {
  const embed = buildEventEmbed(
    config,
    groups,
    eventCategories,
    createMatchEvent({
      participants: [
        { userId: "user-1", status: "attending", group: "command", updatedAt: "2026-07-29T10:00:00.000Z" },
        { userId: "user-2", status: "attending", group: "command", updatedAt: "2026-07-29T10:00:00.000Z" },
        { userId: "user-3", status: "attending", group: "command", updatedAt: "2026-07-29T10:00:00.000Z" },
        { userId: "user-4", status: "attending", group: "command", updatedAt: "2026-07-29T10:00:00.000Z" },
        { userId: "user-5", status: "attending", group: "command", updatedAt: "2026-07-29T10:00:00.000Z" },
        { userId: "user-6", status: "attending", group: "command", updatedAt: "2026-07-29T10:00:00.000Z" },
        { userId: "user-7", status: "attending", group: "command", updatedAt: "2026-07-29T10:00:00.000Z" },
      ],
    }),
    undefined,
    {
      "user-1": "Alpha",
      "user-2": "Bravo",
      "user-3": "Charlie",
      "user-4": "Delta",
      "user-5": "Echo",
      "user-6": "Foxtrot",
      "user-7": "Golf",
    },
  );

  const fields = embed.toJSON().fields ?? [];
  assert.equal(fields[0]?.inline, true);
  assert.equal(fields[1]?.inline, true);
  assert.equal(fields[2]?.inline, true);
  assert.match(fields[0]?.name ?? "", /Command \(7\)/);
  assert.equal(fields[0]?.value, "Alpha\nDelta\nGolf");
  assert.equal(fields[1]?.value, "Bravo\nEcho");
  assert.equal(fields[2]?.value, "Charlie\nFoxtrot");
});

test("buildEventEmbed does not add blank fields between signup sections", () => {
  const embed = buildEventEmbed(
    config,
    groups,
    eventCategories,
    createMatchEvent({
      participants: [
        { userId: "user-1", status: "attending", group: "command", updatedAt: "2026-07-29T10:00:00.000Z" },
        { userId: "user-2", status: "attending", group: "inf", updatedAt: "2026-07-29T10:00:00.000Z" },
      ],
    }),
  );

  const fields = embed.toJSON().fields ?? [];
  assert.equal(fields.some((field) => field.name === "\u200B" && field.value === "\u200B"), false);
});
