import test from "node:test";
import assert from "node:assert/strict";

import { detectPlatformFromStatsId, extractPlayerSearchResults } from "./player-search";

test("extractPlayerSearchResults reads players from stats search payload", () => {
  const payload = {
    result: {
      total: 1,
      players: [
        {
          player_id: "ssss",
          names: [{ name: "ssss" }],
          soldier: {
            name: "ssss",
            platform: null,
          },
        },
      ],
    },
  };

  assert.deepEqual(extractPlayerSearchResults(payload), [
    { playerId: "ssss", playerName: "ssss" },
  ]);
});

test("extractPlayerSearchResults falls back to names when soldier name is missing", () => {
  const payload = {
    result: {
      players: [
        {
          player_id: "76561198000000000",
          names: [{ name: "Alpha" }],
          soldier: {
            name: null,
          },
        },
      ],
    },
  };

  assert.deepEqual(extractPlayerSearchResults(payload), [
    { playerId: "76561198000000000", playerName: "Alpha" },
  ]);
});

test("detectPlatformFromStatsId detects known id formats", () => {
  assert.equal(detectPlatformFromStatsId("76561198000000000"), "steam");
  assert.equal(detectPlatformFromStatsId("123e4567-e89b-12d3-a456-426614174000"), "epic");
  assert.equal(detectPlatformFromStatsId("plain-name"), "other");
});
