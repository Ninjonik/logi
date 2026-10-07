import { NextResponse } from "next/server"

import {
    ssoApplicationUpdateSchema,
    ssoClientIdSchema,
} from "@/lib/validation/sso-application"
import { removeSsoApplication, updateSsoApplication } from "@/lib/sso-server"
import { isDashboardWriteOrigin } from "@/lib/api/dashboard-write-origin"
import { readBoundedJson } from "@/lib/api/request-json"
import { getServerContext } from "@/lib/server-context"
import { handleIfNotLoggedIn } from "@/lib/auth"

type Context = { params: Promise<{ serverId: string; clientId: string }> }

export async function PATCH(request: Request, context: Context) {
    const { serverId, clientId } = await context.params
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`)
    if (!isDashboardWriteOrigin(request))
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    const server = await getServerContext(serverId)
    if (!server?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    const body = await readBoundedJson(request, 32_768).catch(() => null)
    const input = ssoApplicationUpdateSchema.safeParse(body)
    if (!ssoClientIdSchema.safeParse(clientId).success || !input.success)
        return NextResponse.json(
            { error: "Invalid application." },
            { status: 400 }
        )
    try {
        await updateSsoApplication({
            guildId: serverId,
            userId: server.user.discordId,
            clientId,
            ...input.data,
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error && error.message.startsWith("Use ")
                        ? error.message
                        : "Unable to update SSO application.",
            },
            { status: 400 }
        )
    }
}

export async function DELETE(_request: Request, context: Context) {
    const { serverId, clientId } = await context.params
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`)
    const server = await getServerContext(serverId)
    if (!server?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    await removeSsoApplication(serverId, server.user.discordId, clientId)
    return NextResponse.json({ ok: true })
}
