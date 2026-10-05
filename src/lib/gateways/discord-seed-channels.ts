import { z } from "zod"

import {
    checkSeedChannels,
    type SeedChannelReport,
} from "@/domain/discord-seed/channels"
import type { SeedPlanSettings } from "@/domain/discord-seed/plan"
import { getDiscordBotToken } from "@/lib/env"

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
const roleSchema = z.object({
    id,
    permissions: bits,
    position: z.number().int(),
    mentionable: z.boolean(),
    managed: z.boolean(),
})
const memberSchema = z.object({
    roles: z.array(id),
    communication_disabled_until: z.string().nullable().optional(),
})
/** Text and announcement channels can carry the call and the control message. */
const MESSAGE_CHANNEL_TYPES = [0, 5]

/**
 * Reads the plan's channels and role from Discord with the bot token and
 * checks them (P3-12, P3-13, P3-22). A missing or foreign channel reads as
 * unpublishable; any other Discord failure throws, and the route answers that
 * verification is unavailable.
 */
export async function verifySeedChannels(
    guildId: string,
    settings: Pick<
        SeedPlanSettings,
        "seedChannelId" | "controlChannelId" | "seedRoleId" | "roleSelfService"
    >
): Promise<SeedChannelReport> {
    id.parse(guildId)
    const token = getDiscordBotToken()
    if (!token) throw new Error("Discord bot token is not configured.")
    const get = async (path: string, optional = false) => {
        const response = await fetch(`https://discord.com/api/v10${path}`, {
            headers: { Authorization: `Bot ${token}` },
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
            redirect: "error",
        })
        if (optional && (response.status === 404 || response.status === 403))
            return null
        if (!response.ok)
            throw new Error("Discord channel verification unavailable.")
        return (await response.json()) as unknown
    }
    const channel = async (channelId: string | null) => {
        if (!channelId) return null
        const raw = await get(`/channels/${id.parse(channelId)}`, true)
        const parsed = raw === null ? null : channelSchema.parse(raw)
        // Unreadable, foreign or non-text channels cannot carry a message.
        return parsed?.guild_id === guildId &&
            MESSAGE_CHANNEL_TYPES.includes(parsed.type)
            ? { overwrites: parsed.permission_overwrites }
            : { overwrites: [], unusable: true }
    }
    const [bot, rawRoles, seedChannel, controlChannel] = await Promise.all([
        get("/users/@me").then((raw) => z.object({ id }).parse(raw)),
        get(`/guilds/${guildId}/roles`).then((raw) =>
            z.array(roleSchema).parse(raw)
        ),
        channel(settings.seedChannelId),
        channel(settings.controlChannelId),
    ])
    const member = memberSchema.parse(
        await get(`/guilds/${guildId}/members/${bot.id}`)
    )
    const report = checkSeedChannels({
        guildId,
        bot: { id: bot.id, roleIds: member.roles },
        roles: rawRoles,
        seedChannel,
        controlChannel,
        roleId: settings.seedRoleId,
        roleSelfService: settings.roleSelfService,
    })
    const timedOut = Boolean(
        member.communication_disabled_until &&
        Date.parse(member.communication_disabled_until) > Date.now()
    )
    const problems = new Set(report.problems)
    if (report.seedChannel && (timedOut || seedChannel?.unusable)) {
        report.seedChannel.canPublish = false
        problems.add("seed_channel_unpublishable")
    }
    if (report.controlChannel && (timedOut || controlChannel?.unusable)) {
        report.controlChannel.canPublish = false
        problems.add("control_channel_unpublishable")
    }
    return { ...report, problems: [...problems] }
}
