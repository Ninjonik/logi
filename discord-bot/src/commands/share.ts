import {
    ChannelType,
    PermissionFlagsBits,
    type MessageCreateOptions,
} from "discord.js"

/** The parts of a discord.js `Guild` sharing reads. */
export type ShareGuild = {
    id: string
    channels: {
        fetch(
            id: string,
            options: { force: true }
        ): Promise<ShareChannel | null>
    }
    members: {
        fetch(options: { user: string; force: true }): Promise<unknown>
        fetchMe(options: { force: true }): Promise<unknown>
    }
}

export type ShareChannel = {
    id: string
    guildId?: string
    type: ChannelType
    permissionsFor(
        member: never
    ): { has(permissions: bigint[]): boolean } | null
    send(options: MessageCreateOptions): Promise<{ id: string; url?: string }>
}

/** A discord.js guild as {@link ShareGuild}; only text-based channels can be posted to. */
export function shareGuildOf(
    guild:
        | {
              id: string
              channels: {
                  fetch(id: string, options: { force: true }): Promise<unknown>
              }
              members: ShareGuild["members"]
          }
        | null
        | undefined
): ShareGuild | null {
    if (!guild) return null
    return {
        id: guild.id,
        channels: {
            fetch: async (id, options) => {
                const channel = await guild.channels.fetch(id, options)
                return channel &&
                    typeof channel === "object" &&
                    "send" in channel &&
                    "permissionsFor" in channel
                    ? (channel as ShareChannel)
                    : null
            },
        },
        members: guild.members,
    }
}

export type ShareResult =
    | { ok: true; channelId: string; messageId: string; url?: string }
    | { ok: false; reason: "denied" | "failed" }

/** What both the person and the bot need in the channel (M2-B03). */
export const SHARE_PERMISSIONS = [
    PermissionFlagsBits.ViewChannel,
    PermissionFlagsBits.SendMessages,
    PermissionFlagsBits.EmbedLinks,
]

/**
 * Posts a shared card ("Sdílet") after a fresh check that the person and the
 * bot may both write and embed links in the channel; a text or announcement
 * channel of the same server only. Nobody is pinged.
 */
export async function postSharedCard(input: {
    guild: ShareGuild | null | undefined
    channelId: string
    requesterId: string
    payload: MessageCreateOptions
    extraPermissions?: bigint[]
}): Promise<ShareResult> {
    const { guild } = input
    if (!guild) return { ok: false, reason: "denied" }
    let channel: ShareChannel | null
    let member: unknown
    let bot: unknown
    try {
        ;[channel, member, bot] = await Promise.all([
            guild.channels.fetch(input.channelId, { force: true }),
            guild.members.fetch({ user: input.requesterId, force: true }),
            guild.members.fetchMe({ force: true }),
        ])
    } catch {
        return { ok: false, reason: "denied" }
    }
    const thread =
        channel?.type === ChannelType.PublicThread ||
        channel?.type === ChannelType.AnnouncementThread
    const permissions = [
        ...SHARE_PERMISSIONS.map((permission) =>
            thread && permission === PermissionFlagsBits.SendMessages
                ? PermissionFlagsBits.SendMessagesInThreads
                : permission
        ),
        ...(input.extraPermissions ?? []),
    ]
    if (
        !channel ||
        (channel.guildId !== undefined && channel.guildId !== guild.id) ||
        (channel.type !== ChannelType.GuildText &&
            channel.type !== ChannelType.GuildAnnouncement &&
            !thread) ||
        !channel.permissionsFor(member as never)?.has(permissions) ||
        !channel.permissionsFor(bot as never)?.has(permissions)
    )
        return { ok: false, reason: "denied" }
    try {
        const message = await channel.send({
            ...input.payload,
            allowedMentions: { parse: [] },
        })
        return {
            ok: true,
            channelId: channel.id,
            messageId: message.id,
            url: message.url,
        }
    } catch {
        return { ok: false, reason: "failed" }
    }
}
