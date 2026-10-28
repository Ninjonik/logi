import { getMeetingChannelMemberIds } from "./meeting-attendance-members"
import { ChannelType } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

function fixture(
    options: {
        type?: ChannelType
        read?: (url: string) => Promise<unknown>
    } = {}
) {
    const reads: string[] = []
    const client = {
        guilds: {
            fetch: async () => ({
                channels: {
                    fetch: async () => ({
                        type: options.type ?? ChannelType.GuildVoice,
                        // Deliberately stale: REST must be authoritative.
                        members: new Map([["stale", {}]]),
                    }),
                },
            }),
        },
        rest: {
            get: async (url: string, request: { signal: AbortSignal }) => {
                reads.push(url)
                assert.ok(request.signal)
                return options.read
                    ? options.read(url)
                    : { user_id: url.split("/").at(-1), channel_id: "meeting" }
            },
        },
    }
    return { client: client as never, reads }
}

test("fresh REST finds assigned players and reserves even with an incomplete channel cache", async () => {
    const { client, reads } = fixture()
    assert.deepEqual(
        await getMeetingChannelMemberIds(client, "guild", "meeting", [
            "assigned",
            "reserve",
            "reserve",
        ]),
        ["assigned", "reserve"]
    )
    assert.deepEqual(reads, [
        "/guilds/guild/voice-states/assigned",
        "/guilds/guild/voice-states/reserve",
    ])
})

test("only the configured room counts; disconnected and other rooms do not", async () => {
    const { client } = fixture({
        read: async (url) => {
            const user_id = url.split("/").at(-1)
            if (user_id === "offline") throw { code: 10065 }
            return {
                user_id,
                channel_id:
                    user_id === "present"
                        ? "meeting"
                        : user_id === "null"
                          ? null
                          : "other-room",
            }
        },
    })
    assert.deepEqual(
        await getMeetingChannelMemberIds(client, "guild", "meeting", [
            "present",
            "other",
            "null",
            "offline",
        ]),
        ["present"]
    )
})

test("permissions, rate limits, and network failures never become an empty attendance result", async () => {
    for (const error of [
        { code: 50013 },
        { status: 429 },
        new Error("network"),
    ]) {
        const { client } = fixture({
            read: async () => {
                throw error
            },
        })
        await assert.rejects(
            getMeetingChannelMemberIds(client, "guild", "meeting", ["player"])
        )
    }
})

test("invalid responses are rejected instead of reporting absence", async () => {
    for (const response of [
        null,
        {},
        { user_id: "someone-else", channel_id: "meeting" },
    ]) {
        const { client } = fixture({ read: async () => response })
        await assert.rejects(
            getMeetingChannelMemberIds(client, "guild", "meeting", ["player"]),
            /invalid voice state/
        )
    }
})

test("stage channels work; text channels fail without a voice read", async () => {
    const stage = fixture({ type: ChannelType.GuildStageVoice })
    assert.deepEqual(
        await getMeetingChannelMemberIds(stage.client, "guild", "meeting", [
            "player",
        ]),
        ["player"]
    )
    const text = fixture({ type: ChannelType.GuildText })
    await assert.rejects(
        getMeetingChannelMemberIds(text.client, "guild", "meeting", ["player"]),
        /not a voice or stage channel/
    )
    assert.deepEqual(text.reads, [])
})

test("an empty roster makes no voice-state API requests", async () => {
    const { client, reads } = fixture()
    assert.deepEqual(
        await getMeetingChannelMemberIds(client, "guild", "meeting", []),
        []
    )
    assert.deepEqual(reads, [])
})
