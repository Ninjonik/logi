import assert from "node:assert/strict";
import test from "node:test";

import { assertLegacyHllScopeTable, legacyHllScopeTables } from "./legacy-scope-tables";

test("legacy HLL scope migration permits only explicitly classified game-scoped tables", () => {
  assert.deepEqual(legacyHllScopeTables, [
    "assignments", "groups", "events", "calendarItems", "topicPresets", "squadPresets", "stratmaps", "matchStats", "competitions",
  ]);
  assert.equal(assertLegacyHllScopeTable("events"), "events");
  assert.throws(() => assertLegacyHllScopeTable("users"), /Unsupported legacy HLL scope table/);
});
