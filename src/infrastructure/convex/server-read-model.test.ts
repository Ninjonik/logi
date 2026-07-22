import assert from "node:assert/strict";
import test from "node:test";

import {
  canAccessServerContext,
  canAdminServerContext,
  normalizeAssignmentDoc,
  normalizeDoc,
  normalizeEventDoc,
  normalizeGuildDoc,
  normalizeUserDoc,
} from "./server-read-model";

test("canAccessServerContext allows direct guild members and dashboard access", () => {
  assert.equal(canAccessServerContext({
    user: {
      guildId: "guild-1",
      managedGuildIds: [],
      mercenaryGuildIds: [],
    },
    serverDiscordId: "guild-1",
  }), true);

  assert.equal(canAccessServerContext({
    user: {
      managedGuildIds: [],
      mercenaryGuildIds: [],
    },
    serverDiscordId: "guild-1",
    discordAccess: { hasDashboardAccess: true },
  }), true);
});

test("canAdminServerContext allows server admins and discord admins", () => {
  assert.equal(canAdminServerContext({
    serverAdminIds: ["user-1"],
    userId: "user-1",
  }), true);

  assert.equal(canAdminServerContext({
    serverAdminIds: [],
    userId: "user-2",
    discordAccess: { isAdmin: true },
  }), true);
});

test("normalizeAssignmentDoc resolves group names", () => {
  const normalized = normalizeAssignmentDoc({
    _id: "assignment-1",
    serverId: "guild-1",
    primaryGroupId: "group-1",
    secondaryGroupIds: ["group-2"],
  }, new Map([
    ["group-1", "Infantry"],
    ["group-2", "Armor"],
  ]));

  assert.equal(normalized.primaryGroup, "Infantry");
  assert.deepEqual(normalized.secondaryGroups, ["Armor"]);
});

test("normalizeDoc, normalizeGuildDoc, and normalizeUserDoc normalize identifiers and legacy platform ids", () => {
  assert.deepEqual(normalizeDoc({ _id: 123, value: "x" }), {
    _id: 123,
    value: "x",
    id: "123",
  });

  assert.deepEqual(normalizeGuildDoc({
    _id: "guild-1",
    discordId: "discord-1",
    name: "Guild",
  }), {
    _id: "guild-1",
    discordId: "discord-1",
    name: "Guild",
    id: "guild-1",
  });

  const user = normalizeUserDoc({
    _id: "user-1",
    id: "legacy-user",
    platformId: " steam-1 , steam-2 ",
    platformIds: ["steam-2", " steam-3 "],
    score: 5,
  });

  assert.equal(user.discordId, "legacy-user");
  assert.deepEqual(user.platformIds, ["steam-2", "steam-3"]);
  assert.deepEqual(user.scores, {});
});

test("normalizeEventDoc normalizes participants, ids, and optional match references", () => {
  const normalized = normalizeEventDoc({
    _id: "event-1",
    registrationEnd: "2026-07-21T10:00:00.000Z",
    meetingStart: "2026-07-21T11:00:00.000Z",
    gameEnd: "2026-07-21T14:00:00.000Z",
    signUps: [{ userId: "user-1", group: "INF" }, { userId: "user-2", group: null }],
    matchStatsId: 99,
    createdAt: "2026-07-21T08:00:00.000Z",
  });

  assert.equal(normalized.id, "event-1");
  assert.equal(normalized.matchStatsId, "99");
  assert.equal(normalized.matchId, "99");
  assert.deepEqual(normalized.participants, [
    { userId: "user-1", status: "attending", group: "INF", updatedAt: "2026-07-21T08:00:00.000Z" },
    { userId: "user-2", status: "not_attending", group: null, updatedAt: "2026-07-21T08:00:00.000Z" },
  ]);
});

test("canAccessServerContext and canAdminServerContext reject users without access", () => {
  assert.equal(canAccessServerContext({
    user: {
      guildId: "guild-2",
      managedGuildIds: [],
      mercenaryGuildIds: [],
    },
    serverDiscordId: "guild-1",
    discordAccess: { hasDashboardAccess: false },
  }), false);

  assert.equal(canAdminServerContext({
    serverAdminIds: [],
    userId: "user-1",
    discordAccess: { isAdmin: false },
  }), false);
});
