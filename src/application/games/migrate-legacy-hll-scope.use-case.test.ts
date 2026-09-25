import assert from "node:assert/strict";
import test from "node:test";

import { MigrateLegacyHllScopeUseCase } from "./migrate-legacy-hll-scope.use-case";

test("legacy HLL scope migration dry run reports a bounded batch without writes", async () => {
  const patched: string[] = [];
  const useCase = new MigrateLegacyHllScopeUseCase({
    list: async () => [{ id: "a" }, { id: "b", gameId: "hell-let-loose" }, { id: "c" }],
    setGameId: async (id) => { patched.push(id); },
  });

  const result = await useCase.execute({ cursor: 0, limit: 1, dryRun: true });

  assert.deepEqual(result, { scanned: 1, updated: 1, cursor: 1, isDone: false });
  assert.deepEqual(patched, []);
});

test("legacy HLL scope migration writes only unscoped records", async () => {
  const patched: string[] = [];
  const useCase = new MigrateLegacyHllScopeUseCase({
    list: async () => [{ id: "a" }, { id: "b", gameId: "hell-let-loose" }, { id: "c" }],
    setGameId: async (id) => { patched.push(id); },
  });

  const result = await useCase.execute({ cursor: 0, limit: 2, dryRun: false });

  assert.deepEqual(result, { scanned: 3, updated: 2, cursor: null, isDone: true });
  assert.deepEqual(patched, ["a", "c"]);
});
