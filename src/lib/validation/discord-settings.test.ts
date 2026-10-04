import assert from "node:assert/strict"
import test from "node:test"

import { discordSettingsPatchSchema } from "./discord-settings"

test("Discord settings retain independent game membership overrides", () => {
    const parsed = discordSettingsPatchSchema.parse({
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
    const result = discordSettingsPatchSchema.safeParse({
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
    const parsed = discordSettingsPatchSchema.parse({
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

test("Discord settings accept /stats command switches and drop a blank default room", () => {
    const parsed = discordSettingsPatchSchema.parse({
        timezone: "UTC",
        defaultLanguage: "en",
        statsSettings: {
            enabled: true,
            games: { hell_let_loose: false, wardogs: true },
            defaultShareChannelId: "",
        },
    })
    assert.deepEqual(parsed.statsSettings, {
        enabled: true,
        games: { hell_let_loose: false, wardogs: true },
        defaultShareChannelId: undefined,
    })
    assert.ok(
        !discordSettingsPatchSchema.safeParse({
            timezone: "UTC",
            defaultLanguage: "en",
            statsSettings: {
                enabled: true,
                games: { hell_let_loose: true, wardogs: true },
                defaultShareChannelId: "general",
            },
        }).success
    )
})

test("a settings page can submit only its own settings", () => {
    const parsed = discordSettingsPatchSchema.parse({
        ticketSettings: {
            enabled: false,
            panelTitle: "",
            panelDescription: "",
            categories: [],
        },
    })
    assert.deepEqual(Object.keys(parsed), ["ticketSettings"])
})

test("blank and null Discord IDs clear the field while omitted IDs stay out", () => {
    const parsed = discordSettingsPatchSchema.parse({
        errorsChannelId: "",
        calendarChannelId: null,
        announcementsChannelId: "123",
    })
    assert.equal(parsed.errorsChannelId, null)
    assert.equal(parsed.calendarChannelId, null)
    assert.equal(parsed.announcementsChannelId, "123")
    assert.equal(parsed.eventInfoChannelId, undefined)
    assert.equal(parsed.playerStatsServers, undefined)
    assert.equal(parsed.calendarCategories, undefined)
})

test("membership settings keep roster score rules and accept German", () => {
    const rosterScoreSettings = {
        noCategory: 0,
        declined: -1,
        rosterPresent: 2,
        reservePresent: 1,
        rosterAbsent: -3,
        reserveAbsent: -1,
        excusedAbsence: 0,
    }
    const parsed = discordSettingsPatchSchema.parse({
        defaultLanguage: "de",
        membershipSettings: {
            enabled: false,
            panelTitle: "",
            panelDescription: "",
            autoAssignRecruitOnApply: false,
            rosterScoreSettings,
            categories: [],
        },
    })
    assert.equal(parsed.defaultLanguage, "de")
    assert.deepEqual(
        parsed.membershipSettings?.rosterScoreSettings,
        rosterScoreSettings
    )
})
