import assert from "node:assert/strict";
import test from "node:test";

import { buildLegacyHllScopePlan } from "./legacy-scope-plan";

test("legacy HLL scope plan enables HLL once per clan and updates only unscoped records", () => {
  const plan = buildLegacyHllScopePlan({
    guildIds: ["guild-a", "guild-a", "guild-b"],
    records: {
      assignments: [{ id: "assignment-1" }, { id: "assignment-2", gameId: "hell-let-loose" }],
      groups: [{ id: "group-1" }],
      events: [{ id: "event-1" }],
      calendarItems: [{ id: "calendar-1" }],
      topicPresets: [{ id: "topic-1" }],
      squadPresets: [{ id: "squad-1" }],
      stratmaps: [{ id: "stratmap-1" }],
      matchStats: [{ id: "stats-1" }],
      competitions: [{ id: "competition-1" }],
    },
  });

  assert.deepEqual(plan.enableGuildIds, ["guild-a", "guild-b"]);
  assert.deepEqual(plan.recordIdsByTable, {
    assignments: ["assignment-1"],
    groups: ["group-1"],
    events: ["event-1"],
    calendarItems: ["calendar-1"],
    topicPresets: ["topic-1"],
    squadPresets: ["squad-1"],
    stratmaps: ["stratmap-1"],
    matchStats: ["stats-1"],
    competitions: ["competition-1"],
  });
});
