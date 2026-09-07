import assert from "node:assert/strict";
import test from "node:test";

import { filterCollection, paginateCollection } from "./collection-query";

test("filterCollection combines top-level and nested filters with AND semantics", () => {
  const items = [
    { status: "published", score: { axis: 3, allied: 1 }, tags: ["featured"] },
    { status: "published", score: { axis: 1, allied: 3 }, tags: ["archive"] },
    { status: "draft", score: { axis: 3, allied: 1 }, tags: ["featured"] },
  ];
  assert.deepEqual(filterCollection(items, [{ path: "status", value: "published" }, { path: "score.axis", value: "3" }, { path: "tags", value: "featured" }]), [items[0]]);
});

test("paginateCollection returns stable offset metadata", () => {
  assert.deepEqual(paginateCollection(["a", "b", "c"], 1, 1), { page: ["b"], total: 3, offset: 1, limit: 1, nextOffset: 2 });
});
