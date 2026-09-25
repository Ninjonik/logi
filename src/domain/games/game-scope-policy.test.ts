import assert from "node:assert/strict";
import test from "node:test";

import { assertGroupsAreAvailableToGameMembership, isGameScopedRecordVisible } from "./game-scope-policy";

test("game-scoped records are visible only in their selected game while global records remain visible", () => {
  assert.equal(isGameScopedRecordVisible({ gameId: "hell-let-loose" }, "hell-let-loose"), true);
  assert.equal(isGameScopedRecordVisible({ gameId: "hell-let-loose" }, "wardogs"), false);
  assert.equal(isGameScopedRecordVisible({}, "wardogs"), true);
});

test("memberships may use global groups or groups from their own game only", () => {
  assert.doesNotThrow(() => assertGroupsAreAvailableToGameMembership({
    gameId: "hell-let-loose",
    groupIds: ["global", "hll"],
    groupsById: new Map([
      ["global", { scope: "global" }],
      ["hll", { scope: "game", gameId: "hell-let-loose" }],
    ]),
  }));

  assert.throws(() => assertGroupsAreAvailableToGameMembership({
    gameId: "hell-let-loose",
    groupIds: ["wardogs"],
    groupsById: new Map([["wardogs", { scope: "game", gameId: "wardogs" }]]),
  }), /does not belong to game hell-let-loose/);
});
