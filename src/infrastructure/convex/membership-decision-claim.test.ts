import {
    claimApplicationDecision,
    releaseApplicationDecision,
} from "../../../convex/membershipApplications"
import { closeMembershipApplicationThread } from "../../../convex/discordMembership"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

test("stale or legacy releases cannot clear a newer fenced decision claim", async (t) => {
    const oldSecret = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "test-secret"
    t.after(() => {
        if (oldSecret === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = oldSecret
    })
    const now = Date.parse("2026-11-13T12:00:00Z")
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = testContext()
    ctx.db.seed("membershipApplicationThreads", {
        _id: "membershipApplicationThreads:one",
        threadId: "thread",
        status: "open",
    })
    const first = await invoke(claimApplicationDecision, ctx, {
        secret: "test-secret",
        threadId: "thread",
        fenced: true,
    })
    assert.ok(first.ok && first.claimToken)
    t.mock.timers.setTime(now + 60_001)
    const second = await invoke(claimApplicationDecision, ctx, {
        secret: "test-secret",
        threadId: "thread",
        fenced: true,
    })
    assert.ok(second.ok && second.claimToken)
    assert.notEqual(first.claimToken, second.claimToken)
    for (const claimToken of [first.claimToken, undefined]) {
        await invoke(releaseApplicationDecision, ctx, {
            secret: "test-secret",
            threadId: "thread",
            claimToken,
        })
        assert.equal(
            (await ctx.db.get("membershipApplicationThreads:one"))
                ?.decisionClaimToken,
            second.claimToken
        )
    }
    await invoke(releaseApplicationDecision, ctx, {
        secret: "test-secret",
        threadId: "thread",
        claimToken: second.claimToken,
    })
    assert.equal(
        (await ctx.db.get("membershipApplicationThreads:one"))
            ?.decisionLeaseUntil,
        undefined
    )
})

test("a legacy decision claim can still be released by a legacy worker", async (t) => {
    const oldSecret = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "test-secret"
    t.after(() => {
        if (oldSecret === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = oldSecret
    })
    const ctx = testContext()
    ctx.db.seed("membershipApplicationThreads", {
        _id: "membershipApplicationThreads:legacy",
        threadId: "legacy",
        status: "open",
    })
    const claim = await invoke(claimApplicationDecision, ctx, {
        secret: "test-secret",
        threadId: "legacy",
    })
    assert.equal(claim.ok, true)
    await invoke(releaseApplicationDecision, ctx, {
        secret: "test-secret",
        threadId: "legacy",
    })
    assert.equal(
        (await ctx.db.get("membershipApplicationThreads:legacy"))
            ?.decisionLeaseUntil,
        undefined
    )
})

test("a stale decision claim cannot close an application after a newer claim", async (t) => {
    const oldSecret = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "test-secret"
    t.after(() => {
        if (oldSecret === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = oldSecret
    })
    const now = Date.parse("2026-11-13T12:00:00Z")
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = testContext()
    ctx.db.seed("membershipApplicationThreads", {
        _id: "membershipApplicationThreads:close",
        threadId: "close",
        status: "open",
    })
    const first = await invoke(claimApplicationDecision, ctx, {
        secret: "test-secret",
        threadId: "close",
        fenced: true,
    })
    assert.ok(first.ok && first.claimToken)
    t.mock.timers.setTime(now + 60_001)
    const second = await invoke(claimApplicationDecision, ctx, {
        secret: "test-secret",
        threadId: "close",
        fenced: true,
    })
    assert.ok(second.ok && second.claimToken)
    await assert.rejects(
        invoke(closeMembershipApplicationThread, ctx, {
            secret: "test-secret",
            threadId: "close",
            closedByUserId: "staff",
            closeOutcome: "member",
            decisionClaimToken: first.claimToken,
        }),
        /ownership lost/
    )
    await invoke(closeMembershipApplicationThread, ctx, {
        secret: "test-secret",
        threadId: "close",
        closedByUserId: "staff",
        closeOutcome: "member",
        decisionClaimToken: second.claimToken,
    })
    assert.equal(
        (await ctx.db.get("membershipApplicationThreads:close"))?.status,
        "closed"
    )
})
