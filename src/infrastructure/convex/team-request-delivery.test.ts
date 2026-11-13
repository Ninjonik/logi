import { deliverTeamRequestNotifications } from "../../../discord-bot/src/sync/team-request-notifications"
import { claimNotifications, markNotified } from "../../../convex/teamRequests"
import * as delivery from "../../../convex/teamRequestDelivery"
import { invoke, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

const secret = "team-delivery-test"
const now = Date.parse("2026-11-13T15:00:00Z")
function fixture(t: TestContext) {
    const previous = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (previous === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previous
    })
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = testContext()
    ctx.db.seed("teamRequests", {
        _id: "teamRequests:one",
        guildId: "guild",
        requestedBy: "100000000000000001",
        notificationStatus: "pending",
        notificationAttempts: 0,
        notificationNextAttemptAt: now,
        notificationLeaseUntil: null,
        kind: "create",
        gameId: "wardogs",
        status: "approved",
        proposal: { name: "Team" },
        reason: null,
        createdAt: new Date(now).toISOString(),
    })
    return ctx
}

test("accepted team DM with a lost outcome is quarantined after restart and not duplicated", async (t) => {
    const ctx = fixture(t)
    let sends = 0
    const warnings: string[] = []
    const pass = () =>
        deliverTeamRequestNotifications({
            siteUrl: "https://example.test",
            claim: () =>
                invoke(claimNotifications, ctx, { secret, durable: true }),
            begin: (requestId, claimToken) =>
                invoke(delivery.begin, ctx, { secret, requestId, claimToken }),
            fetchUser: async () => ({
                send: async () => {
                    sends++
                    return { id: "100000000000000002" }
                },
            }),
            mark: async () => {
                throw new Error("outcome write lost")
            },
            warn: (message) => warnings.push(message),
        })
    await pass()
    assert.equal(sends, 1)
    t.mock.timers.setTime(now + 120_001)
    await pass()
    assert.equal(sends, 1)
    assert.equal(
        ctx.db.tables.teamRequests[0].notificationDeliveryState,
        "uncertain"
    )
    assert.equal(ctx.db.tables.teamRequests[0].notificationStatus, "failed")
    assert.ok(
        warnings.includes("Team request DM outcome could not be recorded")
    )
})

test("pre-send team claims resume safely while stale and legacy senders cannot settle or send", async (t) => {
    const ctx = fixture(t)
    const [first] = await invoke(claimNotifications, ctx, {
        secret,
        durable: true,
    })
    t.mock.timers.setTime(now + 120_001)
    assert.deepEqual(await invoke(claimNotifications, ctx, { secret }), [])
    const [second] = await invoke(claimNotifications, ctx, {
        secret,
        durable: true,
    })
    assert.notEqual(first.claimToken, second.claimToken)
    assert.deepEqual(
        await invoke(delivery.begin, ctx, {
            secret,
            requestId: first.requestId,
            claimToken: first.claimToken,
        }),
        { ok: false }
    )
    assert.deepEqual(
        await invoke(markNotified, ctx, {
            secret,
            requestId: first.requestId,
            outcome: "sent",
        }),
        { ok: false }
    )
    assert.deepEqual(
        await invoke(delivery.begin, ctx, {
            secret,
            requestId: second.requestId,
            claimToken: second.claimToken,
        }),
        { ok: true }
    )
    assert.deepEqual(
        await invoke(markNotified, ctx, {
            secret,
            requestId: second.requestId,
            claimToken: first.claimToken,
            outcome: "sent",
        }),
        { ok: false }
    )
    assert.deepEqual(
        await invoke(markNotified, ctx, {
            secret,
            requestId: second.requestId,
            claimToken: second.claimToken,
            outcome: "sent",
            messageId: "100000000000000002",
        }),
        { ok: true }
    )
    assert.equal(
        ctx.db.tables.teamRequests[0].notificationMessageId,
        "100000000000000002"
    )
})

test("old unreceipted team work needs scoped operator evidence and retains its retry budget", async (t) => {
    const ctx = fixture(t)
    const row = ctx.db.tables.teamRequests[0]
    row.notificationAttempts = 1
    assert.deepEqual(
        await invoke(claimNotifications, ctx, { secret, durable: true }),
        []
    )
    assert.equal(row.notificationDeliveryState, "uncertain")
    const args = {
        secret,
        requestId: row._id,
        guildId: "guild",
        action: "proven_not_sent",
        operator: "operator",
        evidence: "Discord evidence confirms no send was attempted",
    }
    await assert.rejects(
        invoke(delivery.reconcile, ctx, { ...args, guildId: "other" }),
        /not found/
    )
    await invoke(delivery.reconcile, ctx, args)
    assert.equal(ctx.db.tables.teamRequests[0].notificationAttempts, 1)
    assert.equal(ctx.db.tables.teamRequestDeliveryAudits.length, 1)
    t.mock.timers.setTime(now + 60_001)
    const [claim] = await invoke(claimNotifications, ctx, {
        secret,
        durable: true,
    })
    assert.ok(claim.claimToken)
    await assert.rejects(invoke(delivery.reconcile, ctx, args), /Active/)
})
