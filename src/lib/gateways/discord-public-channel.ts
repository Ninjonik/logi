import {
    channelPermissions,
    everyoneCanView,
} from "../../domain/discord-seed/channels"
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

const PANEL_PERMISSION_BITS = {
    view_channel: BigInt(1) << BigInt(10),
    send_messages: BigInt(1) << BigInt(11),
    embed_links: BigInt(1) << BigInt(14),
    attach_files: BigInt(1) << BigInt(15),
    read_message_history: BigInt(1) << BigInt(16),
} as const

export type PanelChannelCheck = {
    channelId: string
    /** Text (0) or announcement (5); anything else cannot hold a panel. */
    supported: boolean
    /** P2-09: each permission the panel needs, held or missing. */
    permissions: Record<keyof typeof PANEL_PERMISSION_BITS, boolean>
    /** P2-10, P2-37: whether `@everyone` can view; a password needs false. */
    everyoneCanView: boolean
    /** The bot is timed out in this server. */
    timedOut: boolean
}

/**
 * "Ověřit" in the panel editor (P2-08..10, P2-B02): every permission the bot
 * needs in the channel and whether the channel is private, read with the
 * bot's token. The same privacy rule as the seed channels (W4).
 */
export async function inspectPanelChannel(
    guildId: string,
    channelId: string
): Promise<PanelChannelCheck> {
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
    if (channel.guild_id !== guildId)
        throw new Error("Select a channel in this server.")
    const member = z
        .object({
            roles: z.array(id),
            communication_disabled_until: z.string().nullable().optional(),
        })
        .parse(await get(`/guilds/${guildId}/members/${bot.id}`))
    const roles = z
        .array(
            z.object({
                id,
                permissions: bits,
                position: z.number().default(0),
                mentionable: z.boolean().default(false),
                managed: z.boolean().default(false),
            })
        )
        .parse(rawRoles)
    const overwrites = channel.permission_overwrites
    const granted = channelPermissions({
        guildId,
        memberId: bot.id,
        memberRoleIds: member.roles,
        roles,
        overwrites,
    })
    return {
        channelId: channel.id,
        supported: [0, 5].includes(channel.type),
        permissions: Object.fromEntries(
            Object.entries(PANEL_PERMISSION_BITS).map(([name, bit]) => [
                name,
                (granted & bit) === bit,
            ])
        ) as PanelChannelCheck["permissions"],
        everyoneCanView: everyoneCanView(guildId, roles, overwrites),
        timedOut: Boolean(
            member.communication_disabled_until &&
            Date.parse(member.communication_disabled_until) > Date.now()
        ),
    }
}
