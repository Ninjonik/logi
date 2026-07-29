import assert from "node:assert/strict";
import test from "node:test";

import { buildEventSignupActions, getVisibleSignupGroups } from "./event-signup";

const groups = [
  { id: "command", name: "Command", color: "#d4a017" },
  { id: "inf", name: "Infantry", color: "#dc2626" },
] as const;

test("getVisibleSignupGroups keeps legacy events visible when signupGroupIds are missing", () => {
  const visible = getVisibleSignupGroups({}, [...groups]);

  assert.deepEqual(visible.map((group) => group.id), ["command", "inf"]);
});

test("getVisibleSignupGroups hides all groups when signupGroupIds is empty", () => {
  const visible = getVisibleSignupGroups({ signupGroupIds: [] }, [...groups]);

  assert.deepEqual(visible, []);
});

test("buildEventSignupActions only keeps general and decline buttons when all group signups are disabled", () => {
  const actions = buildEventSignupActions(
    { kind: "match", signupGroupIds: [], useGeneralSignup: true },
    [...groups],
    { attend: "Attend", generalSignup: "General signup", decline: "Decline" },
  );

  assert.deepEqual(actions.map((action) => action.kind), ["general", "decline"]);
});
