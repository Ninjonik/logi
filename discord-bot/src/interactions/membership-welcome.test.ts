import assert from "node:assert/strict"
import test from "node:test"

import { getApplicationMessages } from "../../../src/lib/clan-language/application"

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
        "<@applicant> <@&recruiter> <@&mentor>\nHi <@applicant>, welcome to the Member application. <@&recruiter> <@&mentor>"
    )
})

test("without the clan's own welcome the clan-language greeting is used (L6-42)", () => {
    assert.equal(
        buildMembershipApplicationWelcomeContent({
            applicantId: "17",
            supportRoleIds: ["nabor"],
            categoryLabel: "Člen",
            defaultWelcome: getApplicationMessages("cs").welcome,
        }),
        "<@17> <@&nabor>\nAhoj <@17>, díky za přihlášku. <@&nabor> se ti brzy ozve."
    )
    assert.equal(
        buildMembershipApplicationWelcomeContent({
            applicantId: "17",
            supportRoleIds: [],
            categoryLabel: "Člen",
            defaultWelcome: getApplicationMessages("cs").welcome,
        }),
        "<@17>\nAhoj <@17>, díky za přihlášku. Nábor se ti brzy ozve."
    )
})

test("support roles are left off the first line when the clan does not mention them (N4-34)", () => {
    assert.equal(
        buildMembershipApplicationWelcomeContent({
            applicantId: "applicant",
            supportRoleIds: ["recruiter"],
            categoryLabel: "Member",
            mentionSupportRoles: false,
        }),
        "<@applicant>"
    )
})
