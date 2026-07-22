import assert from "node:assert/strict";
import test from "node:test";

import { buildEventSignatureMap, buildGuildPayload, getChangedEventIds } from "./payload-builder";

test("buildGuildPayload folds contexts into a guild payload", () => {
  const payload = buildGuildPayload(
    {
      guild: { id: "guild-1" },
      config: { guildId: "guild-1" },
      groups: [{ id: "group-1" }],
      squadPresets: [],
      topicPresets: [{ id: "topic-1" }],
    },
    [
      {
        event: { id: "event-1" },
        roster: { eventId: "event-1" },
        syncState: { eventId: "event-1" },
      },
    ],
  );

  assert.equal(payload.events.length, 1);
  assert.equal(payload.rosters.length, 1);
  assert.equal(payload.syncStates.length, 1);
});

test("buildEventSignatureMap and getChangedEventIds detect event changes", () => {
  const previous = new Map<string, string>([["event-1", "v1|r1"]]);
  const next = buildEventSignatureMap({
    events: [{ id: "event-1", updatedAt: "v2" }],
    rosters: [{ eventId: "event-1", updatedAt: "r1" }],
  }).signatures;

  assert.deepEqual(getChangedEventIds(next, previous, false), ["event-1"]);
});
