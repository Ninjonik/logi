import { NextResponse } from "next/server"

import {
    enqueueWebhookTest,
    removeWebhook,
    rotateWebhookSigningSecret,
    updateWebhook,
} from "@/lib/webhooks"
import { getServerContext } from "@/lib/server-context"

async function admin(serverId: string) {
    return Boolean((await getServerContext(serverId))?.canAdmin)
}

export async function PATCH(
    request: Request,
    { params }: { params: Promise<{ serverId: string; webhookId: string }> }
) {
    const { serverId, webhookId } = await params
    if (!(await admin(serverId)))
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    const body = (await request.json().catch(() => null)) as {
        url?: unknown
        eventTypes?: unknown
        enabled?: unknown
        rotateSecret?: unknown
    } | null
    if (
        !body ||
        (body.url !== undefined && typeof body.url !== "string") ||
        (body.eventTypes !== undefined &&
            (!Array.isArray(body.eventTypes) ||
                !body.eventTypes.every(
                    (value) => typeof value === "string"
                ))) ||
        (body.enabled !== undefined && typeof body.enabled !== "boolean") ||
        (body.rotateSecret !== undefined &&
            typeof body.rotateSecret !== "boolean")
    )
        return NextResponse.json(
            { error: "Invalid webhook update." },
            { status: 400 }
        )
    try {
        if (body.rotateSecret)
            return NextResponse.json({
                signingSecret: await rotateWebhookSigningSecret(
                    serverId,
                    webhookId
                ),
            })
        await updateWebhook(serverId, webhookId, {
            ...(typeof body.url === "string" ? { url: body.url } : {}),
            ...(Array.isArray(body.eventTypes)
                ? { eventTypes: body.eventTypes as string[] }
                : {}),
            ...(typeof body.enabled === "boolean"
                ? { enabled: body.enabled }
                : {}),
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to update webhook.",
            },
            { status: 400 }
        )
    }
}

export async function DELETE(
    _request: Request,
    { params }: { params: Promise<{ serverId: string; webhookId: string }> }
) {
    const { serverId, webhookId } = await params
    if (!(await admin(serverId)))
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    await removeWebhook(serverId, webhookId)
    return NextResponse.json({ ok: true })
}

export async function POST(
    _request: Request,
    { params }: { params: Promise<{ serverId: string; webhookId: string }> }
) {
    const { serverId, webhookId } = await params
    if (!(await admin(serverId)))
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    await enqueueWebhookTest(serverId, webhookId)
    return NextResponse.json({ ok: true }, { status: 202 })
}
