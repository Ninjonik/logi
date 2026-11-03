import { bugReportAccess } from "@/lib/gateways/bug-reports"
import { makeFunctionReference } from "convex/server"
import { noStore } from "@/lib/api/superadmin-route"
import { fetchQuery } from "convex/nextjs"

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string; index: string }> }
) {
    const access = await bugReportAccess(true)
    if (!access) return noStore({ error: "forbidden" }, 403)
    const { id, index } = await context.params
    if (!/^\d+$/.test(index)) return noStore({ error: "not_found" }, 404)
    const file = (await fetchQuery(
        makeFunctionReference<"query">("bugReports:attachment"),
        { ...access, id, index: Number(index) }
    )) as { name: string; url: string | null } | null
    if (!file?.url) return noStore({ error: "not_found" }, 404)
    const response = await fetch(file.url)
    if (!response.ok) return noStore({ error: "not_found" }, 404)
    return new Response(response.body, {
        headers: {
            "Content-Type": "application/octet-stream",
            "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    })
}
