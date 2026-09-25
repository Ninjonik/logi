import assert from "node:assert/strict";
import test from "node:test";

import { gameRegistry } from "./registry";

test("application game registry starts with Hell Let Loose as its only supported game", () => {
  assert.deepEqual(gameRegistry.list().map(({ id, displayName }) => ({ id, displayName })), [
    { id: "hell-let-loose", displayName: "Hell Let Loose" },
  ]);
});
