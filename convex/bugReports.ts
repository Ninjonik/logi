import {
    activeDashboardSession,
    assertSessionGateway,
} from "./dashboardSessionStore"
import { bugReportRepository } from "../src/infrastructure/convex/bug-report-repository"
import { submitReport } from "../src/application/bug-reports/submit-report"
import { dashboardActor, type DashboardActor } from "./dashboardActor"
import { mutation, query, type QueryCtx } from "./_generated/server"
import { paginationOptsValidator } from "convex/server"
import { v } from "convex/values"

const access = { secret: v.string(), actor: dashboardActor }
async function authorize(
    ctx: QueryCtx,
    args: { secret: string; actor: DashboardActor },
    admin = false
) {
    assertSessionGateway(args.secret)
    if (admin && !args.actor.superadmin) throw new Error("Forbidden.")
    if (
        !(await activeDashboardSession(
            ctx,
            args.actor.sid,
            args.actor.subject,
            args.actor.userRecordId
        ))
    )
        throw new Error("Forbidden.")
}
export const create = mutation({
    args: {
        ...access,
        input: v.object({
            title: v.string(),
            message: v.string(),
            server: v.string(),
            occurredAt: v.optional(v.number()),
        }),
        attachments: v.array(
            v.object({
                storageId: v.string(),
                name: v.string(),
                size: v.number(),
            })
        ),
    },
    handler: async (ctx, args) => {
        await authorize(ctx, args)
        return submitReport(
            bugReportRepository(ctx),
            args.actor.subject,
            args.input,
            args.attachments,
            Date.now()
        )
    },
})
export const list = query({
    args: { ...access, paginationOpts: paginationOptsValidator },
    handler: async (ctx, args) => {
        await authorize(ctx, args, true)
        return ctx.db
            .query("bugReports")
            .order("desc")
            .paginate(args.paginationOpts)
    },
})
export const updateStatus = mutation({
    args: {
        ...access,
        id: v.id("bugReports"),
        status: v.union(
            v.literal("new"),
            v.literal("investigating"),
            v.literal("resolved")
        ),
    },
    handler: async (ctx, args) => {
        await authorize(ctx, args, true)
        const report = await ctx.db.get(args.id)
        if (!report) throw new Error("Report not found")
        if (report.status === args.status) return
        await ctx.db.patch(args.id, {
            status: args.status,
            githubPending: true,
            githubRevision: (report.githubRevision ?? 0) + 1,
        })
    },
})
export const attachment = query({
    args: { ...access, id: v.id("bugReports"), index: v.number() },
    handler: async (ctx, args) => {
        await authorize(ctx, args, true)
        const report = await ctx.db.get(args.id)
        const file = report?.attachments[args.index]
        return file
            ? {
                  name: file.name,
                  url: await ctx.storage.getUrl(
                      file.storageId as import("./_generated/dataModel").Id<"_storage">
                  ),
              }
            : null
    },
})
export const cleanupUploads = mutation({
    args: { ...access, ids: v.array(v.id("_storage")) },
    handler: async (ctx, args) => {
        await authorize(ctx, args)
        for (const id of args.ids) await ctx.storage.delete(id)
    },
})
