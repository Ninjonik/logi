import assert from "node:assert/strict";
import test from "node:test";
import { buildMigrationException } from "./migration-exception-policy";

test("migration exceptions retain the exact record and reason for manual review", () => {
  const exception = buildMigrationException({ runId: "run-1", table: "events", recordId: "event-1", reason: "Invalid guild reference", now: new Date("2026-09-05T10:00:00.000Z") });
  assert.deepEqual(exception, { runId: "run-1", table: "events", recordId: "event-1", reason: "Invalid guild reference", now: new Date("2026-09-05T10:00:00.000Z"), createdAt: "2026-09-05T10:00:00.000Z" });
});
