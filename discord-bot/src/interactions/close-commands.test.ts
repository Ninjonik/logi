import test, { afterEach, type TestContext } from "node:test"
import assert from "node:assert/strict"

import type { ChatInputCommandInteraction } from "discord.js"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"

import { getMembershipMessages } from "../../../src/lib/clan-language/membership"
import { createInteractionHandler } from "../interactions"
import { closeConvexClient } from "../convex"

afterEach(closeConvexClient)
const handler = () =>
    createInteractionHandler({
        enqueueEventSync: () => {},
        triggerPollSoon: () => {},
    })
const actorId = "222222222222222222"
const cs = getMembershipMessages("cs")
let nextGuild = 0
/** A fresh guild per test, so the five-minute language cache never leaks. */
const newGuildId = () => `7000000000000${String(nextGuild++).padStart(5, "0")}`

function backend(
    t: TestContext,
    input: { language: string; application?: boolean; guildId: string }
) {
    const writes: string[] = []
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            const name = getFunctionName(reference)
            if (name === "discordConfig:getConfigByDiscordGuildId")
                return { defaultLanguage: input.language }
            const config = {
                guildId: input.guildId,
                defaultLanguage: input.language,
                dashboardAdminRoleId: "logi-admin",
            }
            return input.application
                ? {
                      config,
                      application: {
                          status: "open",
                          creatorId: "333333333333333333",
                          applicationNumber: 42,
                          categoryId: "main",
                          gameId: "hell_let_loose",
                      },
                      assignment: null,
                      category: { supportRoleIds: ["recruiters"] },
                  }
                : {
                      config,
                      ticket: {
                          status: "open",
                          creatorId: "333333333333333333",
                          ticketNumber: 12,
                      },
                      category: { supportRoleIds: ["support"] },
                  }
        }
    )
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            writes.push(getFunctionName(reference))
            return "assignment-id"
        }
    )
    return writes
}

function command(input: {
    name: "close_ticket" | "close_application"
    guildId: string
    inThread?: boolean
    roles?: string[]
    calls?: string[]
    dms?: string[]
}) {
    const replies: string[] = []
    const noop = async () => {}
    const guild = {
        fetch: async () => {
            input.calls?.push("guild")
            return guild
        },
        roles: {
            fetch: async () => {
                input.calls?.push("roles")
            },
        },
        members: {
            fetch: async (args: { user: string; force: boolean }) => {
                input.calls?.push(`member:${args.force}`)
                return {
                    permissions: { has: () => false },
                    roles: {
                        cache: new Map(
                            (input.roles ?? []).map((id) => [id, {}])
                        ),
                    },
                }
            },
        },
    }
    const interaction = {
        commandName: input.name,
        guildId: input.guildId,
        channelId: "444444444444444444",
        inGuild: () => true,
        user: { id: actorId },
        // A cached administrator flag must not decide anything.
        member: { permissions: { has: () => true } },
        channel: {
            isThread: () => input.inThread ?? true,
            send: noop,
            setName: noop,
            setLocked: noop,
            setArchived: noop,
        },
        guild,
        client: {
            users: {
                fetch: async () => ({
                    send: async (message: { content: string }) => {
                        input.dms?.push(message.content)
                    },
                }),
            },
            guilds: {
                fetch: async () => {
                    throw new Error("Discord unavailable")
                },
            },
        },
        options: {
            getString: (name: string) =>
                name === "outcome" ? "member" : "Vyřešeno.",
        },
        deferReply: noop,
        reply: async (value: { content: string }) => {
            replies.push(value.content)
        },
        editReply: async (value: { content: string }) => {
            replies.push(value.content)
        },
    } as unknown as ChatInputCommandInteraction
    return { interaction, replies }
}

// /close_ticket has its own tests in close-ticket.test.ts.
for (const name of ["close_application"] as const) {
    test(`${name} outside its thread answers in the clan language, not English`, async (t) => {
        const guildId = newGuildId()
        backend(t, { language: "cs", guildId })
        const { interaction, replies } = command({
            name,
            guildId,
            inThread: false,
        })
        await handler().handleChatInputCommand(interaction)
        assert.deepEqual(replies, [cs.membership.closeCommandThreadOnly])
        assert.doesNotMatch(replies[0]!, /Use this command/)
    })

    test(`${name} checks roles freshly with the shared rule and refuses a cached administrator`, async (t) => {
        const guildId = newGuildId()
        const writes = backend(t, {
            language: "cs",
            guildId,
            application: true,
        })
        const calls: string[] = []
        const { interaction, replies } = command({
            name,
            guildId,
            roles: ["member"],
            calls,
        })
        await handler().handleChatInputCommand(interaction)
        assert.deepEqual(calls, ["guild", "roles", "member:true"])
        assert.deepEqual(writes, [])
        assert.deepEqual(replies, [cs.membership.noClosePermission])
    })
}

test("close_application allows the category's support role, like close_ticket", async (t) => {
    const guildId = newGuildId()
    const writes = backend(t, { language: "cs", guildId, application: true })
    const dms: string[] = []
    const { interaction } = command({
        name: "close_application",
        guildId,
        roles: ["recruiters"],
        dms,
    })
    await handler().handleChatInputCommand(interaction)
    assert.ok(
        writes.includes("discordMembership:closeMembershipApplicationThread")
    )
    // Without a readable server name the DM names Discord in Czech, never "this server".
    assert.match(dms[0]!, /v \*\*Discordu\*\*/)
    assert.doesNotMatch(dms.join(" "), /this server/)
})
