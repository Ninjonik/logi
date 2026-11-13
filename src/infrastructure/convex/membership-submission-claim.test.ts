import { releaseApplicationSubmission } from "../../../convex/membershipApplications"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"

test("a stale submission worker cannot release a newer claimed draft", async (t) => {
    const previousSecret = process.env.INTERNAL_AUTH_SECRET
    process.env.INTERNAL_AUTH_SECRET = "test-secret"
    t.after(() => {
        if (previousSecret === undefined)
            delete process.env.INTERNAL_AUTH_SECRET
        else process.env.INTERNAL_AUTH_SECRET = previousSecret
    })
    const ctx = testContext()
    ctx.db.seed("membershipApplicationFormDrafts", {
        _id: "membershipApplicationFormDrafts:draft",
        source: "web",
        submissionStatus: "claimed",
        submissionClaimToken: "new-owner",
    })
    const result = await invoke(releaseApplicationSubmission, ctx, {
        secret: "test-secret",
        draftId: "membershipApplicationFormDrafts:draft",
        claimToken: "old-owner",
        error: "guild",
    })
    assert.deepEqual(result, { ok: false })
    assert.equal(
        (await ctx.db.get("membershipApplicationFormDrafts:draft"))
            ?.submissionStatus,
        "claimed"
    )
})
