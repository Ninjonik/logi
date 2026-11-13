import {
    claimDue,
    complete,
    release,
    renew,
    recoverQueue,
} from "../../../convex/scheduledJobs"
import { invoke, testContext } from "./testing/database"
import test, { type TestContext } from "node:test"
import assert from "node:assert/strict"

const secret = "scheduled-recovery-test-secret"
const now = Date.parse("2026-11-12T12:00:00Z")
function fixture(t: TestContext) {
    const before = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = secret
    t.after(() => {
        if (before === undefined) delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = before
    })
    t.mock.timers.enable({ apis: ["Date"], now })
    const ctx = testContext()
    ctx.db.seed("events", {
        _id: "events:one",
        kind: "match",
        status: "registration",
        gameEnd: "2099-01-01T00:00:00Z",
    })
    ctx.db.seed("eventScheduleJobs", {
        _id: "eventScheduleJobs:one",
        eventId: "events:one",
        kind: "refresh-announcement",
        dueAt: new Date(now - 1).toISOString(),
        status: "pending",
        attempts: 0,
    })
    return ctx
}

test("expired scheduled claims are recovered on a later pass and stale owners cannot finish/release", async (t) => {
    const ctx = fixture(t)
    const [old] = await invoke(claimDue, ctx, { secret, fenced: true })
    t.mock.timers.setTime(now + 6 * 60_000)
    assert.equal((await invoke(recoverQueue, ctx, { secret })).released, 1)
    const [current] = await invoke(claimDue, ctx, { secret, fenced: true })
    assert.equal(current.claimVersion, old.claimVersion + 1)
    for (const fn of [complete, release]) {
        assert.equal(
            await invoke(fn, ctx, {
                secret,
                jobId: old.id,
                claimVersion: old.claimVersion,
            }),
            false
        )
        assert.equal(await invoke(fn, ctx, { secret, jobId: old.id }), false)
    }
    assert.equal((await ctx.db.get(old.id))?.status, "processing")
    assert.equal(
        await invoke(complete, ctx, {
            secret,
            jobId: current.id,
            claimVersion: current.claimVersion,
        }),
        true
    )
    assert.equal(await ctx.db.get(old.id), null)
})

test("heartbeat retains active claims but cannot revive an expired or superseded owner", async (t) => {
    const ctx = fixture(t)
    const [claim] = await invoke(claimDue, ctx, { secret, fenced: true })
    t.mock.timers.setTime(now + 4 * 60_000)
    const args = {
        secret,
        claims: [{ jobId: claim.id, claimVersion: claim.claimVersion }],
    }
    assert.deepEqual(await invoke(renew, ctx, args), [claim.id])
    t.mock.timers.setTime(now + 6 * 60_000)
    assert.equal((await invoke(recoverQueue, ctx, { secret })).released, 0)
    t.mock.timers.setTime(now + 10 * 60_000)
    assert.deepEqual(await invoke(renew, ctx, args), [])
    await invoke(recoverQueue, ctx, { secret })
    await invoke(claimDue, ctx, { secret, fenced: true })
    assert.deepEqual(await invoke(renew, ctx, args), [])
})

test("legacy scheduled claims remain compatible with completion and release", async (t) => {
    const ctx = fixture(t)
    const [claim] = await invoke(claimDue, ctx, { secret })
    assert.equal(await invoke(release, ctx, { secret, jobId: claim.id }), true)
    const [next] = await invoke(claimDue, ctx, { secret })
    assert.equal(await invoke(complete, ctx, { secret, jobId: next.id }), true)
})

test("obsolete cleanup is paginated instead of reading the entire schedule table", async (t) => {
    const ctx = fixture(t)
    for (let i = 0; i < 250; i++)
        ctx.db.seed("eventScheduleJobs", {
            _id: `eventScheduleJobs:future-${i}`,
            eventId: "events:one",
            kind: "refresh-announcement",
            dueAt: "2099-01-01T00:00:00Z",
            status: "pending",
            attempts: 0,
        })
    const first = await invoke(recoverQueue, ctx, {
        secret,
        paginationOpts: { cursor: null, numItems: 100 },
    })
    assert.equal(first.isDone, false)
    const second = await invoke(recoverQueue, ctx, {
        secret,
        paginationOpts: { cursor: first.continueCursor, numItems: 100 },
    })
    assert.equal(second.isDone, false)
    const last = await invoke(recoverQueue, ctx, {
        secret,
        paginationOpts: { cursor: second.continueCursor, numItems: 100 },
    })
    assert.equal(last.isDone, true)
    assert.equal(last.removed, 0)
})

test("scheduler renew and recovery authenticate before database access", async (t) => {
    const ctx = fixture(t)
    await assert.rejects(invoke(recoverQueue, ctx, { secret: "invalid" }))
    await assert.rejects(invoke(renew, ctx, { secret: "invalid", claims: [] }))
})
