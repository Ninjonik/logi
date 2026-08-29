import assert from "node:assert/strict";
import test from "node:test";

import { SIGNUP_NOT_ATTENDING } from "@/domain/events/types";

import { formatSignupResultMessage, resolveEventSignupSelection } from "./event-signup";

const labels = {
  attend: "Attend",
  generalSignup: "Sign up",
  decline: "Command",
  signupUpdatedWithType: "Signup updated - {type}.",
  signupRemovedWithType: "Removed signup from {type}.",
  markedNotAttending: "Marked as not attending.",
};

test("formatSignupResultMessage keeps first not attending click distinct from removal", () => {
  assert.equal(
    formatSignupResultMessage({
      removed: false,
      appliedSignupLabel: SIGNUP_NOT_ATTENDING,
      labels,
      emoji: "❌",
    }),
    "Marked as not attending.",
  );

  assert.equal(
    formatSignupResultMessage({
      removed: true,
      appliedSignupLabel: SIGNUP_NOT_ATTENDING,
      labels,
      emoji: "❌",
    }),
    "Removed signup from ❌ Command.",
  );
});

const signupLabels = {
  registrationClosed: "Closed",
  invalidSignupButton: "Invalid",
  unableToResolveMembership: "Membership unavailable",
  missingRequiredRole: "Missing role",
  membershipStatusNotAllowed: "Membership status not allowed",
  signupUpdated: "Updated",
  markedNotAttending: "Not attending",
};

const event = {
  kind: "match" as const,
  signupGroupIds: ["group-1"],
  allowedSignupStatuses: undefined,
  useGeneralSignup: false,
  requiredRoleIds: [],
  registrationEnd: "2099-01-01T00:00:00.000Z",
  status: "registration" as const,
};

test("dashboard group assignment permits signup without the linked Discord role", () => {
  const result = resolveEventSignupSelection({
    event,
    groups: [{ id: "group-1", name: "Alpha", color: "#000", discordRoleId: "role-1" }],
    memberRoleIds: [],
    assignedGroupIds: ["group-1"],
    membershipStatus: "member",
    actionId: "group-1",
    labels: signupLabels,
  });

  assert.deepEqual(result, { ok: true, group: "Alpha", successMessage: "Updated" });
});

test("unassigned users still need the linked Discord role to sign up", () => {
  const result = resolveEventSignupSelection({
    event,
    groups: [{ id: "group-1", name: "Alpha", color: "#000", discordRoleId: "role-1" }],
    memberRoleIds: [],
    assignedGroupIds: [],
    membershipStatus: "member",
    actionId: "group-1",
    labels: signupLabels,
  });

  assert.deepEqual(result, { ok: false, error: "Missing role" });
});
