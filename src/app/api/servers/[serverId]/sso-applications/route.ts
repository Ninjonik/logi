import { createSsoApplication, listSsoApplications } from "@/lib/sso-server"
import { getServerContext } from "@/lib/server-context"
import { handleIfNotLoggedIn } from "@/lib/auth"
import { NextResponse } from "next/server"

export async function GET(
    _request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await context.params
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`)
    const server = await getServerContext(serverId)
    if (!server?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    return NextResponse.json(await listSsoApplications(serverId))
}

export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await context.params
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`)
    const server = await getServerContext(serverId)
    if (!server?.canAdmin)
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    try {
        const body = (await request.json()) as {
            name?: string
            websiteUrl?: string
            redirectUris?: string[]
            backchannelLogoutUri?: string
        }
        const result = await createSsoApplication({
            guildId: serverId,
            userId: server.user.discordId,
            name: body.name ?? "",
            websiteUrl: body.websiteUrl ?? "",
            redirectUris: body.redirectUris ?? [],
            backchannelLogoutUri: body.backchannelLogoutUri,
        })
        return NextResponse.json(result, { status: 201 })
    } catch (error) {
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Unable to create SSO application.",
            },
            { status: 400 }
        )
    }
}
