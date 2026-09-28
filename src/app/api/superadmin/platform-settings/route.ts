import {
    isCurrentUserSuperadmin,
    getVisibleGuildsForLoggedInUser,
} from "@/lib/auth"
import { savePlatformSettings } from "@/lib/platform-settings"
import { NextResponse } from "next/server"

export async function POST(request: Request) {
    if (!(await isCurrentUserSuperadmin())) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }
    const body = (await request.json()) as {
        workspaceGuildId?: unknown
        statusChannelId?: unknown
    }
    const workspaceGuildId = String(body.workspaceGuildId ?? "").trim()
    const statusChannelId = String(body.statusChannelId ?? "").trim()
    if (!workspaceGuildId) {
        return NextResponse.json(
            { error: "Choose a workspace." },
            { status: 400 }
        )
    }
    const workspaces = await getVisibleGuildsForLoggedInUser()
    const workspace = workspaces.find(
        (item) => item.discordId === workspaceGuildId
    )
    if (!workspace?.botInside) {
        return NextResponse.json(
            { error: "Choose a workspace with the Logi bot installed." },
            { status: 400 }
        )
    }
    await savePlatformSettings({
        workspaceGuildId,
        statusChannelId: statusChannelId || undefined,
    })
    return NextResponse.json({ ok: true })
}
