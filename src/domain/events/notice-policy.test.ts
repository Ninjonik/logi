import assert from "node:assert/strict";
import test from "node:test";

import { findEligibleNoticeTargets, upsertNotice } from "./notice-policy";

test("findEligibleNoticeTargets filters by notice window, attending status, query, and caps results", () => {
  const results = findEligibleNoticeTargets({
    events: [
      {
        id: "event-1",
        name: "Match Alpha",
        meetingStart: "2026-01-01T11:00:00.000Z",
        status: "starting",
        participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      },
      {
        id: "event-2",
        name: "Match Bravo",
        meetingStart: "2026-01-01T11:05:00.000Z",
        status: "starting",
        participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      },
      {
        id: "event-3",
        name: "Match Charlie",
        meetingStart: "2026-01-01T11:10:00.000Z",
        status: "starting",
        participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      },
      {
        id: "event-4",
        name: "Match Delta",
        meetingStart: "2026-01-01T11:15:00.000Z",
        status: "starting",
        participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      },
      {
        id: "event-5",
        name: "Match Echo",
        meetingStart: "2026-01-01T11:20:00.000Z",
        status: "starting",
        participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      },
      {
        id: "event-6",
        name: "Match Foxtrot",
        meetingStart: "2026-01-01T11:25:00.000Z",
        status: "starting",
        participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      },
      {
        id: "event-7",
        name: "Too Early",
        meetingStart: "2026-01-01T13:00:00.000Z",
        status: "registration",
        participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      },
      {
        id: "event-8",
        name: "Concluded Match",
        meetingStart: "2026-01-01T11:10:00.000Z",
        status: "concluded",
        participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      },
      {
        id: "event-9",
        name: "Declined Match",
        meetingStart: "2026-01-01T11:10:00.000Z",
        status: "starting",
        participants: [{ userId: "user-1", status: "not_attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      },
    ],
    userId: "user-1",
    query: "match",
    now: new Date("2026-01-01T10:30:00.000Z"),
  });

  assert.equal(results.length, 5);
  assert.deepEqual(results.map((event) => event.id), ["event-1", "event-2", "event-3", "event-4", "event-5"]);
});

test("upsertNotice replaces an existing notice for the same user and trims the reason", () => {
  const notices = upsertNotice({
    event: {
      meetingStart: "2026-01-01T11:00:00.000Z",
      status: "starting",
      participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      absenceNotices: [
        { userId: "user-1", reason: "Old", createdAt: "2026-01-01T10:10:00.000Z" },
        { userId: "user-2", reason: "Keep", createdAt: "2026-01-01T10:15:00.000Z" },
      ],
    },
    userId: "user-1",
    reason: "  New reason  ",
    now: new Date("2026-01-01T10:30:00.000Z"),
  });

  assert.deepEqual(notices, [
    { userId: "user-2", reason: "Keep", createdAt: "2026-01-01T10:15:00.000Z" },
    { userId: "user-1", reason: "New reason", createdAt: "2026-01-01T10:30:00.000Z" },
  ]);
});

test("upsertNotice rejects invalid time windows and non-attending users", () => {
  assert.throws(() => upsertNotice({
    event: {
      meetingStart: "2026-01-01T11:00:00.000Z",
      status: "starting",
      participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      absenceNotices: [],
    },
    userId: "user-1",
    reason: "Late",
    now: new Date("2026-01-01T09:30:00.000Z"),
  }), /final 60 minutes/);

  assert.throws(() => upsertNotice({
    event: {
      meetingStart: "2026-01-01T11:00:00.000Z",
      status: "concluded",
      participants: [{ userId: "user-1", status: "attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      absenceNotices: [],
    },
    userId: "user-1",
    reason: "Late",
    now: new Date("2026-01-01T10:30:00.000Z"),
  }), /already concluded/);

  assert.throws(() => upsertNotice({
    event: {
      meetingStart: "2026-01-01T11:00:00.000Z",
      status: "starting",
      participants: [{ userId: "user-1", status: "not_attending", updatedAt: "2026-01-01T08:00:00.000Z" }],
      absenceNotices: [],
    },
    userId: "user-1",
    reason: "Late",
    now: new Date("2026-01-01T10:30:00.000Z"),
  }), /Only attending players/);
});
