"use node"

import {
    githubConfig,
    githubRequest,
    issueSchema,
    githubComments,
    githubIssuePort,
} from "../src/infrastructure/github/issues"
import { syncGithubReport } from "../src/application/bug-reports/sync-github"
import { assertSessionGateway } from "./dashboardSessionStore"
import { internalAction, action } from "./_generated/server"
import { makeFunctionReference } from "convex/server"
import type { Doc } from "./_generated/dataModel"
import { v } from "convex/values"

const claim = makeFunctionReference<"mutation", {}, Doc<"bugReports"> | null>(
    "bugReportGithubStore:claim"
)
const finish = makeFunctionReference<"mutation">("bugReportGithubStore:finish")
export const sync = internalAction({
    args: {},
    handler: async (ctx) => {
        const config = githubConfig()
        if (!config) return
        for (let i = 0; i < 10; i++) {
            const report = await ctx.runMutation(claim, {})
            if (!report) break
            try {
                const result = await syncGithubReport(
                    report,
                    config.repository,
                    githubIssuePort
                )
                await ctx.runMutation(finish, {
                    id: report._id,
                    lease: report.githubLease!,
                    repository: config.repository,
                    ...result,
                })
            } catch (error) {
                await ctx.runMutation(finish, {
                    id: report._id,
                    lease: report.githubLease!,
                    revision: report.githubRevision ?? 0,
                    repository: config.repository,
                    error:
                        error instanceof Error
                            ? error.message
                            : "GitHub sync failed",
                })
                break
            }
        }
    },
})
export const refresh = action({
    args: { secret: v.string(), repository: v.string(), number: v.number() },
    handler: async (ctx, args) => {
        assertSessionGateway(args.secret)
        const config = githubConfig()
        if (
            !config ||
            config.repository.toLowerCase() !== args.repository.toLowerCase()
        )
            throw new Error("Repository mismatch")
        const issue = issueSchema.parse(
            await githubRequest(`issues/${args.number}`)
        )
        const comments = await githubComments(args.number)
        await ctx.runMutation(
            makeFunctionReference<"mutation">("bugReportGithubStore:receive"),
            {
                secret: args.secret,
                repository: config.repository,
                number: args.number,
                state: issue.state,
                updatedAt: issue.updated_at,
                comments: comments.slice(-100).map((c) => ({
                    id: c.id,
                    body: c.body.slice(0, 10000),
                    author: c.user?.login ?? "GitHub",
                })),
            }
        )
    },
})
