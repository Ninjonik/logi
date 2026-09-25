import assert from "node:assert/strict";
import test from "node:test";
import { MigrateLegacyHllScopePageUseCase } from "./migrate-legacy-hll-scope-page.use-case";

test("page migration uses opaque cursors and patches only legacy records", async () => {
  const writes: string[] = [];
  const useCase = new MigrateLegacyHllScopePageUseCase({ listPage: async (cursor) => { assert.equal(cursor, "opaque"); return { records: [{ id: "a" }, { id: "b", gameId: "hell-let-loose" }], cursor: "next", isDone: false }; }, setGameId: async (id) => { writes.push(id); } });
  assert.deepEqual(await useCase.execute({ cursor: "opaque", limit: 10, dryRun: false }), { scanned: 2, updated: 1, cursor: "next", isDone: false });
  assert.deepEqual(writes, ["a"]);
});
