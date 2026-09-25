import assert from "node:assert/strict";
import test from "node:test";

import type { GameDefinition } from "./game-definition";
import { createGameRegistry } from "./game-registry";

const hll: GameDefinition = {
  id: "hell-let-loose",
  displayName: "Hell Let Loose",
  membership: {
    statuses: [
      { key: "member", label: "Member", canAppearInRoster: true, canSignUpForMatches: true },
    ],
  },
};

test("game registry resolves a registered game by its stable ID", () => {
  const registry = createGameRegistry([hll]);

  assert.equal(registry.get("hell-let-loose"), hll);
  assert.deepEqual(registry.list(), [hll]);
});

test("game registry rejects unknown and duplicate game IDs", () => {
  const registry = createGameRegistry([hll]);

  assert.throws(() => registry.require("wardogs"), /Unsupported game: wardogs/);
  assert.throws(() => createGameRegistry([hll, hll]), /Duplicate game ID: hell-let-loose/);
});
