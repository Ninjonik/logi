import assert from "node:assert/strict";
import test from "node:test";

import { mapLegacyHllMembershipStatus } from "./legacy-membership";

test("legacy HLL assignment type/status pairs map to one stable game membership status key", () => {
  assert.equal(mapLegacyHllMembershipStatus({ type: "member", status: "pending" }), "pending");
  assert.equal(mapLegacyHllMembershipStatus({ type: "member", status: "recruit" }), "recruit");
  assert.equal(mapLegacyHllMembershipStatus({ type: "member", status: "active" }), "member");
  assert.equal(mapLegacyHllMembershipStatus({ type: "reserve_member", status: "active" }), "reserve_member");
  assert.equal(mapLegacyHllMembershipStatus({ type: "mercenary", status: "active" }), "mercenary");
});

test("legacy HLL pending and recruit states take precedence over historical assignment type", () => {
  assert.equal(mapLegacyHllMembershipStatus({ type: "mercenary", status: "pending" }), "pending");
  assert.equal(mapLegacyHllMembershipStatus({ type: "reserve_member", status: "recruit" }), "recruit");
});
