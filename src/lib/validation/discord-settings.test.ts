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
                    autoAssignRecruitOnApply: false,
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
    assert.equal(parsed.gameOverrides?.wardogs?.meetingChannelId, "456")
})
