import assert from "node:assert/strict";
import test from "node:test";

import { mergeRosterWithEventState } from "./sync";

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
