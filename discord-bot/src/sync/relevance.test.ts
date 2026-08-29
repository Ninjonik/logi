import assert from "node:assert/strict";
import test from "node:test";
import { isHistoricalConcludedEvent } from "./relevance";

const now = new Date("2026-08-29T12:00:00.000Z");
test("historical concluded events are excluded after seven days", () => {
  assert.equal(isHistoricalConcludedEvent({ status: "concluded", gameEnd: "2026-08-22T11:59:59.000Z" }, now), true);
  assert.equal(isHistoricalConcludedEvent({ status: "concluded", gameEnd: "2026-08-22T12:00:00.000Z" }, now), false);
  assert.equal(isHistoricalConcludedEvent({ status: "registration", gameEnd: "2026-01-01T00:00:00.000Z" }, now), false);
});
