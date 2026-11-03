import {
    clanSettingsSlicesPatch,
    parseClanSettingsSlicePatches,
} from "./settings-slices"
import { eventDiscussionsSettingsSlice as slice } from "./event-discussions-settings-slice"
import { CLAN_SETTINGS_SLICES } from "./clan-settings-slices"
import assert from "node:assert/strict"
import { test } from "node:test"

test("API discussion slice retains unrelated private game configuration", () => {
    const source = {
        discordConfig: {
            gameOverrides: {
                wardogs: {
                    announcementsChannelId: "private",
                    playerStatsServers: [{ token: "secret" }],
                    eventDiscussionDefaults: {
                        debriefDestination: "results_thread",
                    },
                },
            },
        },
    }
    const body = {
        eventDiscussions: {
            defaults: { debriefDestination: "results_thread" },
            games: {
                wardogs: {
                    debriefDestination: "debrief_forum",
                    debriefForumChannelId: "123456789012345678",
                },
            },
        },
    }
    const parsed = parseClanSettingsSlicePatches(body, CLAN_SETTINGS_SLICES)
    assert.equal(parsed.ok, true)
    const patch = clanSettingsSlicesPatch(body, source, CLAN_SETTINGS_SLICES)
    const overrides =
        patch.gameOverrides as typeof source.discordConfig.gameOverrides
    assert.equal(overrides.wardogs.announcementsChannelId, "private")
    assert.deepEqual(overrides.wardogs.playerStatsServers, [
        { token: "secret" },
    ])
    assert.ok(!JSON.stringify(slice.read(source)).includes("secret"))
    assert.ok(!JSON.stringify(slice.read(source)).includes("private"))
})
test("API defaults validate the effective game overrides and permit clearing overrides", () => {
    const source = {
        discordConfig: {
            eventDiscussionDefaults: {
                createForumChannel: true,
                deleteForumAfterConclusion: false,
            },
            gameOverrides: {
                wardogs: {
                    eventDiscussionDefaults: {
                        debriefDestination: "event_forum",
                    },
                },
            },
        },
    }
    assert.match(
        slice.verify!(
            {
                defaults: {
                    createForumChannel: true,
                    deleteForumAfterConclusion: true,
                },
            },
            source
        )!,
        /retained/
    )
    assert.equal(
        slice.verify!(
            {
                defaults: {
                    createForumChannel: true,
                    deleteForumAfterConclusion: true,
                },
                games: {},
            },
            source
        ),
        null
    )
    assert.equal(
        slice.patchSchema.safeParse({
            games: { wardogs: { playerStatsServers: [] } },
        }).success,
        false
    )
})
