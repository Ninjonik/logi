import assert from "node:assert/strict";
import test from "node:test";

import type { Roster } from "@/types/domain";

import { summarizeRosterUpdates } from "./roster-update-summary";

function createRoster(players: Array<{ id?: string; roleName?: string }>): Roster {
  return {
    id: "roster-1",
    eventId: "event-1",
    guildId: "guild-1",
    squads: [{
      name: "Able",
      group: "Infantry",
      order: 0,
      color: "#ffffff",
      players: players.map((player) => ({ ...player, ack: false })),
    }],
    reservePlayerIds: [],
    notAttendingPlayerIds: [],
    published: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  };
}

test("summarizeRosterUpdates identifies a newly assigned player as a DM recipient", () => {
  const summary = summarizeRosterUpdates(
    createRoster([]),
    createRoster([{ id: "player-1", roleName: "Squad Lead" }]),
    [{ discordId: "player-1", name: "Player One" } as never],
  );

  assert.equal(summary.hasChanges, true);
  assert.deepEqual(summary.addedUserIds, ["player-1"]);
  assert.match(summary.addedLines[0]!, /Player One/);
});
