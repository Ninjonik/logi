import assert from "node:assert/strict";
import test from "node:test";

import { createRosterImageCache } from "./roster-image-cache";

test("roster image cache returns a defensive copy of a cached image", () => {
  const cache = createRosterImageCache(2);
  cache.set("event-1:version-1", new Uint8Array([1, 2, 3]));

  const image = cache.get("event-1:version-1");
  assert.deepEqual(image, new Uint8Array([1, 2, 3]));

  image![0] = 9;
  assert.deepEqual(cache.get("event-1:version-1"), new Uint8Array([1, 2, 3]));
});

test("roster image cache evicts the least recently used version", () => {
  const cache = createRosterImageCache(2);
  cache.set("event-1:one", new Uint8Array([1]));
  cache.set("event-1:two", new Uint8Array([2]));
  assert.deepEqual(cache.get("event-1:one"), new Uint8Array([1]));

  cache.set("event-1:three", new Uint8Array([3]));

  assert.equal(cache.get("event-1:two"), undefined);
  assert.deepEqual(cache.get("event-1:one"), new Uint8Array([1]));
  assert.deepEqual(cache.get("event-1:three"), new Uint8Array([3]));
});
