import {
    Collection,
    GuildMember,
    MessageFlags,
    PermissionsBitField,
    type ChatInputCommandInteraction,
    type ModalSubmitInteraction,
} from "discord.js"
import { createInteractionHandler } from "../interactions"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import { closeConvexClient } from "../convex"
import test, { afterEach } from "node:test"
import assert from "node:assert/strict"

afterEach(closeConvexClient)
const handler = () =>
    createInteractionHandler({
        enqueueEventSync: () => {},
        triggerPollSoon: () => {},
    })
const guildId = "111111111111111111",
    actorId = "222222222222222222"

for (const scenario of [
    "revoked-admin-role",
    "former-owner",
    "roles-unavailable",
    "guild-unavailable",
    "current-admin",
] as const) {
    test(`ticket closure uses current guild and role permissions: ${scenario}`, async (t) => {
        let writes = 0,
            ownerId = scenario === "former-owner" ? actorId : guildId
        const role = {
            permissions: new PermissionsBitField(
                scenario === "former-owner"
                    ? BigInt(0)
                    : PermissionsBitField.Flags.Administrator
            ),
        }
        const permissions = Object.getOwnPropertyDescriptor(
            GuildMember.prototype,
            "permissions"
        )!.get!
        const member = {
            user: { id: actorId },
            guild: {
                get ownerId() {
                    return ownerId
                },
            },
            roles: { cache: new Collection([["staff-role", role]]) },
            get permissions() {
                return permissions.call(this)
            },
        }
        const currentGuild = {
            roles: {
                fetch: async () => {
                    if (scenario === "roles-unavailable")
                        throw new Error("Offline")
                    role.permissions = new PermissionsBitField(
                        scenario === "current-admin"
                            ? PermissionsBitField.Flags.Administrator
                            : BigInt(0)
                    )
                    return member.roles.cache
                },
            },
            members: { fetch: async () => member },
        }
        t.mock.method(ConvexReactClient.prototype, "query", async () => ({
            config: { guildId, defaultLanguage: "en" },
            ticket: {
                guildId,
                status: "open",
                creatorId: actorId,
                ticketNumber: 1,
            },
            category: { supportRoleIds: [] },
        }))
        t.mock.method(ConvexReactClient.prototype, "mutation", async () => {
            writes++
        })
        const noop = async () => {}
        await handler().handleChatInputCommand({
            commandName: "close_ticket",
            guildId,
            channelId: "333333333333333333",
            inGuild: () => true,
            user: { id: actorId },
            channel: {
                isThread: () => true,
                send: noop,
                setName: noop,
                setLocked: noop,
                setArchived: noop,
            },
            guild: {
                ...currentGuild,
                fetch: async () => {
                    if (scenario === "guild-unavailable")
                        throw new Error("Offline")
                    ownerId = guildId
                    return currentGuild
                },
            },
            client: { users: { fetch: async () => null } },
            options: { getString: () => "synthetic closure" },
            deferred: false,
            replied: false,
            deferReply: async function (this: {
                deferred: boolean
                ephemeral: boolean
            }) {
                this.deferred = true
                this.ephemeral = true
            },
            editReply: noop,
        } as unknown as ChatInputCommandInteraction)
        assert.equal(writes, scenario === "current-admin" ? 1 : 0)
    })
}

