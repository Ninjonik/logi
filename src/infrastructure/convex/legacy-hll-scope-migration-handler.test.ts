import assert from "node:assert/strict";
import test from "node:test";
import { handleLegacyHllScopeMigration } from "./legacy-hll-scope-migration-handler";

test("legacy HLL scope migration handler authenticates, validates target, and bounds batches", async () => {
  const calls: unknown[] = [];
  const result = await handleLegacyHllScopeMigration({ secret: "ok", expectedSecret: "ok", table: "events", cursor: 0, limit: 20, dryRun: true, execute: async (input) => { calls.push(input); return { scanned: 1 }; } });
  assert.deepEqual(result, { scanned: 1 });
  assert.deepEqual(calls, [{ cursor: 0, limit: 20, dryRun: true }]);
  await assert.rejects(() => handleLegacyHllScopeMigration({ secret: "bad", expectedSecret: "ok", table: "events", cursor: 0, limit: 20, dryRun: true, execute: async () => ({}) }), /Unauthorized/);
  await assert.rejects(() => handleLegacyHllScopeMigration({ secret: "ok", expectedSecret: "ok", table: "users", cursor: 0, limit: 20, dryRun: true, execute: async () => ({}) }), /Unsupported legacy HLL scope table/);
  await assert.rejects(() => handleLegacyHllScopeMigration({ secret: "ok", expectedSecret: "ok", table: "events", cursor: 0, limit: 101, dryRun: true, execute: async () => ({}) }), /limit/);
});
