import assert from "node:assert/strict";
import test from "node:test";

import { getCalendarSyncVersion, shouldRefreshCalendar, shouldSyncEventRoles } from "./work";

test("signup-only changes do not refresh calendar or event roles", () => {
  const before = { name: "Match", matchType: "friendly", meetingStart: "2099-01-01T19:00:00.000Z", gameStart: "2099-01-01T20:00:00.000Z", gameEnd: "2099-01-01T21:30:00.000Z", status: "registration", signUps: [] };
  const after = { ...before, signUps: [{ userId: "user-1" }] };
  assert.equal(shouldRefreshCalendar(before, after), false);
  assert.equal(shouldSyncEventRoles(before, after), false);
});

test("displayed schedule changes refresh calendar and roster changes refresh event roles", () => {
  const before = { name: "Match", matchType: "friendly", meetingStart: "2099-01-01T19:00:00.000Z", gameStart: "2099-01-01T20:00:00.000Z", gameEnd: "2099-01-01T21:30:00.000Z", status: "registration" };
  assert.equal(shouldRefreshCalendar(before, { ...before, name: "Renamed" }), true);
  assert.equal(shouldRefreshCalendar(before, { ...before, gameStart: "2099-01-01T20:30:00.000Z" }), true);
  assert.equal(shouldSyncEventRoles(before, { ...before, status: "concluded" }), true);
  assert.notEqual(getCalendarSyncVersion(before), getCalendarSyncVersion({ ...before, name: "Renamed" }));
});
