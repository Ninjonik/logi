import { seedDashboardActor } from "./testing/dashboard-actor"
import { testContext, invoke } from "./testing/database"
import * as reports from "../../../convex/bugReports"
import assert from "node:assert/strict"
import test from "node:test"

const secret = "synthetic-bug-report-secret"
function fixture() {
    process.env.INTERNAL_AUTH_SECRET = secret
    const ctx = testContext()
    const actor = { ...seedDashboardActor(ctx.db) }
    return { ctx, actor, secret }
}
const input = {
    title: "Save button broken",
    message: "The save button does not respond.",
    server: "Example server",
}
test("a signed-in account can report without workspace admin authority", async () => {
    const { ctx, ...access } = fixture()
    ctx.db.tables.discordMemberAccess = []
    const id = await invoke(reports.create, ctx, {
        ...access,
        input,
        attachments: [],
    })
    assert.equal((await ctx.db.get(id))?.reporter, access.actor.subject)
    assert.equal((await ctx.db.get(id))?.status, "new")
})
test("inbox, status updates and attachment reads reject ordinary users", async () => {
    const { ctx, ...access } = fixture()
    await assert.rejects(
        invoke(reports.list, ctx, {
            ...access,
            paginationOpts: { numItems: 25, cursor: null },
        }),
        /Forbidden/
    )
    await assert.rejects(
        invoke(reports.updateStatus, ctx, {
            ...access,
            id: "bugReports:x",
            status: "resolved",
        }),
        /Forbidden/
    )
    await assert.rejects(
        invoke(reports.attachment, ctx, {
            ...access,
            id: "bugReports:x",
            index: 0,
        }),
        /Forbidden/
    )
})
test("superadmins can review and update reports", async () => {
    const { ctx, ...access } = fixture()
    const id = await invoke(reports.create, ctx, {
        ...access,
        input,
        attachments: [],
    })
    access.actor.superadmin = true
    const result = await invoke(reports.list, ctx, {
        ...access,
        paginationOpts: { numItems: 25, cursor: null },
    })
    assert.equal(result.page.length, 1)
    await invoke(reports.updateStatus, ctx, {
        ...access,
        id,
        status: "investigating",
    })
    assert.equal((await ctx.db.get(id))?.status, "investigating")
})
test("revoked sessions and incorrect gateway secrets cannot submit or review", async () => {
    const { ctx, ...access } = fixture()
    await assert.rejects(
        invoke(reports.create, ctx, {
            ...access,
            secret: "invalid",
            input,
            attachments: [],
        }),
        /Unauthorized/
    )
    ctx.db.tables.dashboardSessions[0].revokedAt = Date.now()
    await assert.rejects(
        invoke(reports.create, ctx, { ...access, input, attachments: [] }),
        /Forbidden/
    )
    access.actor.superadmin = true
    await assert.rejects(
        invoke(reports.list, ctx, {
            ...access,
            paginationOpts: { numItems: 25, cursor: null },
        }),
        /Forbidden/
    )
})
