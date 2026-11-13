import { invoke, spyReads, testContext } from "./testing/database"
import { next } from "../../../convex/discordWorkSignals"
import assert from "node:assert/strict"
import test from "node:test"

test("queue signals read indexed heads only and expose future retry/lease deadlines", async (t) => {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "work-signal-test"
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    const ctx = testContext()
    const calls = spyReads(ctx)
    const args = { secret: "work-signal-test", kind: "dispatch" }
    assert.equal(await invoke(next, ctx, args), null)
    ctx.db.seed("discordScheduledDispatches", {
        _id: "dispatch:pending",
        status: "pending",
        retryAt: 3000,
        attempts: 0,
    })
    ctx.db.seed("discordScheduledDispatches", {
        _id: "dispatch:lease",
        status: "processing",
        leaseUntil: 2000,
        claimToken: "owner",
        attempts: 1,
    })
    assert.deepEqual(await invoke(next, ctx, args), {
        key: "dispatch:lease:processing:owner",
        dueAt: 2000,
    })
    await ctx.db.delete("dispatch:lease")
    assert.deepEqual(await invoke(next, ctx, args), {
        key: "dispatch:pending:pending:0",
        dueAt: 3000,
    })
    ctx.db.seed("eventDeletionRequests", {
        _id: "delete:one",
        status: "pending",
        nextAttemptAt: "2026-11-13T12:00:00Z",
        attempts: 0,
    })
    assert.equal(
        (await invoke(next, ctx, { ...args, kind: "deletion" })).dueAt,
        Date.parse("2026-11-13T12:00:00Z")
    )
    ctx.db.seed("matchRecaps", {
        _id: "recap:one",
        deliveryState: "started",
        deliveryToken: "owner",
        deliveryDueAt: 4000,
    })
    assert.equal(
        (await invoke(next, ctx, { ...args, kind: "recap" })).dueAt,
        4000
    )
    ctx.db.seed("discordMembershipOperations", {
        _id: "workflow:one",
        state: "pending",
        workDueAt: 5000,
        workAttempts: 0,
    })
    assert.equal(
        (await invoke(next, ctx, { ...args, kind: "membership-workflow" }))
            .dueAt,
        5000
    )
    ctx.db.seed("discordMembershipEffects", {
        _id: "effect:unrepairable",
        state: "retry",
        retryAt: 1,
    })
    ctx.db.seed("discordMembershipEffects", {
        _id: "effect:repairable",
        state: "retry",
        repairable: true,
        retryAt: 6000,
        attempts: 1,
    })
    assert.equal(
        (await invoke(next, ctx, { ...args, kind: "membership-effect" })).dueAt,
        6000
    )
    ctx.db.seed("teamRequests", {
        _id: "team:one",
        notificationStatus: "pending",
        notificationNextAttemptAt: 7000,
        notificationAttempts: 1,
    })
    assert.equal(
        (await invoke(next, ctx, { ...args, kind: "team" })).dueAt,
        7000
    )
    assert.ok(calls.every((call) => call.index !== null))
    await assert.rejects(
        invoke(next, ctx, { ...args, secret: "wrong" }),
        /Unauthorized/
    )
})
