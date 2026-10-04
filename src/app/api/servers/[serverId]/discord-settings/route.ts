import { NextResponse } from "next/server"

import { invalidPublicationDestination } from "@/domain/discord-publications/destinations"
import { discordSettingsSchema } from "@/lib/validation/discord-settings"
import { appCacheTags, revalidateCacheEntries } from "@/lib/cache-tags"
import { saveDiscordConfig } from "@/lib/server-discord-settings"
import { logNextError, logNextInfo } from "@/lib/system-logs"
import { fetchDiscordGuildChannels } from "@/lib/discord"
import { getServerContext } from "@/lib/server-context"
import { handleIfNotLoggedIn } from "@/lib/auth"

export async function POST(
    request: Request,
    context: { params: Promise<{ serverId: string }> }
) {
    const { serverId } = await context.params
    await handleIfNotLoggedIn(`/dashboard/servers/${serverId}/settings`)

    const serverContext = await getServerContext(serverId)
    if (!serverContext?.canAdmin) {
        return NextResponse.json({ error: "Forbidden." }, { status: 403 })
    }

    try {
        const json = await request.json()
        const parsed = discordSettingsSchema.safeParse(json)

        if (!parsed.success) {
            return NextResponse.json(
                {
                    error:
                        parsed.error.issues[0]?.message ??
                        "Invalid Discord settings.",
                },
                { status: 400 }
            )
        }

        const invalidChannel = invalidPublicationDestination(
            parsed.data,
            await fetchDiscordGuildChannels(serverContext.server.discordId)
        )
        if (invalidChannel)
            return NextResponse.json(
                {
                    error:
                        invalidChannel.purpose === "private-thread"
                            ? "Ticket and application parents must be text channels in this Discord server."
                            : "Select a text or announcement channel in this Discord server.",
                },
                { status: 400 }
            )

        await saveDiscordConfig({
            guildId: serverId,
            ...parsed.data,
        })

        revalidateCacheEntries([
            appCacheTags.serverContext(serverId),
            appCacheTags.discordConfig(serverId),
        ])

        logNextInfo("discord-settings", "Saved Discord settings", {
            serverId,
            userId: serverContext.user.discordId,
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        logNextError("discord-settings", "Failed to save Discord settings", {
            serverId,
            error,
        })
        return NextResponse.json(
            { error: "Unable to save Discord settings." },
            { status: 500 }
        )
    }
}
