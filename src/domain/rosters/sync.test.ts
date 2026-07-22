import assert from "node:assert/strict";
import test from "node:test";

import { mergeRosterWithEventState, syncRosterMembershipForUser } from "./sync";

test("mergeRosterWithEventState adds tracked users to reserve or not attending buckets", () => {
  const roster = {
    squads: [],
    reservePlayerIds: [],
    reserveAttendances: [],
    notAttendingPlayerIds: [],
    published: false,
  };

  const merged = mergeRosterWithEventState(roster, {
    guildId: "guild-1",
    registrationEnd: "2026-01-01T12:00:00.000Z",
    participants: [
      { userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" },
      { userId: "user-2", status: "not_attending", updatedAt: "2026-01-01T08:00:00.000Z" },
    ],
  }, [], new Date("2026-01-01T09:00:00.000Z"));

  assert.deepEqual(merged.reservePlayerIds, ["user-1"]);
  assert.deepEqual(merged.notAttendingPlayerIds, ["user-2"]);
});

test("mergeRosterWithEventState removes users who are no longer tracked and prunes reserve attendance", () => {
  const roster = {
    squads: [{
      name: "Able",
      group: "INF",
      order: 1,
      color: "#fff",
      players: [{ id: "user-3", ack: true, confirmed: true }],
    }],
    reservePlayerIds: ["user-1"],
    reserveAttendances: [{ userId: "user-1", ack: true, confirmed: true }],
    notAttendingPlayerIds: ["user-2"],
    published: true,
  };

  const merged = mergeRosterWithEventState(roster, {
    guildId: "guild-1",
    registrationEnd: "2026-01-01T12:00:00.000Z",
    participants: [],
    updatedAt: "2026-01-01T08:00:00.000Z",
  }, [], new Date("2026-01-01T09:00:00.000Z"));

  assert.deepEqual(merged.reservePlayerIds, []);
  assert.deepEqual(merged.reserveAttendances, []);
  assert.deepEqual(merged.notAttendingPlayerIds, []);
  assert.deepEqual(merged.squads[0]?.players[0], { id: undefined, customName: undefined, ack: false, confirmed: false });
});

test("syncRosterMembershipForUser moves a user between reserve, not attending, and removed states", () => {
  const roster = {
    squads: [],
    reservePlayerIds: ["user-1"],
    reserveAttendances: [{ userId: "user-1", ack: true, confirmed: false }],
    notAttendingPlayerIds: [],
    published: false,
  };

  const declined = syncRosterMembershipForUser(roster, {
    guildId: "guild-1",
    registrationEnd: "2026-01-01T12:00:00.000Z",
    participants: [{ userId: "user-1", status: "not_attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
    updatedAt: "2026-01-01T08:00:00.000Z",
  }, [], "user-1", new Date("2026-01-01T09:00:00.000Z"));

  assert.deepEqual(declined.reservePlayerIds, []);
  assert.deepEqual(declined.reserveAttendances, []);
  assert.deepEqual(declined.notAttendingPlayerIds, ["user-1"]);

  const removed = syncRosterMembershipForUser(declined, {
    guildId: "guild-1",
    registrationEnd: "2026-01-01T12:00:00.000Z",
    participants: [],
    updatedAt: "2026-01-01T08:00:00.000Z",
  }, [], "user-1", new Date("2026-01-01T09:00:00.000Z"));

  assert.deepEqual(removed.reservePlayerIds, []);
  assert.deepEqual(removed.notAttendingPlayerIds, []);
});
