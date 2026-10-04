import assert from "node:assert/strict"
import test from "node:test"

import { discordConfigPatch } from "./discord-config-patch"

test("keeps omitted settings out of the update", () => {
    assert.deepEqual(
        discordConfigPatch({ ticketSettings: { enabled: false } }),
        { ticketSettings: { enabled: false } }
    )
})

test("clears an ID with null or a blank value and trims kept IDs", () => {
    const updates = discordConfigPatch({
        errorsChannelId: null,
        calendarChannelId: "  ",
        announcementsChannelId: " 123 ",
    })
    assert.deepEqual(Object.keys(updates).sort(), [
        "announcementsChannelId",
        "calendarChannelId",
        "errorsChannelId",
    ])
    assert.equal(updates.errorsChannelId, undefined)
    assert.equal(updates.calendarChannelId, undefined)
    assert.equal(updates.announcementsChannelId, "123")
})

test("drops incomplete stats servers and blank calendar categories", () => {
    assert.deepEqual(
        discordConfigPatch({
            playerStatsServers: [
                { token: " a ", url: " https://stats.example " },
                { token: "", url: "https://missing-token.example" },
            ],
            calendarCategories: [" ECL ", ""],
        }),
        {
            playerStatsServers: [{ token: "a", url: "https://stats.example" }],
            calendarCategories: ["ECL"],
        }
    )
})

test("passes the German clan language through", () => {
    assert.deepEqual(discordConfigPatch({ defaultLanguage: "de" }), {
        defaultLanguage: "de",
    })
})
