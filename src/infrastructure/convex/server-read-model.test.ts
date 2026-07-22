import assert from "node:assert/strict";
import test from "node:test";

import { canAccessServerContext, canAdminServerContext, normalizeAssignmentDoc } from "./server-read-model";

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
