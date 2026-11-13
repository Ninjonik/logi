import {
    invoke,
    testContext,
} from "../../../src/infrastructure/convex/testing/database"
import { startMembershipEffectRecovery } from "./membership-effects"
import * as journal from "../../../convex/discordMembershipEffects"
import { resumeMembershipWorkflow } from "./membership-workflows"
import { ConvexReactClient } from "convex/react"
import { getFunctionName } from "convex/server"
import type { Client } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

test("ticket restart skips a confirmed DM and uncertain card while finishing untouched thread effects", async (t) => {
    const secret = process.env.INTERNAL_AUTH_SECRET
    const ctx = testContext()
    const operationId = await invoke(journal.open, ctx, {
        secret,
        key: "ticket-close:thread",
        guildId: "guild",
        kind: "ticket-close",
        subjectId: "thread",
        actorId: "actor",
        expectedKeys: ["dm:creator", "close-card", "rename", "lock", "archive"],
    })
    ctx.db.seed("discordMembershipEffects", {
        _id: "discordMembershipEffects:dm",
        operationId,
        key: "dm:creator",
        mode: "send",
        state: "confirmed",
        resourceId: "message",
        attempts: 1,
        token: "old",
        leaseUntil: 0,
        retryAt: 0,
        createdAt: 0,
        updatedAt: 0,
    })
    ctx.db.seed("discordMembershipEffects", {
        _id: "discordMembershipEffects:card",
        operationId,
        key: "close-card",
        mode: "send",
        state: "uncertain",
        attempts: 1,
        token: "old",
        leaseUntil: 0,
        retryAt: 0,
        createdAt: 0,
        updatedAt: 0,
    })
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (
            reference: Parameters<typeof getFunctionName>[0],
            args: Record<string, unknown>
        ) => {
            const name = getFunctionName(reference).split(":")[1]
            const fn = Object.entries(journal).find(
                ([key]) => key === name
            )?.[1]
            if (!fn) throw new Error("Unexpected mutation")
            return invoke(fn, ctx, { ...args, secret })
        }
    )
    t.mock.method(
        ConvexReactClient.prototype,
        "query",
        async (reference: Parameters<typeof getFunctionName>[0]) => {
            if (
                getFunctionName(reference) ===
                "discordMembership:getTicketThreadContext"
            )
                return {
                    config: {
                        guildId: "guild",
                        defaultLanguage: "en",
                        timezone: "UTC",
                    },
                    category: null,
                    ticket: {
                        guildId: "guild",
                        threadId: "thread",
                        creatorId: "creator",
                        parentChannelId: "parent",
                        categoryLabel: "Help",
                        ticketNumber: 1,
                        status: "closed",
                        closedAt: "2026-11-13T12:00:00Z",
                        closedByUserId: "actor",
                    },
                }
            return { defaultLanguage: "en" }
        }
    )
    let sends = 0,
        locks = 0,
        archives = 0
    const channel = {
        ownerId: "bot",
        name: "Help",
        isThread: () => true,
        send: async () => {
            sends++
            return { id: "new-message" }
        },
        setName: async () => {},
        setLocked: async () => {
            locks++
        },
        setArchived: async () => {
            archives++
        },
    }
    const guild = {
        id: "guild",
        name: "Clan",
        channels: { fetch: async () => channel },
    }
    const client = {
        user: { id: "bot" },
        guilds: { fetch: async () => guild },
        users: {
            fetch: async () => ({
                globalName: "Actor",
                username: "actor",
                send: async () => {
                    sends++
                    return { id: "dm" }
                },
            }),
        },
    } as unknown as Client
    await resumeMembershipWorkflow(client, {
        id: operationId,
        token: "workflow",
        key: "ticket-close:thread",
        guildId: "guild",
        kind: "ticket-close",
        subjectId: "thread",
        actorId: "actor",
        threadId: "thread",
    })
    assert.equal(sends, 0)
    assert.equal(locks, 1)
    assert.equal(archives, 1)
    assert.equal((await ctx.db.get(operationId))?.state, "review")
})

test("member repair rechecks current support-role eligibility before adding anyone", async (t) => {
    let claims = 0,
        additions = 0
    const outcomes: unknown[] = []
    t.mock.method(
        ConvexReactClient.prototype,
        "mutation",
        async (
            reference: Parameters<typeof getFunctionName>[0],
            args: Record<string, unknown>
        ) => {
            switch (getFunctionName(reference)) {
                case "discordMembershipEffects:claimRepair":
                    return claims++ === 0
                        ? {
                              operationId: "operation",
                              key: "member:former-support",
                              token: "claim",
                              guildId: "guild",
                              finishRequested: false,
                              repair: {
                                  threadId: "thread",
                                  action: "member",
                                  value: "former-support",
                              },
                          }
                        : null
                case "discordMembershipEffects:heartbeat":
                    return true
                case "discordMembershipEffects:finish":
                    outcomes.push(args.state)
                    return null
                default:
                    throw new Error("Unexpected mutation")
            }
        }
    )
    t.mock.method(ConvexReactClient.prototype, "query", async () => ({
        creatorId: "creator",
        status: "open",
        expectedStatus: "open",
        supportRoleIds: ["support"],
    }))
    const client = {
        user: { id: "bot" },
        guilds: {
            fetch: async () => ({
                channels: {
                    fetch: async () => ({
                        ownerId: "bot",
                        isThread: () => true,
                        members: {
                            add: async () => {
                                additions++
                            },
                        },
                    }),
                },
                members: {
                    fetch: async () => ({
                        id: "former-support",
                        roles: { cache: new Map() },
                    }),
                },
            }),
        },
    } as unknown as Client
    t.mock.method(ConvexReactClient.prototype, "watchQuery", () => ({
        localQueryResult: () => ({ key: "repair", dueAt: 0 }),
        onUpdate: () => () => {},
    }))
    client.on = (() => client) as typeof client.on
    client.off = (() => client) as typeof client.off
    const stop = startMembershipEffectRecovery(client)
    for (let i = 0; i < 40 && !outcomes.length; i++) await Promise.resolve()
    await stop()
    assert.equal(additions, 0)
    assert.deepEqual(outcomes, ["retry"])
})
