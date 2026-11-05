import { syncSignupThread } from "./signup-thread"
import { ChannelType } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

test("replaces a public discussion and applies signups and explicit declines without enumerating members", async () => {
    const calls: string[] = []
    const thread = {
        id: "private",
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
                type: ChannelType
                invitable: boolean
            }) => {
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
