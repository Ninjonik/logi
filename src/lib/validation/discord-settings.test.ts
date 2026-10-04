import assert from "node:assert/strict"
import test from "node:test"

import { discordSettingsSchema } from "./discord-settings"

test("Discord settings retain independent game membership overrides", () => {
    const parsed = discordSettingsSchema.parse({
        timezone: "UTC",
        defaultLanguage: "en",
        gameOverrides: {
            hell_let_loose_vietnam: {
                announcementsChannelId: "123",
                membershipSettings: {
                    enabled: false,
                    submitChannelId: undefined,
                    applicationParentChannelId: undefined,
                    panelTitle: "",
                    panelDescription: "",
                    panelImageUrl: undefined,
                    applicationWelcomeMessage:
                        "Welcome {applicant}; {support_roles} can help.",
                    autoAssignRecruitOnApply: false,
                    inviteSupportMembersIndividually: false,
                    rosterScoreSettings: {
                        noCategory: 0,
                        declined: 0,
                        rosterPresent: 0,
                        reservePresent: 0,
                        rosterAbsent: 0,
                        reserveAbsent: 0,
                        excusedAbsence: 0,
                    },
                    categories: [],
                },
            },
            wardogs: { meetingChannelId: "456" },
        },
    })

    assert.equal(
        parsed.gameOverrides?.hell_let_loose_vietnam?.announcementsChannelId,
        "123"
    )
    assert.equal(
        parsed.gameOverrides?.hell_let_loose_vietnam?.membershipSettings
            ?.enabled,
        false
    )
    assert.equal(
        parsed.gameOverrides?.hell_let_loose_vietnam?.membershipSettings
            ?.applicationWelcomeMessage,
        "Welcome {applicant}; {support_roles} can help."
    )
    assert.equal(
        parsed.gameOverrides?.hell_let_loose_vietnam?.membershipSettings
            ?.inviteSupportMembersIndividually,
        false
    )
    assert.equal(parsed.gameOverrides?.wardogs?.meetingChannelId, "456")
})

test("role-ping application invitations allow no more than ten support roles", () => {
    const result = discordSettingsSchema.safeParse({
        timezone: "UTC",
        defaultLanguage: "en",
        membershipSettings: {
            enabled: true,
            submitChannelId: "123",
            applicationParentChannelId: "456",
            panelTitle: "Apply",
            panelDescription: "Choose a category.",
            autoAssignRecruitOnApply: false,
            inviteSupportMembersIndividually: false,
            categories: [
                {
                    id: "member",
                    label: "Member",
                    supportRoleIds: Array.from({ length: 11 }, (_, index) =>
                        String(index + 1)
                    ),
                    recruitRoleIds: [],
                    finalRoleIds: [],
                    modalQuestions: [],
                    assignmentType: "member",
                },
            ],
        },
    })

    assert.equal(result.success, false)
    if (!result.success) {
        assert.match(result.error.issues[0]?.message ?? "", /10 roles/)
    }
})

test("membership categories retain their selected game", () => {
    const parsed = discordSettingsSchema.parse({
        timezone: "UTC",
        defaultLanguage: "en",
        membershipSettings: {
            enabled: false,
            submitChannelId: undefined,
            applicationParentChannelId: undefined,
            panelTitle: "",
            panelDescription: "",
            autoAssignRecruitOnApply: false,
            categories: [
                {
                    id: "wardogs-member",
                    gameId: "wardogs",
                    supportRoleIds: [],
                    recruitRoleIds: [],
                    finalRoleIds: [],
                    modalQuestions: [],
                    assignmentType: "member",
                },
            ],
        },
    })

    assert.equal(parsed.membershipSettings?.categories[0]?.gameId, "wardogs")
})
