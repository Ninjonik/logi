import assert from "node:assert/strict";
import test from "node:test";

import { beginMigrationRun, completeMigrationRun, recordMigrationBatch } from "./migration-run-policy";

test("migration run policy accumulates batch counts and completes only after exceptions are recorded", () => {
  const started = beginMigrationRun("legacy-hll-game-scope", new Date("2026-09-05T10:00:00.000Z"));
  const progressed = recordMigrationBatch(started, { scanned: 20, updated: 15, exceptions: 1, cursor: "events:20" });
  const completed = completeMigrationRun(progressed, new Date("2026-09-05T10:01:00.000Z"));

  assert.deepEqual(completed, {
    name: "legacy-hll-game-scope",
    status: "completed",
    scanned: 20,
    updated: 15,
    exceptions: 1,
    cursor: "events:20",
    startedAt: "2026-09-05T10:00:00.000Z",
    completedAt: "2026-09-05T10:01:00.000Z",
  });
});
