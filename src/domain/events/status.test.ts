import assert from "node:assert/strict";
import test from "node:test";

import {
  canAcceptSignups,
  deriveEventStatus,
  isEventCancelledBeforeMeeting,
  isTrainingRegistrationStillOpen,
  normalizeEventTimestamps,
  resolveCreateForumChannel,
} from "./status";

test("deriveEventStatus returns registration before registration ends", () => {
  assert.equal(deriveEventStatus({
    registrationEnd: "2026-01-01T10:00:00.000Z",
    meetingStart: "2026-01-01T12:00:00.000Z",
    gameEnd: "2026-01-01T14:00:00.000Z",
  }, new Date("2026-01-01T09:00:00.000Z")), "registration");
});

test("deriveEventStatus returns starting in meeting countdown window", () => {
  assert.equal(deriveEventStatus({
    registrationEnd: "2026-01-01T10:00:00.000Z",
    meetingStart: "2026-01-01T12:00:00.000Z",
    gameEnd: "2026-01-01T14:00:00.000Z",
  }, new Date("2026-01-01T11:00:00.000Z")), "starting");
});

test("training registration can stay open after starting", () => {
  const event = {
    kind: "training" as const,
    registrationEnd: "2026-01-01T12:00:00.000Z",
    status: "starting" as const,
  };

  assert.equal(isTrainingRegistrationStillOpen(event, new Date("2026-01-01T11:30:00.000Z")), true);
  assert.equal(canAcceptSignups(event, new Date("2026-01-01T11:30:00.000Z")), true);
});

test("deriveEventStatus returns closed after registration ends but before the starting window", () => {
  assert.equal(deriveEventStatus({
    registrationEnd: "2026-01-01T10:00:00.000Z",
    meetingStart: "2026-01-03T12:00:00.000Z",
    gameEnd: "2026-01-03T14:00:00.000Z",
  }, new Date("2026-01-01T10:30:00.000Z")), "closed");
});

test("deriveEventStatus returns concluded at game end and preserves explicit concluded state", () => {
  assert.equal(deriveEventStatus({
    registrationEnd: "2026-01-01T10:00:00.000Z",
    meetingStart: "2026-01-01T12:00:00.000Z",
    gameEnd: "2026-01-01T14:00:00.000Z",
  }, new Date("2026-01-01T14:00:00.000Z")), "concluded");

  assert.equal(deriveEventStatus({
    registrationEnd: "2026-01-01T10:00:00.000Z",
    meetingStart: "2026-01-04T12:00:00.000Z",
    gameEnd: "2026-01-04T14:00:00.000Z",
    status: "concluded",
  }, new Date("2026-01-01T09:00:00.000Z")), "concluded");
});

test("resolveCreateForumChannel defaults to matches and honors explicit overrides", () => {
  assert.equal(resolveCreateForumChannel({ kind: "match" }), true);
  assert.equal(resolveCreateForumChannel({ kind: "training" }), false);
  assert.equal(resolveCreateForumChannel({ kind: "training", createForumChannel: true }), true);
});

test("isEventCancelledBeforeMeeting compares concludedAt against meetingStart", () => {
  assert.equal(isEventCancelledBeforeMeeting({
    concludedAt: "2026-01-01T10:00:00.000Z",
    meetingStart: "2026-01-01T11:00:00.000Z",
  }), true);

  assert.equal(isEventCancelledBeforeMeeting({
    concludedAt: "2026-01-01T11:30:00.000Z",
    meetingStart: "2026-01-01T11:00:00.000Z",
  }), false);
});

test("normalizeEventTimestamps falls back to available event timestamps", () => {
  assert.deepEqual(normalizeEventTimestamps({
    registrationEnd: "2026-01-01T07:00:00.000Z",
    meetingStart: "2026-01-01T08:00:00.000Z",
    gameEnd: "2026-01-01T09:00:00.000Z",
    createdAt: "2026-01-01T08:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
  }, "2026-01-01T10:00:00.000Z"), {
    statusUpdatedAt: "2026-01-01T09:00:00.000Z",
    updatedAt: "2026-01-01T09:00:00.000Z",
  });
});
