import type { BugReportRepository } from "../../application/bug-reports/submit-report"
import type { MutationCtx } from "../../../convex/_generated/server"
import type { Id } from "../../../convex/_generated/dataModel"

export function bugReportRepository(ctx: MutationCtx): BugReportRepository {
    return {
        recentCount: async (reporter, since) =>
            (
                await ctx.db
                    .query("bugReports")
                    .withIndex("reporter", (q) =>
                        q.eq("reporter", reporter).gte("_creationTime", since)
                    )
                    .take(10)
            ).length,
        insert: async (report) => {
            for (const file of report.attachments) {
                const metadata = await ctx.db.system.get(
                    file.storageId as Id<"_storage">
                )
                if (!metadata || metadata.size !== file.size)
                    throw new Error("invalid_attachment")
            }
            return String(await ctx.db.insert("bugReports", report))
        },
    }
}
