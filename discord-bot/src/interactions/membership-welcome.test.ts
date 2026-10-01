import assert from "node:assert/strict"
import test from "node:test"

import { buildMembershipApplicationWelcomeContent } from "./membership-welcome"

test("application welcome content resolves Discord mention placeholders", () => {
    assert.equal(
        buildMembershipApplicationWelcomeContent({
            applicantId: "applicant",
            supportRoleIds: ["recruiter", "mentor"],
            categoryLabel: "Member",
            welcomeMessage:
                "Hi {applicant}, welcome to the {category} application. {support_roles}",
        }),
        "<@applicant>\n<@&recruiter> <@&mentor>\nHi <@applicant>, welcome to the Member application. <@&recruiter> <@&mentor>"
    )
})

test("application welcome content retains the existing applicant and staff pings", () => {
    assert.equal(
        buildMembershipApplicationWelcomeContent({
            applicantId: "applicant",
            supportRoleIds: ["recruiter"],
            categoryLabel: "Member",
        }),
        "<@applicant>\n<@&recruiter>"
    )
})
