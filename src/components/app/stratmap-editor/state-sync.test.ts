import assert from "node:assert/strict";
import test from "node:test";

import { decideRemoteState } from "./state-sync";

test("acknowledges a remote state that already matches the editor", () => {
  assert.equal(decideRemoteState({ remoteJson: "b", currentJson: "b", acknowledgedJson: "a", submittedJsons: new Set() }), "acknowledge");
});

test("does not replace newer local work with an older save echo", () => {
  assert.equal(decideRemoteState({ remoteJson: "b", currentJson: "c", acknowledgedJson: "a", submittedJsons: new Set(["b"]) }), "own-echo");
});

test("applies realtime changes while the editor is clean", () => {
  assert.equal(decideRemoteState({ remoteJson: "b", currentJson: "a", acknowledgedJson: "a", submittedJsons: new Set() }), "apply-remote");
});

test("preserves unsaved local work when an unrelated remote update arrives", () => {
  assert.equal(decideRemoteState({ remoteJson: "b", currentJson: "c", acknowledgedJson: "a", submittedJsons: new Set() }), "preserve-local");
});
