import assert from "node:assert/strict";
import test from "node:test";

import { selectUnscopedMigrationBatch } from "./migration-batch-policy";

test("migration batch selector returns a bounded page and a resumable cursor", () => {
  const result = selectUnscopedMigrationBatch({
    records: [
      { id: "a" },
      { id: "b", gameId: "hell-let-loose" },
      { id: "c" },
      { id: "d" },
    ],
    cursor: 0,
    limit: 2,
  });

  assert.deepEqual(result, { ids: ["a", "c"], nextCursor: 3, isDone: false });
});

test("migration batch selector finishes after scanning the final page", () => {
  assert.deepEqual(selectUnscopedMigrationBatch({
    records: [{ id: "a" }, { id: "b" }],
    cursor: 1,
    limit: 10,
  }), { ids: ["b"], nextCursor: null, isDone: true });
});
