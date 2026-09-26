import { NextResponse } from "next/server"

import { createWebhook, listWebhooks } from "@/lib/webhooks"
import { getServerContext } from "@/lib/server-context"

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    if (!(await getServerContext(serverId))?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    return NextResponse.json({ data: await listWebhooks(serverId) })
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await params
    if (!(await getServerContext(serverId))?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    const body = (await request.json().catch(() => null)) as {
        url?: unknown
        eventTypes?: unknown
    } | null
    if (
        typeof body?.url !== "string" ||
        !Array.isArray(body.eventTypes) ||
        !body.eventTypes.every((type) => typeof type === "string")
    )
        return NextResponse.json(
            { error: "A URL and event types are required." },
            { status: 400 }
        )
    try {
        return NextResponse.json(
            await createWebhook(serverId, body.url, body.eventTypes),
            { status: 201 }
        )
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to create webhook.",
            },
            { status: 400 }
        )
    }
}
