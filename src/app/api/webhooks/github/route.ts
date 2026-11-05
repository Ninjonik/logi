import { verifyGithubSignature } from "@/infrastructure/github/webhook"
import { makeFunctionReference } from "convex/server"
import { getInternalAuthSecret } from "@/lib/env"
import { fetchAction } from "convex/nextjs"
import { z } from "zod"

export const runtime = "nodejs"
const payloadSchema = z.object({
    repository: z.object({ full_name: z.string() }),
    issue: z
        .object({
            number: z.number().int().positive(),
            pull_request: z.unknown().optional(),
        })
        .optional(),
})
export async function POST(request: Request) {
    const secret = process.env.LOGI_GITHUB_WEBHOOK_SECRET
    const repository = process.env.LOGI_GITHUB_REPOSITORY
    if (!secret || !repository)
        return new Response("Integration unavailable", { status: 503 })
    if (Number(request.headers.get("content-length")) > 1024 * 1024)
        return new Response(null, { status: 413 })
    const body = await request.text()
    if (Buffer.byteLength(body) > 1024 * 1024)
        return new Response(null, { status: 413 })
    if (
        !verifyGithubSignature(
            body,
            request.headers.get("x-hub-signature-256"),
            secret
        )
    )
        return new Response(null, { status: 401 })
    const event = request.headers.get("x-github-event")
    if (event === "ping") return Response.json({ ok: true })
    if (event !== "issues" && event !== "issue_comment")
        return new Response(null, { status: 204 })
    let input: unknown
    try {
        input = JSON.parse(body)
    } catch {
        return new Response(null, { status: 400 })
    }
    const parsed = payloadSchema.safeParse(input)
    if (!parsed.success) return new Response(null, { status: 400 })
    const payload = parsed.data
    if (payload.repository.full_name.toLowerCase() !== repository.toLowerCase())
        return new Response(null, { status: 403 })
    if (!payload.issue || payload.issue.pull_request)
        return new Response(null, { status: 204 })
    try {
        await fetchAction(
            makeFunctionReference<"action">("bugReportGithub:refresh"),
            {
                secret: getInternalAuthSecret(),
                repository,
                number: payload.issue.number,
            }
        )
        return Response.json({ ok: true })
    } catch {
        return new Response("GitHub refresh failed; redeliver this webhook", {
            status: 503,
        })
    }
}
