import {
    createTicketThread,
    updateTicketTranscriptMessage,
} from "../../../convex/discordMembership"
import {
    invoke,
    testContext,
} from "../../../src/infrastructure/convex/testing/database"
import { provisionTicket, type TicketPorts } from "../interactions/tickets"
import * as journal from "../../../convex/discordMembershipEffects"
import type { DiscordConfig, TicketCategory } from "../types"
import { MembershipEffects } from "./membership-effects"
import type { Guild, TextChannel } from "discord.js"
import assert from "node:assert/strict"
import test from "node:test"

test("an accepted ticket record with a dropped response resumes the remembered thread instead of deleting or recreating it", async () => {
    const secret = process.env.INTERNAL_AUTH_SECRET
    const ctx = testContext()
    const category: TicketCategory = {
        id: "help",
        label: "Help",
        supportRoleIds: [],
        modalQuestions: [],
    }
    const config: DiscordConfig = {
        id: "config",
        guildId: "guild",
        defaultLanguage: "en",
        timezone: "UTC",
        calendarCategories: [],
        updatedAt: "2026-11-13T12:00:00Z",
        ticketSettings: {
            enabled: true,
            panelTitle: "Help",
            panelDescription: "",
            categories: [category],
        },
    }
    ctx.db.seed("discordConfigs", { _id: "discordConfigs:one", ...config })
    const call = async (name: string, args: Record<string, unknown>) => {
        const fn = Object.entries(journal).find(([key]) => key === name)?.[1]
        if (!fn) throw new Error("Unexpected journal call")
        return invoke(fn, ctx, { secret, ...args })
    }
    let creates = 0,
        deletes = 0,
        sends = 0,
        responseLost = true
    const thread = {
        id: "thread",
        parentId: "parent",
        ownerId: "bot",
        isThread: () => true,
        members: { add: async () => {} },
        send: async () => {
            sends++
            return { id: "intro" }
        },
        setName: async () => {},
        delete: async () => {
            deletes++
        },
    }
    const parent = {
        id: "parent",
        threads: {
            create: async () => {
                creates++
                return thread
            },
        },
    } as unknown as TextChannel
    const guild = {
        id: "guild",
        client: { user: { id: "bot" } },
        channels: { fetch: async () => thread },
        members: { fetch: async () => new Map(), cache: new Map() },
    } as unknown as Guild
    const ports: TicketPorts = {
        config: async () => config,
        effects: (op) => new MembershipEffects(op, call),
        createRecord: async (input) => {
            const result = await invoke(createTicketThread, ctx, {
                secret,
                ...input,
            })
            if (responseLost) {
                responseLost = false
                throw new Error("record response lost")
            }
            return result
        },
        storeIntroMessage: async (threadId, messageId) => {
            await invoke(updateTicketTranscriptMessage, ctx, {
                secret,
                threadId,
                transcriptMessageId: messageId,
            })
        },
        reporter: async () => {},
    }
    const input = {
        guild,
        guildId: "guild",
        parent,
        config,
        category,
        answers: [],
        ports,
        userId: "creator",
        userTag: "creator",
        authorName: "Creator",
        operationKey: "ticket-open:interaction",
        subjectId: "interaction",
        fail: async () => {},
    }
    assert.equal(await provisionTicket(input), undefined)
    assert.equal(creates, 1)
    assert.equal(deletes, 0)
    const result = await provisionTicket(input)
    assert.equal(result?.threadId, "thread")
    assert.equal(creates, 1)
    assert.equal(deletes, 0)
    assert.equal(sends, 1)
    assert.equal(ctx.db.tables.ticketThreads.length, 1)
    assert.equal(ctx.db.tables.discordMembershipOperations[0].state, "complete")
})
