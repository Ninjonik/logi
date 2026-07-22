import assert from "node:assert/strict";
import test from "node:test";

import { toggleSignup } from "./signup-policy";

test("toggleSignup adds an attending participant", () => {
  const result = toggleSignup({
    participants: [],
    event: {
      kind: "match",
      registrationEnd: "2026-01-01T10:00:00.000Z",
      status: "registration",
    },
    userId: "user-1",
    group: "INF",
    now: new Date("2026-01-01T09:00:00.000Z"),
  });

  assert.equal(result.participants.length, 1);
  assert.equal(result.participants[0]?.status, "attending");
  assert.equal(result.signUps[0]?.group, "INF");
});

test("toggleSignup removes an unchanged signup on second click", () => {
  const now = new Date("2026-01-01T09:00:00.000Z");
  const first = toggleSignup({
    participants: [],
    event: {
      kind: "match",
      registrationEnd: "2026-01-01T10:00:00.000Z",
      status: "registration",
    },
    userId: "user-1",
    group: "INF",
    now,
  });

  const second = toggleSignup({
    participants: first.participants,
    event: {
      kind: "match",
      registrationEnd: "2026-01-01T10:00:00.000Z",
      status: "registration",
    },
    userId: "user-1",
    group: "INF",
    now,
  });

  assert.equal(second.participants.length, 0);
});
