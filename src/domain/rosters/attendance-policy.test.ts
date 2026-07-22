import assert from "node:assert/strict";
import test from "node:test";

import { acknowledgeRosterAttendance, setRosterAttendanceStatus } from "./attendance-policy";

test("setRosterAttendanceStatus updates squad players", () => {
  const roster = {
    squads: [{
      name: "Able",
      group: "INF",
      order: 1,
      color: "#fff",
      players: [{ id: "user-1", ack: false, confirmed: false }],
    }],
    reservePlayerIds: [],
    reserveAttendances: [],
    notAttendingPlayerIds: [],
    published: false,
  };

  const updated = setRosterAttendanceStatus(roster, "user-1", "confirmed");

  assert.deepEqual(updated.squads[0]?.players[0], { id: "user-1", ack: true, confirmed: true });
});

test("acknowledgeRosterAttendance creates a reserve attendance entry when missing", () => {
  const roster = {
    squads: [],
    reservePlayerIds: ["user-1"],
    reserveAttendances: [],
    notAttendingPlayerIds: [],
    published: false,
  };

  const updated = acknowledgeRosterAttendance(roster, "user-1");

  assert.deepEqual(updated.reserveAttendances, [{ userId: "user-1", ack: true, confirmed: false }]);
});

test("setRosterAttendanceStatus can reset attendance back to pending", () => {
  const roster = {
    squads: [],
    reservePlayerIds: ["user-1"],
    reserveAttendances: [{ userId: "user-1", ack: true, confirmed: true }],
    notAttendingPlayerIds: [],
    published: false,
  };

  const updated = setRosterAttendanceStatus(roster, "user-1", "pending");

  assert.deepEqual(updated.reserveAttendances, [{ userId: "user-1", ack: false, confirmed: false }]);
});

test("setRosterAttendanceStatus rejects users not present on the roster", () => {
  assert.throws(() => setRosterAttendanceStatus({
    squads: [],
    reservePlayerIds: [],
    reserveAttendances: [],
    notAttendingPlayerIds: [],
    published: false,
  }, "user-404", "confirmed"), /User is not on the roster/);
});
