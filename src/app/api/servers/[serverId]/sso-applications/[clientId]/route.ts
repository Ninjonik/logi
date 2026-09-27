import { NextResponse } from "next/server"

import { getServerContext } from "@/lib/server-context"
import { removeSsoApplication } from "@/lib/sso-server"
import { handleIfNotLoggedIn } from "@/lib/auth"

export async function DELETE(
    _request: Request,
    context: { params: Promise<{ serverId: string; clientId: string }> }
) {
    const { serverId, clientId } = await context.params
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`)
    const server = await getServerContext(serverId)
    if (!server?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    await removeSsoApplication(serverId, server.user.discordId, clientId)
    return NextResponse.json({ ok: true })
}
