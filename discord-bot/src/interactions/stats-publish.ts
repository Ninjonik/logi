import { ChannelType, PermissionFlagsBits, type Client } from "discord.js"
import type { StatsPorts } from "./stats"

/** A fresh permission check is required for both the human and the bot. */
export async function publishStats(
    client: Client,
    ...[request, channelId, payload]: Parameters<StatsPorts["share"]>
) {
    const guild = client.guilds.cache.get(request.guildId)
    if (!guild) throw new Error("share_denied")
    const [channel, member, bot] = await Promise.all([
        guild.channels.fetch(channelId, { force: true }),
        guild.members.fetch({ user: request.requesterId, force: true }),
        guild.members.fetchMe({ force: true }),
    ])
    const permissions = [
        PermissionFlagsBits.ViewChannel,
        PermissionFlagsBits.SendMessages,
        PermissionFlagsBits.EmbedLinks,
        ...(payload.files?.length ? [PermissionFlagsBits.AttachFiles] : []),
    ]
    if (
        !channel ||
        channel.guildId !== request.guildId ||
        (channel.type !== ChannelType.GuildText &&
            channel.type !== ChannelType.GuildAnnouncement) ||
        !channel.permissionsFor(member)?.has(permissions) ||
        !channel.permissionsFor(bot)?.has(permissions)
    )
        throw new Error("share_denied")
    await channel.send({ ...payload, allowedMentions: { parse: [] } })
}
