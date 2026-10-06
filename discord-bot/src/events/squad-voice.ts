/**
 * The temporary squad voice channels of a match (board L1-144, L1-146): from
 * the meeting start, one voice channel per non-empty roster squad ("F1 ·
 * Pěchota") inside the match's own category ("Čety · VLK vs ROG"). The
 * category goes right below the configured squad-voice category and copies
 * its permissions; when it cannot be created the channels go into the
 * configured category itself. Everything is removed when the match concludes.
 */

import {
    ChannelType,
    type CategoryChannel,
    type Guild,
    type GuildBasedChannel,
    type OverwriteResolvable,
} from "discord.js"

import type { EventRecord, Roster } from "../types"
import { logWarn } from "../log"

export type SquadVoiceNames = {
    /** "Čety · VLK vs ROG". */
    category: string
    /** "F1 · Pěchota". */
    squad(squad: { name: string; group?: string | null }): string
}

async function fetchChannels(guild: Guild, ids: readonly string[]) {
    const channels = await Promise.all(
        ids.map((id) =>
            guild.channels
                .fetch(id)
                .then((channel) => channel ?? null)
                .catch(() => null)
        )
    )
    return channels.filter((channel): channel is GuildBasedChannel =>
        Boolean(channel)
    )
}

/** The configured category's permission overwrites, for the match category. */
function overwritesOf(anchor: CategoryChannel | null) {
    if (!anchor) return undefined
    return anchor.permissionOverwrites.cache.map(
        (overwrite): OverwriteResolvable => ({
            id: overwrite.id,
            type: overwrite.type,
            allow: overwrite.allow.bitfield,
            deny: overwrite.deny.bitfield,
        })
    )
}

/**
 * Creates the missing squad channels (and the match category) once the
 * meeting has started, or removes them all once the match concluded. Returns
 * the IDs to store: the category and the voice channels.
 */
export async function syncSquadVoiceChannels(input: {
    guild: Guild
    event: EventRecord
    roster: Roster | undefined
    /** The server's default squad-voice category. */
    defaultCategoryId: string | undefined
    existingIds: string[]
    names: SquadVoiceNames
    now?: number
}): Promise<string[]> {
    const { guild, event, roster, existingIds, names } = input
    if (event.status === "concluded") {
        const channels = await fetchChannels(guild, existingIds)
        const remove = (channel: GuildBasedChannel) =>
            channel.delete(`Event concluded: ${event.name}`).catch(() => null)
        // The voice channels first, so none is left loose without its category.
        await Promise.all(
            channels
                .filter((channel) => channel.type !== ChannelType.GuildCategory)
                .map(remove)
        )
        await Promise.all(
            channels
                .filter((channel) => channel.type === ChannelType.GuildCategory)
                .map(remove)
        )
        return []
    }

    const anchorId = event.squadVoiceCategoryId ?? input.defaultCategoryId
    const meetingStart = new Date(event.meetingStart).getTime()
    if (
        !event.createSquadVoiceChannels ||
        !anchorId ||
        !Number.isFinite(meetingStart) ||
        (input.now ?? Date.now()) < meetingStart ||
        !roster
    ) {
        return existingIds
    }

    const existing = await fetchChannels(guild, existingIds)
    const existingNames = new Set(existing.map((channel) => channel.name))
    const missing = roster.squads.filter(
        (squad) =>
            squad.players.length > 0 &&
            !existingNames.has(names.squad(squad)) &&
            !existingNames.has(squad.name)
    )
    if (missing.length === 0) return existingIds

    const ids = [...existingIds]
    let parentId = existing.find(
        (channel) => channel.type === ChannelType.GuildCategory
    )?.id
    if (!parentId) {
        const fetched = await guild.channels.fetch(anchorId).catch(() => null)
        const anchor =
            fetched?.type === ChannelType.GuildCategory ? fetched : null
        const category = await guild.channels
            .create({
                name: names.category,
                type: ChannelType.GuildCategory,
                permissionOverwrites: overwritesOf(anchor),
                ...(anchor ? { position: anchor.rawPosition + 1 } : {}),
                reason: `Squad voice channels for ${event.name}`,
            })
            .catch((error: unknown) => {
                logWarn(
                    "event-sync",
                    "Match squad category could not be created; using the configured category",
                    {
                        eventId: event.id,
                        guildId: guild.id,
                        error:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    }
                )
                return null
            })
        if (category) ids.push(category.id)
        parentId = category?.id ?? anchorId
    }

    for (const squad of missing) {
        const channel = await guild.channels.create({
            name: names.squad(squad),
            type: ChannelType.GuildVoice,
            parent: parentId,
            reason: `Squad voice channel for ${event.name}`,
        })
        ids.push(channel.id)
    }
    return ids
}
