import type { Report } from "@/domain/bug-reports/report"
import { currentDashboardActor } from "./dashboard-actor"
import { fetchMutation, fetchQuery } from "convex/nextjs"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "../env"
import "server-only"

export async function bugReportAccess(admin = false) {
    const actor = await currentDashboardActor()
    if (!actor || (admin && !actor.superadmin)) return null
    return { actor, secret: getInternalAuthSecret() }
}
export async function listBugReports(cursor: string | null = null) {
    const access = await bugReportAccess(true)
    if (!access) throw new Error("Forbidden.")
    return (await fetchQuery(
        makeFunctionReference<"query">("bugReports:list"),
        { ...access, paginationOpts: { numItems: 25, cursor } }
    )) as { page: Report[]; isDone: boolean; continueCursor: string }
}
export async function changeBugReportStatus(id: string, status: string) {
    const access = await bugReportAccess(true)
    if (!access) throw new Error("Forbidden.")
    await fetchMutation(
        makeFunctionReference<"mutation">("bugReports:updateStatus"),
        { ...access, id, status }
    )
}
