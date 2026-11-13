import {
    releaseApplicationSubmission,
    deleteExpiredDrafts,
    listQueuedWebApplications,
} from "../../../convex/membershipApplications"
import { prepareSubmission } from "../../../convex/membershipDecisions"
import { createTicketThread } from "../../../convex/discordMembership"
import { invoke, spyReads, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

const secret = "provisioning-test",
    guildId = "111111111111111111",
    userId = "222222222222222222"
test("membership preparation survives a lost response, preserves partial provisioning, and fences legacy release", async (t) => {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    const now = Date.parse("2026-11-13T12:00:00Z")
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = testContext()
    ctx.db.seed("guilds", { _id: "guilds:one", discordId: guildId })
    ctx.db.seed("users", { _id: "users:one", discordId: userId })
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:one",
        guildId,
        membershipSettings: {
            enabled: true,
            categories: [
                {
                    id: "member",
                    assignmentType: "member",
                    supportRoleIds: [],
                    recruitRoleIds: [],
                    finalRoleIds: [],
                },
            ],
        },
    })
    ctx.db.seed("membershipApplicationFormDrafts", {
        _id: "membershipApplicationFormDrafts:one",
        guildId,
        creatorId: userId,
        categoryId: "member",
        source: "web",
        submissionStatus: "claimed",
        submissionClaimToken: "claim",
        resumableSubmission: true,
        claimedUntil: now + 120_000,
        expiresAt: now - 1,
    })
    const args = {
        secret,
        draftId: "membershipApplicationFormDrafts:one",
        claimToken: "claim",
    }
    const id = await invoke(prepareSubmission, ctx, args)
    assert.equal(await invoke(prepareSubmission, ctx, args), id)
    assert.equal(ctx.db.tables.userAssignments.length, 1)
    assert.equal(ctx.db.tables.discordMembershipOperations.length, 1)
    assert.deepEqual(
        await invoke(releaseApplicationSubmission, ctx, {
            secret,
            draftId: args.draftId,
        }),
        { ok: false }
    )
    await invoke(releaseApplicationSubmission, ctx, args)
    const draft = await ctx.db.get(args.draftId)
    assert.equal(draft?.submissionStatus, "claimed")
    assert.equal(draft?.submissionError, "reconciliation_pending")
    await invoke(deleteExpiredDrafts, ctx)
    assert.ok((await ctx.db.get(args.draftId))!.expiresAt > now)
})

test("expired web discovery seeks by source, status and lease instead of hiding behind active claims", async (t) => {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    const ctx = testContext()
    for (let i = 0; i < 40; i++)
        ctx.db.seed("membershipApplicationFormDrafts", {
            _id: `membershipApplicationFormDrafts:active-${i}`,
            source: "web",
            submissionStatus: "claimed",
            claimedUntil: Date.now() + 60_000,
        })
    ctx.db.seed("membershipApplicationFormDrafts", {
        _id: "membershipApplicationFormDrafts:due",
        guildId,
        creatorId: userId,
        source: "web",
        submissionStatus: "claimed",
        claimedUntil: Date.now() - 1,
    })
    const reads = spyReads(ctx)
    const rows = await invoke(listQueuedWebApplications, ctx, { secret })
    assert.deepEqual(
        rows.map((row: { draftId: string }) => row.draftId),
        ["membershipApplicationFormDrafts:due"]
    )
    assert.ok(
        reads.every(
            (read) => read.index === "source_submissionStatus_claimedUntil"
        )
    )
})

test("recording the same accepted ticket twice retains its number and counter", async (t) => {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    const ctx = testContext()
    ctx.db.seed("discordConfigs", {
        _id: "discordConfigs:ticket",
        guildId,
        defaultLanguage: "en",
        ticketCounter: 0,
        ticketSettings: {
            enabled: true,
            categories: [{ id: "help", label: "Help" }],
        },
    })
    const args = {
        secret,
        guildId,
        threadId: "thread",
        parentChannelId: "parent",
        creatorId: userId,
        categoryId: "help",
        answers: [],
    }
    const first = await invoke(createTicketThread, ctx, args)
    const second = await invoke(createTicketThread, ctx, args)
    assert.equal(first.ticket.ticketNumber, second.ticket.ticketNumber)
    assert.equal(ctx.db.tables.ticketThreads.length, 1)
    assert.equal((await ctx.db.get("discordConfigs:ticket"))?.ticketCounter, 1)
    await assert.rejects(
        invoke(createTicketThread, ctx, { ...args, creatorId: "other" }),
        /scope mismatch/
    )
})
