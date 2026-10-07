import {
    FETCH_RETRY_MS,
    FULL_RECONCILIATION_GAP_MS,
    GuildMembershipIngress,
    MembershipReconciliationSchedule,
    reconcileMembershipSnapshot,
} from "./membership-ingress"
import assert from "node:assert/strict"
import test from "node:test"
test("guild ingress preserves event order after a rejected mutation", async () => {
    const queue = new GuildMembershipIngress(),
        seen: number[] = []
    const first = queue.run("a", async () => {
        await new Promise((resolve) => setImmediate(resolve))
        seen.push(1)
        throw new Error("fixture")
    })
    const second = queue.run("a", async () => {
        seen.push(2)
    })
    await assert.rejects(first)
    await second
    assert.deepEqual(seen, [1, 2])
})
function ports(calls: string[]) {
    return {
        start: async () => {
            calls.push("start")
            return { epoch: "7", revision: "41" }
        },
        begin: async (start: { epoch: string; revision: string }) => {
            calls.push(`begin:${start.revision}`)
            return { id: "run" }
        },
        fetchComplete: async () => {
            calls.push("fetch")
            return null
        },
        batch: async () => {
            calls.push("batch")
        },
        finish: async () => {
            calls.push("finish")
            return { isDone: true }
        },
        superseded: (error: unknown) =>
            error instanceof Error && /superseded/.test(error.message),
    }
}
test("an incomplete fetch inserts no run; a complete one begins with the revision read before it", async () => {
    const calls: string[] = []
    assert.equal(await reconcileMembershipSnapshot(ports(calls)), "incomplete")
    // Only the read before the fetch and the fetch itself: no run, no write.
    assert.deepEqual(calls, ["start", "fetch"])
    calls.length = 0
    let total = 0,
        batches = 0
    assert.equal(
        await reconcileMembershipSnapshot({
            ...ports(calls),
            fetchComplete: async () => {
                calls.push("fetch")
                return Array.from({ length: 251 }, (_, i) => ({
                    discordUserId: String(i),
                    roleIds: [],
                    isAdmin: false,
                    hasDashboardAccess: false,
                }))
            },
            batch: async (_id, batch, count, rows) => {
                assert.equal(count, 251)
                assert.equal(batch, batches++)
                assert.ok(rows.length <= 100)
                total += rows.length
            },
        }),
        "complete"
    )
    assert.deepEqual(calls, ["start", "fetch", "begin:41", "finish"])
    assert.equal(total, 251)
    assert.equal(batches, 3)
})
test("a run a newer epoch replaced is superseded, not an error; other failures still throw", async () => {
    const members = async () => [
        {
            discordUserId: "1",
            roleIds: [],
            isAdmin: false,
            hasDashboardAccess: false,
        },
    ]
    // The epoch moved between the start and the begin.
    assert.equal(
        await reconcileMembershipSnapshot({
            ...ports([]),
            fetchComplete: members,
            begin: async () => null,
        }),
        "superseded"
    )
    // An invalidation while the batches were written.
    assert.equal(
        await reconcileMembershipSnapshot({
            ...ports([]),
            fetchComplete: members,
            batch: async () => {
                throw new Error("Uncaught Error: Reconciliation superseded.")
            },
        }),
        "superseded"
    )
    await assert.rejects(
        reconcileMembershipSnapshot({
            ...ports([]),
            fetchComplete: members,
            finish: async () => {
                throw new Error("Reconciliation expired.")
            },
        }),
        /expired/
    )
})
test("full reconciliations wait six hours unless invalidated, and fifteen minutes after a failed fetch", () => {
    let now = 1_000_000_000
    const schedule = new MembershipReconciliationSchedule(() => now)
    assert.equal(schedule.due("a", "manager"), true, "never reconciled")
    schedule.complete("a", "manager")
    assert.equal(schedule.due("a", "manager"), false)
    now += FULL_RECONCILIATION_GAP_MS - 1
    assert.equal(schedule.due("a", "manager"), false, "a dashboard edit waits")
    // The manager role decides dashboard access: a new one cannot wait.
    assert.equal(schedule.due("a", "other-manager"), true)
    now += 1
    assert.equal(schedule.due("a", "manager"), true, "six hours later")
    schedule.complete("a", "manager")
    schedule.invalidate("a")
    assert.equal(schedule.due("a", "manager"), true, "an invalidation clears")
    // Backoff after a failed or incomplete fetch, even across invalidations.
    schedule.fetchFailed("a")
    assert.equal(schedule.due("a", "manager"), false)
    schedule.invalidate("a")
    now += FETCH_RETRY_MS - 1
    assert.equal(schedule.due("a", "manager"), false)
    assert.equal(schedule.due("b", "manager"), true, "per guild")
    now += 1
    assert.equal(schedule.due("a", "manager"), true)
    schedule.complete("a", "manager")
    assert.equal(schedule.due("a", "manager"), false)
})
