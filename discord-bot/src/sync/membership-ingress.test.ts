import {
    GuildMembershipIngress,
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
test("incomplete full fetch writes nothing and successful snapshots use bounded batches", async () => {
    const calls: string[] = []
    const ports = {
        begin: async () => {
            calls.push("begin")
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
    }
    assert.equal(await reconcileMembershipSnapshot(ports), false)
    assert.deepEqual(calls, ["begin", "fetch"])
    let total = 0,
        batches = 0
    await reconcileMembershipSnapshot({
        ...ports,
        fetchComplete: async () =>
            Array.from({ length: 251 }, (_, i) => ({
                discordUserId: String(i),
                roleIds: [],
                isAdmin: false,
                hasDashboardAccess: false,
            })),
        batch: async (_id, batch, count, rows) => {
            assert.equal(count, 251)
            assert.equal(batch, batches++)
            assert.ok(rows.length <= 100)
            total += rows.length
        },
    })
    assert.equal(total, 251)
    assert.equal(batches, 3)
})
