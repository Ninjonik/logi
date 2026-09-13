import { ChannelType, type Client } from "discord.js"

export async function getMeetingChannelMemberIds(
    client: Pick<Client, "guilds">,
    guildId: string,
    meetingChannelId: string
) {
    const guild = await client.guilds.fetch(guildId)
    const channel = await guild.channels.fetch(meetingChannelId)
    if (
        !channel ||
        (channel.type !== ChannelType.GuildVoice &&
            channel.type !== ChannelType.GuildStageVoice)
    ) {
        throw new Error(
            "Configured meeting channel is not a voice or stage channel."
        )
    }

    return [...channel.members.keys()]
}
