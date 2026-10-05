import type { MessageCreateOptions } from "discord.js"

import type { StatsRequest } from "../../../src/application/game-data/read-player-stats"
import { postSharedCard, shareGuildOf } from "../commands/share"

/** The parts of a discord.js `Client` publishing reads. */
export type StatsPublishClient = {
    guilds: {
        cache: {
            get(guildId: string): Parameters<typeof shareGuildOf>[0] | undefined
        }
    }
}

/**
 * Posts a shared `/stats` card (M2-23) after a fresh check that the person
 * and the bot may both write and embed links in the channel (M2-B03).
 * Throws `share_denied` when either may not, `share_failed` when Discord did
 * not take the message.
 */
export async function publishStats(
    client: StatsPublishClient,
    request: StatsRequest,
    channelId: string,
    payload: MessageCreateOptions
) {
    const result = await postSharedCard({
        guild: shareGuildOf(client.guilds.cache.get(request.guildId)),
        channelId,
        requesterId: request.requesterId,
        payload,
    })
    if (!result.ok)
        throw new Error(
            result.reason === "denied" ? "share_denied" : "share_failed"
        )
    return { messageId: result.messageId, url: result.url }
}
