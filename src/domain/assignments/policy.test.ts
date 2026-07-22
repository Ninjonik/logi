import assert from "node:assert/strict";
import test from "node:test";

import { getResolvedMemberStatus, mergeImportedSecondaryGroupIds, validateAssignmentGroupIds } from "./policy";

test("getResolvedMemberStatus resolves active mercenaries distinctly", () => {
  assert.equal(getResolvedMemberStatus("mercenary", "active"), "mercenary");
  assert.equal(getResolvedMemberStatus("member", "active"), "member");
});

test("validateAssignmentGroupIds rejects unknown groups", () => {
  assert.throws(() => validateAssignmentGroupIds({
    primaryGroupId: "group-2",
    secondaryGroupIds: [],
    validGroupIds: new Set(["group-1"]),
  }));
});

test("mergeImportedSecondaryGroupIds dedupes and excludes primary", () => {
  assert.deepEqual(mergeImportedSecondaryGroupIds({
    primaryGroupId: "group-1",
    existingSecondaryGroupIds: ["group-2"],
    importedSecondaryGroupIds: ["group-2", "group-3", "group-1"],
  }), ["group-2", "group-3"]);
});
