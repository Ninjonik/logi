import { resourceFixture } from "../runtime/event-resource.fixture"
import { syncSignupThread } from "./signup-thread"
import test, { beforeEach } from "node:test"
import { ChannelType } from "discord.js"
import assert from "node:assert/strict"
beforeEach((t) => {
    if ("mock" in t) resourceFixture(t)
})

test("replaces a public discussion and applies signups and explicit declines without enumerating members", async () => {
    const calls: string[] = []
    const thread = {
        id: "private",
        name: "Match",
        type: ChannelType.PrivateThread,
        parentId: "channel",
        isThread: () => true,
        setInvitable: async (value: boolean) => assert.equal(value, false),
        members: {
            fetch: async () => {
                throw new Error("Must not enumerate members")
            },
            remove: async (id: string) => {
                calls.push(`remove ${id}`)
            },
            add: async (id: string) => {
                calls.push(`add ${id}`)
            },
        },
    }
    const parent = {
        id: "channel",
        type: ChannelType.GuildText,
        threads: {
            fetchActive: async () => ({ threads: new Map() }),
            create: async (options: {
                name: string
                type: ChannelType
                invitable: boolean
            }) => {
                assert.equal(options.name, "Match")
                assert.equal(options.type, ChannelType.PrivateThread)
                assert.equal(options.invitable, false)
                calls.push("create")
                return thread
            },
        },
    }
    const id = await syncSignupThread({
        guild: {
            client: { user: { id: "bot" } },
            channels: {
                fetch: async (id: string) =>
                    id === "channel"
                        ? parent
                        : {
                              type: ChannelType.PublicThread,
                              isThread: () => true,
                              delete: async () => {
                                  calls.push("delete public")
                              },
                          },
            },
        } as never,
        event: {
            id: "event",
            name: "Match",
            createSignupThread: true,
            participants: [
                { userId: "current", status: "attending" },
                { userId: "former", status: "not_attending" },
            ],
        } as never,
        announcementMessageId: "message",
        announcementChannelId: "channel",
        existingThreadId: "public",
    })
    assert.equal(id, "private")
    assert.deepEqual(calls, [
        "delete public",
        "create",
        "remove former",
        "add current",
    ])
})

for (const stored of [true, false]) {
    test(`renames a legacy discussion recovered by ${stored ? "stored ID" : "legacy title"}`, async () => {
        const renamed: string[] = []
        const thread = {
            id: "private",
            name: "Match · event",
            type: ChannelType.PrivateThread,
            parentId: "channel",
            isThread: () => true,
            setName: async (name: string) => {
                renamed.push(name)
            },
            setInvitable: async () => {},
        }
        const parent = {
            id: "channel",
            type: ChannelType.GuildText,
            threads: {
                fetchActive: async () => ({
                    threads: new Map([["private", thread]]),
                }),
                create: async () => {
                    throw new Error("Must reuse the legacy thread")
                },
            },
        }
        assert.equal(
            await syncSignupThread({
                guild: {
                    channels: {
                        fetch: async (id: string) =>
                            id === "channel" ? parent : thread,
                    },
                } as never,
                event: {
                    id: "event",
                    name: "Match",
                    createSignupThread: true,
                    participants: [],
                } as never,
                announcementMessageId: "message",
                announcementChannelId: "channel",
                existingThreadId: stored ? "private" : undefined,
            }),
            "private"
        )
        assert.deepEqual(renamed, ["Match"])
    })
}

for (const ambiguous of [false, true]) {
    test(`a discussion create ${ambiguous ? "with a lost response is withheld" : "with a saved receipt is recovered"} after restart`, async () => {
        let creates = 0
        const thread = {
            id: "private",
            name: "Match",
            type: ChannelType.PrivateThread,
            parentId: "channel",
            invitable: false,
            isThread: () => true,
        }
        const channel = {
            id: "channel",
            type: ChannelType.GuildText,
            threads: {
                fetchActive: async () => ({ threads: new Map() }),
                create: async () => {
                    creates++
                    if (ambiguous) throw new Error("Lost response")
                    return thread
                },
            },
        }
        const input = {
            guild: {
                id: "guild",
                channels: {
                    fetch: async (id: string) =>
                        id === "channel" ? channel : thread,
                },
            } as never,
            event: {
                id: "event",
                name: "Match",
                createSignupThread: true,
                participants: [],
            } as never,
            announcementMessageId: "message",
            announcementChannelId: "channel",
        }
        if (ambiguous) {
            await assert.rejects(syncSignupThread(input), /Lost response/)
            await assert.rejects(syncSignupThread(input), /uncertain/)
        } else {
            assert.equal(await syncSignupThread(input), "private")
            assert.equal(await syncSignupThread(input), "private")
        }
        assert.equal(creates, 1)
    })
}
