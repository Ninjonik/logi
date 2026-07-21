import assert from "node:assert/strict";
import test from "node:test";

import { isSignupOpen, resolveMembershipRoleIds } from "./rules";

function withNow<T>(iso: string, run: () => T) {
  const originalNow = Date.now;
  Date.now = () => new Date(iso).getTime();
  try {
    return run();
  } finally {
    Date.now = originalNow;
  }
}

test("isSignupOpen allows registration events", () => {
  assert.equal(isSignupOpen({
    kind: "match",
    registrationEnd: "2026-01-01T00:00:00.000Z",
    status: "registration",
  }), true);
});

test("isSignupOpen allows training in starting state until registration end", () => {
  withNow("2026-01-01T10:00:00.000Z", () => {
    assert.equal(isSignupOpen({
      kind: "training",
      registrationEnd: "2026-01-01T11:00:00.000Z",
      status: "starting",
    }), true);
  });
});

test("isSignupOpen rejects matches outside registration and expired training starts", () => {
  withNow("2026-01-01T12:00:00.000Z", () => {
    assert.equal(isSignupOpen({
      kind: "match",
      registrationEnd: "2026-01-01T13:00:00.000Z",
      status: "starting",
    }), false);

    assert.equal(isSignupOpen({
      kind: "training",
      registrationEnd: "2026-01-01T11:00:00.000Z",
      status: "starting",
    }), false);
  });
});

test("resolveMembershipRoleIds maps statuses to configured roles", () => {
  const config = {
    clanRoleId: "clan",
    membershipSettings: {
      categories: [{
        id: "infantry",
        supportRoleIds: [],
        recruitRoleId: "recruit",
        finalRoleId: "member",
        modalQuestions: [],
        assignmentType: "member" as const,
      }],
    },
  };

  assert.deepEqual(resolveMembershipRoleIds(config, "member", "pending", "infantry"), []);
  assert.deepEqual(resolveMembershipRoleIds(config, "member", "recruit", "infantry"), ["clan", "recruit"]);
  assert.deepEqual(resolveMembershipRoleIds(config, "member", "active", "infantry"), ["clan", "member"]);
});

test("resolveMembershipRoleIds tolerates missing category roles", () => {
  assert.deepEqual(resolveMembershipRoleIds({
    membershipSettings: {
      categories: [],
    },
  }, "mercenary", "active", "missing"), []);
});
