import assert from "node:assert/strict";
import test from "node:test";

import { canAcceptSignups, deriveEventStatus, isTrainingRegistrationStillOpen } from "./status";

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
