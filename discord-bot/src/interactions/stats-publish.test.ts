import type { StatsRequest } from "../../../src/application/game-data/read-player-stats"
import { ChannelType, type Client } from "discord.js"
import { publishStats } from "./stats-publish"
import assert from "node:assert/strict"
import test from "node:test"
const request: StatsRequest = {
    guildId: "guild-a",
    requesterId: "member",
    targetId: "member",
    game: "wardogs",
    period: "30d",
}
test("publication checks fresh actor/bot permissions and the channel guild before sending", async () => {
    for (const denied of ["guild", "actor", "bot", "type", null]) {
        let sent = 0
        const actor = { id: "actor" },
            bot = { id: "bot" }
        const channel = {
            guildId: denied === "guild" ? "guild-b" : "guild-a",
            type:
                denied === "type"
                    ? ChannelType.GuildVoice
                    : ChannelType.GuildText,
            isTextBased: () => true,
            permissionsFor: (member: { id: string }) => ({
                has: () => member.id !== denied,
            }),
            send: async (payload: { allowedMentions: { parse: string[] } }) => {
                assert.deepEqual(payload.allowedMentions.parse, [])
                sent++
                return { id: "message-1" }
            },
        }
        const client = {
            guilds: {
                cache: new Map([
                    [
                        "guild-a",
                        {
                            id: "guild-a",
                            channels: {
                                fetch: async (
                                    _id: string,
                                    options: { force: boolean }
                                ) => {
                                    assert.equal(options.force, true)
                                    return channel
                                },
                            },
                            members: {
                                fetch: async (options: { force: boolean }) => {
                                    assert.equal(options.force, true)
                                    return actor
                                },
                                fetchMe: async (options: {
                                    force: boolean
                                }) => {
                                    assert.equal(options.force, true)
                                    return bot
                                },
                            },
                        },
                    ],
                ]),
            },
        } as unknown as Client
        const send = () =>
            publishStats(client, request, "channel", {
                embeds: [],
                allowedMentions: { parse: [] },
            })
        if (denied) await assert.rejects(send, /share_denied/)
        else await send()
        assert.equal(sent, denied ? 0 : 1)
    }
})
