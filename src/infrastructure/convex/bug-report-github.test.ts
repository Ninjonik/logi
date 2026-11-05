import { receive, claim, finish } from "../../../convex/bugReportGithubStore"
import { invoke, testContext } from "./testing/database"
import assert from "node:assert/strict"
import test from "node:test"
const secret = "synthetic-github-test"
function fixture(pending = false) {
    process.env.INTERNAL_AUTH_SECRET = secret
    const ctx = testContext()
    ctx.db.seed("bugReports", {
        _id: "bugReports:one",
        githubRepository: "owner/repo",
        githubNumber: 4,
        status: "investigating",
        githubPending: pending,
        githubRevision: 2,
    })
    return ctx
}
const input = {
    secret,
    repository: "owner/repo",
    number: 4,
    state: "closed",
    updatedAt: "2026-11-05T10:00:00Z",
    comments: [],
}
test("inbound sync authenticates, scopes the repository and ignores stale state", async () => {
    const ctx = fixture()
    await assert.rejects(invoke(receive, ctx, { ...input, secret: "wrong" }))
    await invoke(receive, ctx, { ...input, repository: "other/repo" })
    assert.equal((await ctx.db.get("bugReports:one"))?.status, "investigating")
    await invoke(receive, ctx, input)
    assert.equal((await ctx.db.get("bugReports:one"))?.status, "resolved")
    await invoke(receive, ctx, {
        ...input,
        state: "open",
        updatedAt: "2026-11-04T10:00:00Z",
    })
    assert.equal((await ctx.db.get("bugReports:one"))?.status, "resolved")
    await invoke(receive, ctx, {
        ...input,
        state: "open",
        updatedAt: "2026-11-06T10:00:00Z",
    })
    assert.equal((await ctx.db.get("bugReports:one"))?.status, "new")
})
test("pending dashboard status wins; finishing an old revision preserves queued work", async () => {
    const ctx = fixture(true)
    await invoke(receive, ctx, input)
    assert.equal((await ctx.db.get("bugReports:one"))?.status, "investigating")
    const job = await invoke(claim, ctx, {})
    assert.ok(job)
    assert.equal(await invoke(claim, ctx, {}), null)
    await invoke(finish, ctx, {
        id: job._id,
        lease: job.githubLease,
        revision: 1,
        repository: "owner/repo",
    })
    assert.equal((await ctx.db.get(job._id))?.githubPending, true)
    const next = await invoke(claim, ctx, {})
    await invoke(finish, ctx, {
        id: next._id,
        lease: next.githubLease,
        revision: 2,
        repository: "owner/repo",
    })
    assert.equal((await ctx.db.get(job._id))?.githubPending, false)
})
