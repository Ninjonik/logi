import assert from "node:assert/strict";
import test from "node:test";

import {
  formatHllPresetLabel,
  inferHllBaseMapId,
  inferHllSelection,
  resolveHllPresetCode,
} from "./hll-map-presets";

test("HLL preset parsing preserves a warfare map's map, time, and mode", () => {
  assert.deepEqual(inferHllSelection("carentan_warfare_night"), {
    mapId: "carentan",
    time: "night",
    mode: "warfare",
  });
  assert.equal(formatHllPresetLabel("carentan_warfare_night"), "Carentan • Night • Warfare");
});

test("HLL offensive preset resolution uses the selected attacking side", () => {
  assert.equal(resolveHllPresetCode({
    mapId: "foy",
    time: "day",
    mode: "offensive",
    side: "axis",
  }), "foy_offensive_ger");
  assert.equal(resolveHllPresetCode({
    mapId: "foy",
    time: "day",
    mode: "offensive",
    side: "allies",
  }), "foy_offensive_us");
});

test("HLL base-map inference accepts both known preset codes and map IDs", () => {
  assert.equal(inferHllBaseMapId("foy_warfare"), "foy");
  assert.equal(inferHllBaseMapId("foy"), "foy");
  assert.equal(inferHllBaseMapId("not-a-map"), null);
});
