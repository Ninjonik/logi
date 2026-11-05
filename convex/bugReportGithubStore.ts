import { internalMutation, mutation } from "./_generated/server"
import { reportState } from "../src/domain/bug-reports/github"
import { assertSessionGateway } from "./dashboardSessionStore"
import { v } from "convex/values"

export const claim = internalMutation({
    args: {},
    handler: async (ctx) => {
        const reports = await ctx.db
            .query("bugReports")
            .withIndex("githubPending", (q) => q.eq("githubPending", true))
            .take(25)
        const report = reports.find((r) => (r.githubLease ?? 0) < Date.now())
        if (!report) return null
        const lease = Date.now() + 300000
        await ctx.db.patch(report._id, { githubLease: lease })
        return { ...report, githubLease: lease }
    },
})
export const finish = internalMutation({
    args: {
        id: v.id("bugReports"),
        lease: v.number(),
        revision: v.number(),
        repository: v.string(),
        number: v.optional(v.number()),
        url: v.optional(v.string()),
        error: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const report = await ctx.db.get(args.id)
        if (!report || report.githubLease !== args.lease) return
        await ctx.db.patch(args.id, {
            githubLease: undefined,
            githubError: args.error,
            ...(args.number
                ? {
                      githubNumber: args.number,
                      githubUrl: args.url,
                      githubRepository: args.repository,
                  }
                : {}),
            githubPending:
                !!args.error || (report.githubRevision ?? 0) !== args.revision,
        })
    },
})
export const receive = mutation({
    args: {
        secret: v.string(),
        repository: v.string(),
        number: v.number(),
        state: v.union(v.literal("open"), v.literal("closed")),
        updatedAt: v.string(),
        comments: v.array(
            v.object({ id: v.number(), body: v.string(), author: v.string() })
        ),
    },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const report = await ctx.db
            .query("bugReports")
            .withIndex("githubIssue", (q) =>
                q
                    .eq("githubRepository", args.repository)
                    .eq("githubNumber", args.number)
            )
            .unique()
        if (
            !report ||
            (report.githubUpdatedAt && report.githubUpdatedAt > args.updatedAt)
        )
            return
        await ctx.db.patch(report._id, {
            githubComments: args.comments,
            githubUpdatedAt: args.updatedAt,
            ...(!report.githubPending
                ? { status: reportState(args.state, report.status) }
                : {}),
        })
    },
})
