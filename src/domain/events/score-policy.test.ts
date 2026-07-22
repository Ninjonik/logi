import assert from "node:assert/strict";
import test from "node:test";

import { resolveRosterScoreDelta, type RosterScoreSettings } from "./score-policy";

const settings: RosterScoreSettings = {
  noCategory: 0,
  declined: 1,
  rosterPresent: 5,
  reservePresent: 3,
  rosterAbsent: -2,
  reserveAbsent: -1,
  excusedAbsence: 2,
};

test("resolveRosterScoreDelta returns declined score for explicit decline", () => {
  assert.equal(resolveRosterScoreDelta({
    userId: "user-1",
    settings,
    participants: [{ userId: "user-1", status: "not_attending" }],
    notices: [],
    roster: null,
  }), 1);
});

test("resolveRosterScoreDelta returns confirmed roster score for rostered confirmed attendee", () => {
  assert.equal(resolveRosterScoreDelta({
    userId: "user-1",
    settings,
    participants: [{ userId: "user-1", status: "attending" }],
    notices: [],
    roster: {
      squads: [{ players: [{ id: "user-1", confirmed: true }] }],
      reservePlayerIds: [],
      reserveAttendances: [],
    },
  }), 5);
});

test("resolveRosterScoreDelta returns excused absence score before absence penalties", () => {
  assert.equal(resolveRosterScoreDelta({
    userId: "user-1",
    settings,
    participants: [{ userId: "user-1", status: "attending" }],
    notices: [{ userId: "user-1" }],
    roster: {
      squads: [{ players: [{ id: "user-1", confirmed: false }] }],
      reservePlayerIds: [],
      reserveAttendances: [],
    },
  }), 2);
});

test("resolveRosterScoreDelta returns reserve absence score for unconfirmed reserve attendee", () => {
  assert.equal(resolveRosterScoreDelta({
    userId: "user-1",
    settings,
    participants: [{ userId: "user-1", status: "attending" }],
    notices: [],
    roster: {
      squads: [{ players: [] }],
      reservePlayerIds: ["user-1"],
      reserveAttendances: [{ userId: "user-1", confirmed: false }],
    },
  }), -1);
});
