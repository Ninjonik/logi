import { canPublishChannel } from "../../domain/discord-publications/channel-permissions"
import { getDiscordBotToken } from "../env"
import { z } from "zod"
const id = z.string().regex(/^\d{17,20}$/)
const bits = z.string().regex(/^\d{1,30}$/)
const channelSchema = z.object({
    id,
    guild_id: id,
    type: z.number(),
    permission_overwrites: z
        .array(z.object({ id, type: z.number(), allow: bits, deny: bits }))
        .default([]),
})
export async function verifyPublicChannel(guildId: string, channelId: string) {
    id.parse(guildId)
    id.parse(channelId)
    const get = async (path: string) => {
        const response = await fetch(`https://discord.com/api/v10${path}`, {
            headers: { Authorization: `Bot ${getDiscordBotToken()}` },
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
            redirect: "error",
        })
        if (!response.ok)
            throw new Error("Discord channel verification unavailable.")
        return response.json()
    }
    const [rawChannel, rawBot, rawRoles] = await Promise.all([
        get(`/channels/${channelId}`),
        get("/users/@me"),
        get(`/guilds/${guildId}/roles`),
    ])
    const channel = channelSchema.parse(rawChannel)
    const bot = z.object({ id }).parse(rawBot)
    if (channel.guild_id !== guildId || ![0, 5].includes(channel.type))
        throw new Error("Select a text or announcement channel in this server.")
    const member = z
        .object({
            roles: z.array(id),
            communication_disabled_until: z.string().nullable().optional(),
        })
        .parse(await get(`/guilds/${guildId}/members/${bot.id}`))
    const roles = z.array(z.object({ id, permissions: bits })).parse(rawRoles)
    const canPublish =
        !(
            member.communication_disabled_until &&
            Date.parse(member.communication_disabled_until) > Date.now()
        ) &&
        canPublishChannel(
            guildId,
            bot.id,
            member.roles,
            roles,
            channel.permission_overwrites
        )
    return { id: channel.id, guildId, type: channel.type, canPublish }
}
