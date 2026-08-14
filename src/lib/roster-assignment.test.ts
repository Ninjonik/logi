import assert from "node:assert/strict";
import test from "node:test";

import { autoFillRosterAssignments, type AutoFillWeights } from "./roster-assignment";

const weights: AutoFillWeights = { score: 1, kd: 1 };

test("autoFillRosterAssignments processes players first and keeps specialists near their signup preference", () => {
  const board = {
    id: "roster-1",
    squads: [
      {
        name: "Able",
        group: "Infantry",
        order: 0,
        color: "#fff",
        players: [
          { roleName: "Rifleman", roleIcon: "/rifle", ack: false, confirmed: false, note: "" },
        ],
      },
      {
        name: "Steel",
        group: "Armor",
        order: 1,
        color: "#000",
        players: [
          { roleName: "Tank Commander", roleIcon: "/tank", ack: false, confirmed: false, note: "" },
        ],
      },
      {
        name: "Guns",
        group: "Artillery",
        order: 2,
        color: "#333",
        players: [
          { roleName: "Artillery", roleIcon: "/arty", ack: false, confirmed: false, note: "" },
        ],
      },
    ],
    reservePlayerIds: ["tanker", "infantry"],
    notAttendingPlayerIds: [],
    published: false,
  };

  const context = {
    usersById: new Map([
      ["tanker", { discordId: "tanker", name: "Tanker", scores: {}, performance: { averages: { killDeathRatio: 1.5 } } }],
      ["infantry", { discordId: "infantry", name: "Infantry", scores: {}, performance: { averages: { killDeathRatio: 1.1 } } }],
    ]),
    assignmentsByUserId: new Map(),
    groupsById: new Map(),
    signupGroupByUserId: new Map([
      ["tanker", "armor"],
      ["infantry", "infantry"],
    ]),
    participantStatusByUserId: new Map(),
    serverDiscordId: "guild-1",
  };

  const next = autoFillRosterAssignments(board as never, context as never, weights);

  assert.equal(next.squads[0]?.players[0]?.id, "infantry");
  assert.equal(next.squads[1]?.players[0]?.id, "tanker");
  assert.equal(next.squads[2]?.players[0]?.id, undefined);
  assert.deepEqual(next.reservePlayerIds, []);
});

test("autoFillRosterAssignments uses weighted player ordering before slot selection", () => {
  const board = {
    id: "roster-1",
    squads: [
      {
        name: "Able",
        group: "Infantry",
        order: 0,
        color: "#fff",
        players: [
          { roleName: "Rifleman", roleIcon: "/rifle", ack: false, confirmed: false, note: "" },
        ],
      },
    ],
    reservePlayerIds: ["high-score", "high-kd"],
    notAttendingPlayerIds: [],
    published: false,
  };

  const usersById = new Map([
    ["high-score", { discordId: "high-score", name: "Alpha", scores: { "guild-1": 200 }, performance: { averages: { killDeathRatio: 1.0 } } }],
    ["high-kd", { discordId: "high-kd", name: "Bravo", scores: { "guild-1": 50 }, performance: { averages: { killDeathRatio: 3.0 } } }],
  ]);

  const context = {
    usersById,
    assignmentsByUserId: new Map(),
    groupsById: new Map(),
    signupGroupByUserId: new Map(),
    participantStatusByUserId: new Map(),
    serverDiscordId: "guild-1",
  };

  const scoreFirst = autoFillRosterAssignments(board as never, context as never, { score: 1, kd: 0 });
  assert.equal(scoreFirst.squads[0]?.players[0]?.id, "high-score");

  const kdFirst = autoFillRosterAssignments(board as never, context as never, { score: 0, kd: 1 });
  assert.equal(kdFirst.squads[0]?.players[0]?.id, "high-kd");
});
