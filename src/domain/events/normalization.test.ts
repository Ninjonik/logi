import assert from "node:assert/strict";
import test from "node:test";

import { normalizeEventRecord } from "./normalization";

test("normalizeEventRecord derives current status instead of trusting stale stored status", () => {
  const normalized = normalizeEventRecord({
    registrationEnd: "2026-08-12T17:50:00.000Z",
    meetingStart: "2026-08-12T17:51:00.000Z",
    gameEnd: "2026-08-12T19:00:00.000Z",
    status: "registration",
  }, new Date("2026-08-12T17:52:00.000Z"));

  assert.equal(normalized.status, "starting");
});
