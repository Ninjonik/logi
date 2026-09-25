import assert from "node:assert/strict";
import test from "node:test";

import { hellLetLooseGame } from "./definition";

test("Hell Let Loose exposes the existing membership statuses and their roster/signup eligibility", () => {
  assert.deepEqual(hellLetLooseGame.membership.statuses, [
    { key: "pending", label: "Pending", canAppearInRoster: false, canSignUpForMatches: false },
    { key: "recruit", label: "Recruit", canAppearInRoster: true, canSignUpForMatches: true },
    { key: "member", label: "Member", canAppearInRoster: true, canSignUpForMatches: true },
    { key: "reserve_member", label: "Reserve member", canAppearInRoster: true, canSignUpForMatches: true },
    { key: "mercenary", label: "Mercenary", canAppearInRoster: true, canSignUpForMatches: true },
  ]);
});
