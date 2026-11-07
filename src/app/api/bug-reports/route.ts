import {
    reportInput,
    reportStatus,
    validAttachment,
    MAX_ATTACHMENTS,
} from "@/domain/bug-reports/report"
import {
    bugReportAccess,
    listBugReports,
    changeBugReportStatus,
} from "@/lib/gateways/bug-reports"
import { isSameOrigin, noStore } from "@/lib/api/superadmin-route"
import { generateConvexUploadUrl } from "@/lib/server-uploads"
import { readBoundedBytes } from "@/lib/api/request-bytes"
import { makeFunctionReference } from "convex/server"
import { fetchMutation } from "convex/nextjs"
import { getSiteUrl } from "@/lib/env"
import { z } from "zod"

export async function GET(request: Request) {
    if (!(await bugReportAccess(true)))
        return noStore({ error: "forbidden" }, 403)
    return noStore(
        await listBugReports(new URL(request.url).searchParams.get("cursor"))
    )
}
export async function PATCH(request: Request) {
    if (
        !isSameOrigin(request, new URL(getSiteUrl()).origin) ||
        !(await bugReportAccess(true))
    )
        return noStore({ error: "forbidden" }, 403)
    const bytes = await readBoundedBytes(request, 4096)
    const input = z
        .object({ id: z.string().min(1), status: reportStatus })
        .safeParse(
            bytes &&
                (await new Response(bytes as BodyInit).json().catch(() => null))
        )
    if (!input.success) return noStore({ error: "invalid" }, 400)
    await changeBugReportStatus(input.data.id, input.data.status)
    return noStore({ ok: true })
}
export async function POST(request: Request) {
    if (!isSameOrigin(request, new URL(getSiteUrl()).origin))
        return noStore({ error: "forbidden" }, 403)
    const access = await bugReportAccess()
    if (!access) return noStore({ error: "forbidden" }, 403)
    const bytes = await readBoundedBytes(request, 26 * 1024 * 1024)
    if (!bytes) return noStore({ error: "attachments" }, 413)
    const stored: string[] = []
    try {
        const form = await new Response(bytes as BodyInit, {
            headers: {
                "Content-Type": request.headers.get("content-type") ?? "",
            },
        }).formData()
        const input = reportInput.safeParse({
            title: form.get("title"),
            message: form.get("message"),
            server: form.get("server") ?? "",
            occurredAt: form.get("occurredAt")
                ? Number(form.get("occurredAt"))
                : undefined,
        })
        if (!input.success)
            return noStore(
                {
                    error: input.error.issues.some(
                        (issue) => issue.path[0] === "occurredAt"
                    )
                        ? "invalid_time"
                        : "invalid",
                },
                400
            )
        if (
            input.data.occurredAt !== undefined &&
            input.data.occurredAt > Date.now() + 60000
        )
            return noStore({ error: "future_time" }, 400)
        const files = form
            .getAll("attachments")
            .filter(
                (file): file is File => file instanceof File && file.size > 0
            )
        if (
            files.length > MAX_ATTACHMENTS ||
            files.some((file) => !validAttachment(file))
        )
            return noStore({ error: "attachments" }, 400)
        const attachments = []
        for (const file of files) {
            const upload = await fetch(await generateConvexUploadUrl(), {
                method: "POST",
                headers: { "Content-Type": "application/octet-stream" },
                body: file,
            })
            if (!upload.ok) throw new Error("upload_failed")
            const result = z
                .object({ storageId: z.string() })
                .parse(await upload.json())
            stored.push(result.storageId)
            attachments.push({
                storageId: result.storageId,
                name: file.name,
                size: file.size,
            })
        }
        const id = await fetchMutation(
            makeFunctionReference<"mutation">("bugReports:create"),
            { ...access, input: input.data, attachments }
        )
        return noStore({ id }, 201)
    } catch {
        if (stored.length)
            await fetchMutation(
                makeFunctionReference<"mutation">("bugReports:cleanupUploads"),
                { ...access, ids: stored }
            ).catch(() => undefined)
        return noStore({ error: "submit_failed" }, 400)
    }
}
