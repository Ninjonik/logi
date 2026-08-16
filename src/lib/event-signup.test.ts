import assert from "node:assert/strict";
import test from "node:test";

import { SIGNUP_NOT_ATTENDING } from "@/domain/events/types";

import { formatSignupResultMessage } from "./event-signup";

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
