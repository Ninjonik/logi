import assert from "node:assert/strict";
import test from "node:test";
import { deriveDivisionStandings } from "./standings";

test("ECL standings award each side its cap score and rank regular wins", () => {
  const rows = deriveDivisionStandings([{ id: "a", name: "A" }, { id: "b", name: "B" }], [{ id: "1", divisionId: "d", teamAId: "a", teamBId: "b", scoreA: 5, scoreB: 0, status: "final" }]);
  assert.deepEqual(rows.map(({ teamId, capScore, regularWins, totalMatches }) => ({ teamId, capScore, regularWins, totalMatches })), [{ teamId: "a", capScore: 5, regularWins: 1, totalMatches: 1 }, { teamId: "b", capScore: 0, regularWins: 0, totalMatches: 1 }]);
});
