import assert from "node:assert/strict";
import test from "node:test";

import { buildServerMembershipState, buildUserMembershipState } from "./membership-state";

test("current clan membership derivation includes recruits and reserve members but excludes pending applicants", () => {
  const state = buildServerMembershipState({
    assignments: [
      { userId: "recruit", serverId: "guild", type: "member", status: "recruit", createdAt: "2026-01-01T00:00:00.000Z" },
      { userId: "reserve", serverId: "guild", type: "reserve_member", status: "active", createdAt: "2026-01-02T00:00:00.000Z" },
      { userId: "pending", serverId: "guild", type: "member", status: "pending", createdAt: "2026-01-03T00:00:00.000Z" },
      { userId: "merc", serverId: "guild", type: "mercenary", status: "active", createdAt: "2026-01-04T00:00:00.000Z" },
    ],
    groupNameById: new Map(),
  });

  assert.deepEqual(state.memberIds, ["recruit", "reserve"]);
  assert.deepEqual(state.members.map((member) => ({ id: member.id, status: member.status })), [
    { id: "recruit", status: "recruit" },
    { id: "reserve", status: "reserve_member" },
  ]);
  assert.deepEqual(state.mercenaryIds, ["merc"]);
});

test("current user membership derivation chooses a clan membership and separately tracks active mercenary clans", () => {
  const state = buildUserMembershipState({
    assignments: [
      { userId: "user", serverId: "pending-clan", type: "member", status: "pending", createdAt: "2026-01-01T00:00:00.000Z" },
      { userId: "user", serverId: "member-clan", type: "member", status: "active", createdAt: "2026-01-02T00:00:00.000Z" },
      { userId: "user", serverId: "merc-clan", type: "mercenary", status: "active", createdAt: "2026-01-03T00:00:00.000Z" },
    ],
  });

  assert.equal(state.guildId, "member-clan");
  assert.deepEqual(state.mercenaryGuildIds, ["merc-clan"]);
});
