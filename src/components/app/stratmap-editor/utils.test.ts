import assert from "node:assert/strict";
import test from "node:test";

import { zoomViewport } from "./utils";

test("applies repeated zoom steps to the latest viewport", () => {
  const anchor = { x: 960, y: 960 };
  const first = zoomViewport({ x: 0, y: 0, width: 1920, height: 1920 }, 0.88, anchor);
  const second = zoomViewport(first, 0.88, anchor);

  assert.equal(first.width, 1689.6);
  assert.equal(second.width, 1486.848);
  assert.ok(second.width < first.width);
  assert.ok(Math.abs(second.x - 216.576) < 0.000_001);
  assert.ok(Math.abs(second.y - 216.576) < 0.000_001);
});

test("clamps zoom out at the canvas bounds without changing the anchor math direction", () => {
  assert.deepEqual(
    zoomViewport({ x: 320, y: 320, width: 1280, height: 1280 }, 2, { x: 960, y: 960 }),
    { x: 0, y: 0, width: 1920, height: 1920 },
  );
});
