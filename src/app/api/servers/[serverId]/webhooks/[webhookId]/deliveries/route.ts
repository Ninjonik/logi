import { NextResponse } from "next/server"

import { getServerContext } from "@/lib/server-context"
import { listWebhookDeliveries } from "@/lib/webhooks"

export async function GET(
    request: Request,
    { params }: { params: Promise<{ serverId: string; webhookId: string }> }
) {
    const { serverId, webhookId } = await params
    if (!(await getServerContext(serverId))?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    const cursor = new URL(request.url).searchParams.get("cursor")
    if (cursor && cursor.length > 2_048)
        return NextResponse.json({ error: "Invalid cursor." }, { status: 400 })
    try {
        return NextResponse.json(
            await listWebhookDeliveries(serverId, webhookId, cursor)
        )
    } catch {
        return NextResponse.json(
            { error: "Webhook not found." },
            { status: 404 }
        )
    }
}
