import assert from "node:assert/strict"
import test from "node:test"

import { ChannelType } from "discord.js"

import { getMeetingChannelMemberIds } from "./meeting-attendance-members"

test("gets all cached members from the configured voice channel", async () => {
    const memberIds = await getMeetingChannelMemberIds(
        {
            guilds: {
                fetch: async () => ({
                    channels: {
                        fetch: async () => ({
                            type: ChannelType.GuildVoice,
                            members: new Map([
                                ["first", {}],
                                ["second", {}],
                            ]),
                        }),
                    },
                }),
            },
        } as never,
        "guild-id",
        "meeting-channel-id"
    )

    assert.deepEqual(memberIds, ["first", "second"])
})

test("rejects a configured channel that is not voice-based", async () => {
    await assert.rejects(
        getMeetingChannelMemberIds(
            {
                guilds: {
                    fetch: async () => ({
                        channels: {
                            fetch: async () => ({
                                type: ChannelType.GuildText,
                            }),
                        },
                    }),
                },
            } as never,
            "guild-id",
            "meeting-channel-id"
        ),
        /not a voice or stage channel/
    )
})
