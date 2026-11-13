import {
    claim as claimReminder,
    complete as completeReminder,
} from "../../../convex/eventReminders"
import {
    claim as claimRoster,
    complete as completeRoster,
} from "../../../convex/rosterChanges"
import { heartbeat, expire } from "../../../convex/discordRequestRecovery"
import { invoke, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

const now = Date.parse("2026-11-12T12:00:00Z")
const secret = "request-recovery-test-secret"
function fixture(t: TestContext) {
    const before = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (before === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = before
    })
    t.mock.timers.enable({ apis: ["Date"], now })
    return testContext()
}

for (const [table, kind, complete, claim] of [
    ["eventReminderRequests", "reminder", completeReminder, claimReminder],
    ["rosterChangeRequests", "roster", completeRoster, claimRoster],
] as const) {
    test(`${kind}: active owner heartbeats, expired owner is quarantined without replay`, async (t) => {
        const ctx = fixture(t),
            id = `${table}:one`
        ctx.db.seed(table, {
            _id: id,
            status: "processing",
            claimToken: "owner",
            leaseUntil: now + 1000,
            claimedAt: new Date(now).toISOString(),
        })
        assert.equal(
            await invoke(heartbeat, ctx, {
                secret,
                kind,
                requestId: id,
                claimToken: "wrong",
            }),
            false
        )
        assert.equal(
            await invoke(heartbeat, ctx, {
                secret,
                kind,
                requestId: id,
                claimToken: "owner",
            }),
            true
        )
        t.mock.timers.setTime(now + 4 * 60_000)
        assert.equal((await invoke(expire, ctx, { secret })).recovered, 0)
        t.mock.timers.setTime(now + 6 * 60_000)
        assert.equal(
            await invoke(heartbeat, ctx, {
                secret,
                kind,
                requestId: id,
                claimToken: "owner",
            }),
            false
        )
        assert.equal((await invoke(expire, ctx, { secret })).recovered, 1)
        const row = await ctx.db.get(id)
        assert.equal(row?.status, "failed")
        assert.equal(row?.error, "delivery_uncertain")
        assert.equal(await invoke(claim, ctx, { secret, requestId: id }), null)
        const result =
            kind === "reminder"
                ? { sentCount: 1 }
                : {
                      dmSentUserIds: ["user"],
                      dmFailedUserIds: [],
                      digestPosted: true,
                  }
        await invoke(complete, ctx, {
            secret,
            requestId: id,
            claimToken: "owner",
            ...result,
        })
        assert.equal(
            row?.status,
            "failed",
            "late completion cannot overwrite recovered state"
        )
    })

    test(`${kind}: stale or unfenced completions cannot replace the current owner's result`, async (t) => {
        const ctx = fixture(t),
            id = `${table}:one`
        ctx.db.seed(table, {
            _id: id,
            status: "processing",
            claimToken: "owner",
            leaseUntil: now + 300000,
        })
        const result =
            kind === "reminder"
                ? { sentCount: 1 }
                : {
                      dmSentUserIds: ["user"],
                      dmFailedUserIds: [],
                      digestPosted: true,
                  }
        for (const claimToken of [undefined, "old-owner"]) {
            await invoke(complete, ctx, {
                secret,
                requestId: id,
                claimToken,
                ...result,
            })
            assert.equal((await ctx.db.get(id))?.status, "processing")
        }
        await invoke(complete, ctx, {
            secret,
            requestId: id,
            claimToken: "owner",
            ...result,
        })
        assert.equal((await ctx.db.get(id))?.status, "sent")
    })
}

test("legacy interrupted claims recover after their window and indexed batches make progress", async (t) => {
    const ctx = fixture(t)
    ctx.db.seed("eventReminderRequests", {
        _id: "eventReminderRequests:legacy",
        status: "processing",
        claimedAt: new Date(now - 6 * 60_000).toISOString(),
    })
    for (let i = 0; i < 60; i++)
        ctx.db.seed("eventReminderRequests", {
            _id: `eventReminderRequests:${i}`,
            status: "processing",
            claimToken: "owner",
            leaseUntil: now - 1,
        })
    assert.equal((await invoke(expire, ctx, { secret })).recovered, 51)
    assert.equal((await invoke(expire, ctx, { secret })).recovered, 10)
    assert.equal((await invoke(expire, ctx, { secret })).recovered, 0)
})

test("request recovery and heartbeat reject an invalid runtime secret before access", async (t) => {
    const ctx = fixture(t)
    await assert.rejects(invoke(expire, ctx, { secret: "invalid" }))
    await assert.rejects(
        invoke(heartbeat, ctx, {
            secret: "invalid",
            kind: "reminder",
            requestId: "eventReminderRequests:one",
            claimToken: "owner",
        })
    )
})

for (const [table, kind, claim, complete] of [
    ["eventReminderRequests", "reminder", claimReminder, completeReminder],
    ["rosterChangeRequests", "roster", claimRoster, completeRoster],
] as const) {
    test(`${kind}: upgraded owners opt into fencing while old bots finish legacy claims`, async (t) => {
        const ctx = fixture(t)
        ctx.db.seed("events", {
            _id: "events:one",
            guildId: "guild",
            kind: "match",
            status: "registration",
            registrationEnd: "2099-01-01T12:00:00Z",
            meetingStart: "2099-01-02T12:00:00Z",
            participants: [],
        })
        ctx.db.seed("rosters", {
            _id: "rosters:one",
            guildId: "guild",
            eventId: "events:one",
            squads: [],
            reservePlayerIds: [],
        })
        for (const fenced of [false, true]) {
            const id = `${table}:${fenced}`
            ctx.db.seed(table, {
                _id: id,
                status: "pending",
                eventId: "events:one",
                rosterId: "rosters:one",
                guildId: "guild",
                audience: "unanswered",
                recipientIds: [],
                before: [],
                requestedAt: new Date(now).toISOString(),
            })
            const claimed = await invoke(claim, ctx, {
                secret,
                requestId: id,
                ...(fenced ? { fenced: true } : {}),
            })
            assert.ok(claimed)
            assert.equal(
                typeof claimed.claimToken,
                fenced ? "string" : "undefined"
            )
            const result =
                kind === "reminder"
                    ? { sentCount: 0 }
                    : {
                          dmSentUserIds: [],
                          dmFailedUserIds: [],
                          digestPosted: false,
                      }
            await invoke(complete, ctx, {
                secret,
                requestId: id,
                ...(fenced ? { claimToken: claimed.claimToken } : {}),
                ...result,
            })
            assert.equal((await ctx.db.get(id))?.status, "sent")
        }
    })
}
