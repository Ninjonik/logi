import {
    fetchDiscordGuildChannels,
    fetchDiscordGuildRoles,
} from "@/lib/discord"
import { appCacheTags, cachedRead } from "@/lib/cache-tags"

const CHANNEL_NAMES_REVALIDATE_SECONDS = 5 * 60

/**
 * Names of a clan's Discord channels by ID, for lists that show a stored
 * channel ID. Discord is asked at most every few minutes; when it cannot be
 * reached the map is empty and callers show their fallback.
 */
export async function getDiscordChannelNames(
    serverId: string,
    discordGuildId: string
): Promise<Map<string, string>> {
    try {
        const entries = await cachedRead(
            ["discord-channel-names:v1", discordGuildId],
            [appCacheTags.server(serverId)],
            async () =>
                (await fetchDiscordGuildChannels(discordGuildId)).map(
                    (channel) => [channel.id, channel.name] as const
                ),
            CHANNEL_NAMES_REVALIDATE_SECONDS
        )
        return new Map(
            entries.filter(
                (entry): entry is readonly [string, string] =>
                    typeof entry[1] === "string" && entry[1].length > 0
            )
        )
    } catch {
        return new Map()
    }
}

/** Names of a clan's Discord roles by ID, cached like the channel names. */
export async function getDiscordRoleNames(
    serverId: string,
    discordGuildId: string
): Promise<Map<string, string>> {
    try {
        const entries = await cachedRead(
            ["discord-role-names:v1", discordGuildId],
            [appCacheTags.server(serverId)],
            async () =>
                (await fetchDiscordGuildRoles(discordGuildId)).map(
                    (role) => [role.id, role.name] as const
                ),
            CHANNEL_NAMES_REVALIDATE_SECONDS
        )
        return new Map(
            entries.filter(
                (entry): entry is readonly [string, string] =>
                    typeof entry[1] === "string" && entry[1].length > 0
            )
        )
    } catch {
        return new Map()
    }
}
