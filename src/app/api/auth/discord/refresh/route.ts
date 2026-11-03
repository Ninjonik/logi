import { refreshManagedBotStatus } from "@/lib/gateways/bot-status-refresh"
import { revalidateCacheEntries } from "@/lib/cache-tags"
import { NextResponse } from "next/server"

import {
    getLoggedInUser,
    getVisibleGuildsForLoggedInUser,
    syncManagedGuildsForCurrentPlayer,
} from "@/lib/auth"
import { logNextError, logNextInfo } from "@/lib/system-logs"
import { isBotInsideDiscordGuild } from "@/lib/discord"

export async function POST() {
    const user = await getLoggedInUser()
    if (!user) {
        return NextResponse.json({ error: "Unauthorized." }, { status: 401 })
    }

    try {
        const visibleGuilds = await getVisibleGuildsForLoggedInUser()
        const managedGuilds = visibleGuilds.filter((guild) =>
            user.managedGuildIds.includes(guild.discordId)
        )

        await refreshManagedBotStatus(user, managedGuilds, {
            check: (guildId) =>
                isBotInsideDiscordGuild(guildId, { strict: true }),
            sync: syncManagedGuildsForCurrentPlayer,
            invalidate: revalidateCacheEntries,
        })

        logNextInfo("discord-refresh", "Refreshed Discord bot status", {
            userId: user.discordId,
            managedGuildCount: managedGuilds.length,
        })
        return NextResponse.json({ ok: true })
    } catch (error) {
        logNextError(
            "discord-refresh",
            "Failed to refresh Discord bot status",
            {
                userId: user.discordId,
                error,
            }
        )
        return NextResponse.json(
            { error: "Unable to refresh Discord bot status." },
            { status: 500 }
        )
    }
}