for (const missing of [false, true]) {
    test(`ticket closure rejects cached administrator when fresh membership is ${missing ? "unavailable" : "revoked"}`, async (t) => {
        let writes = 0,
            fetched = false,
            answer = ""
        t.mock.method(ConvexReactClient.prototype, "query", async () => ({
            config: { guildId, defaultLanguage: "en" },
            ticket: {
                guildId,
                status: "open",
                creatorId: actorId,
                ticketNumber: 1,
            },
            category: { supportRoleIds: [] },
        }))
        t.mock.method(ConvexReactClient.prototype, "mutation", async () => {
            writes++
            throw new Error("Unexpected write")
        })
        const command = {
            commandName: "close_ticket",
            guildId,
            channelId: "333333333333333333",
            inGuild: () => true,
            user: { id: actorId },
            channel: { isThread: () => true },
            member: {
                permissions: { has: () => true },
                roles: { cache: new Map() },
            },
            guild: {
                fetch: async function () {
                    return this
                },
                roles: { fetch: async () => new Map() },
                members: {
                    fetch: async (args: { user: string; force: boolean }) => {
                        assert.deepEqual(args, { user: actorId, force: true })
                        fetched = true
                        if (missing) throw new Error("Discord unavailable")
                        return {
                            permissions: { has: () => false },
                            roles: { cache: new Map() },
                        }
                    },
                },
            },
            options: { getString: () => "synthetic closure" },
            deferred: false,
            replied: false,
            deferReply: async function (this: {
                deferred: boolean
                ephemeral: boolean
            }) {
                this.deferred = true
                this.ephemeral = true
            },
            editReply: async (v: unknown) => {
                answer = JSON.stringify(v)
            },
        } as unknown as ChatInputCommandInteraction
        await handler().handleChatInputCommand(command)
        assert.equal(fetched, true)
        assert.equal(writes, 0)
        assert.ok(answer.length > 0)
    })
}

test("link acknowledges privately before database and emoji reads", async (t) => {
    let acknowledged = false,
        edited = false
    t.mock.method(ConvexReactClient.prototype, "query", async () => {
        assert.equal(acknowledged, true)
        return null
    })
    await handler().handleChatInputCommand({
        commandName: "link",
        guildId,
        user: { id: actorId },
        deferred: false,
        replied: false,
        deferReply: async function (
            this: { deferred: boolean; ephemeral: boolean },
            v: { flags: number }
        ) {
            assert.equal(v.flags, MessageFlags.Ephemeral)
            acknowledged = true
            this.deferred = true
            this.ephemeral = true
        },
        editReply: async () => {
            edited = true
        },
    } as unknown as ChatInputCommandInteraction)
    assert.equal(edited, true)
})

test("notice submit acknowledges before persistence and cache revalidation", async (t) => {
    let acknowledged = false,
        writes = 0,
        edited = false
    const gameStart = "2099-01-01T18:00:00Z"
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            assert.equal(acknowledged, true)
            switch (getFunctionName(reference)) {
                case "discordSync:getEventInteractionContext":
                    return {
                        event: {
                            guildId,
                            name: "Synthetic match",
                            gameStart,
                            status: "scheduled",
                        },
                        config: { defaultLanguage: "en", timezone: "UTC" },
                    }
                case "events:findNoticeTarget":
                    return [
                        { id: "event-id", name: "Synthetic match", gameStart },
                    ]
                default:
                    return []
            }
        }
    )
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (_ref: unknown, input: { userId: string; reason: string }) => {
            assert.equal(acknowledged, true)
            assert.equal(input.userId, actorId)
            assert.equal(input.reason, "Synthetic delay")
            writes++
        }
    )
    t.mock.method(
        globalThis,
        "fetch",
        async () => new Response(null, { status: 204 })
    )
    await handler().handleModalSubmit({
        customId: "notice-modal:event-id",
        guildId,
        user: { id: actorId },
        fields: { getTextInputValue: () => "Synthetic delay" },
        deferred: false,
        ephemeral: null,
        deferReply: async function (
            this: { deferred: boolean; ephemeral: boolean | null },
            v: { flags: number }
        ) {
            assert.equal(v.flags, MessageFlags.Ephemeral)
            acknowledged = true
            this.deferred = true
            this.ephemeral = true
        },
        editReply: async () => {
            edited = true
        },
    } as unknown as ModalSubmitInteraction)
    assert.equal(writes, 1)
    assert.equal(edited, true)
})
