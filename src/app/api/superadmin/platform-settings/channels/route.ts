import {
    isCurrentUserSuperadmin,
    getVisibleGuildsForLoggedInUser,
} from "@/lib/auth"
import { platformChannelsQuerySchema } from "@/lib/validation/platform-settings"
import { fetchDiscordGuildChannels } from "@/lib/discord"
import { noStore } from "@/lib/api/superadmin-route"
import { logNextError } from "@/lib/system-logs"

/**
 * `?guildId=` lists the Discord channels of a workspace with the Logi bot,
 * so a global administrator picks the platform status channel by name.
 */
export async function GET(request: Request) {
    if (!(await isCurrentUserSuperadmin())) {
        return noStore({ error: "Forbidden." }, 403)
    }
    const parsed = platformChannelsQuerySchema.safeParse(
        Object.fromEntries(new URL(request.url).searchParams)
    )
    if (!parsed.success) {
        return noStore({ error: "Choose a workspace." }, 400)
    }
    const { guildId } = parsed.data
    const workspace = (await getVisibleGuildsForLoggedInUser()).find(
        (item) => item.discordId === guildId
    )
    if (!workspace?.botInside) {
        return noStore(
            { error: "Choose a workspace with the Logi bot installed." },
            400
        )
    }
    try {
        const channels = await fetchDiscordGuildChannels(guildId)
        return noStore({
            channels: channels.map((channel) => ({
                id: channel.id,
                name: channel.name,
                type: channel.type,
                parentId: channel.parent_id ?? undefined,
            })),
        })
    } catch (error) {
        logNextError(
            "platform-settings",
            "Failed to list Discord channels for platform settings",
            { guildId, error }
        )
        return noStore({ error: "Unable to load Discord channels." }, 502)
    }
}
