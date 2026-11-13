import { closeTicketThread } from "../../../convex/discordMembership"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

test("ticket close reports a concurrent completed close without overwriting it", async (t) => {
    const previousSecret = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "test-secret"
    t.after(() => {
        if (previousSecret === undefined)
            delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previousSecret
    })
    const ctx = testContext()
    ctx.db.seed("ticketThreads", {
        _id: "ticketThreads:one",
        threadId: "thread",
        status: "closed",
        closedByUserId: "first",
    })
    const result = await invoke(closeTicketThread, ctx, {
        secret: "test-secret",
        threadId: "thread",
        closedByUserId: "second",
    })
    assert.deepEqual(result, { ok: false })
    assert.equal(
        (await ctx.db.get("ticketThreads:one"))?.closedByUserId,
        "first"
    )
})
