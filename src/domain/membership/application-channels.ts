import {
    channelPermissions,
    type DiscordOverwrite,
    type DiscordRole,
} from "../discord-seed/channels"

/**
 * The inline checks of the application settings (N4-05, N4-06, N4-B08):
 * "Bot tu může psát a vkládat obrázky." for the panel channel and "Bot tu
 * může zakládat soukromá vlákna." for the thread channel, from the bot's
 * roles and the channels' overwrites as Discord reports them.
 */

const bit = (index: number) => BigInt(1) << BigInt(index)

export const APPLICATION_CHANNEL_PERMISSIONS = {
    viewChannel: bit(10),
    sendMessages: bit(11),
    embedLinks: bit(14),
    attachFiles: bit(15),
    readMessageHistory: bit(16),
    manageThreads: bit(34),
    createPrivateThreads: bit(36),
    sendMessagesInThreads: bit(38),
} as const

const P = APPLICATION_CHANNEL_PERMISSIONS
/** The panel: post, embed images and read the message it edits. */
export const PANEL_PERMISSIONS =
    P.viewChannel |
    P.sendMessages |
    P.embedLinks |
    P.attachFiles |
    P.readMessageHistory
/** Private threads: create them, write in them, lock and archive them. */
export const THREAD_PERMISSIONS =
    P.viewChannel |
    P.createPrivateThreads |
    P.sendMessagesInThreads |
    P.manageThreads

export type ApplicationChannelInput = {
    overwrites: readonly DiscordOverwrite[]
    /** Missing, foreign or not a text channel. */
    unusable?: boolean
} | null

export type ApplicationChannelReport = {
    panel: { ok: boolean } | null
    threads: { ok: boolean } | null
}

export function checkApplicationChannels(input: {
    guildId: string
    bot: { id: string; roleIds: readonly string[] }
    roles: readonly DiscordRole[]
    panelChannel: ApplicationChannelInput
    threadChannel: ApplicationChannelInput
}): ApplicationChannelReport {
    const allows = (channel: ApplicationChannelInput, needed: bigint) => {
        if (!channel) return null
        if (channel.unusable) return { ok: false }
        const permissions = channelPermissions({
            guildId: input.guildId,
            memberId: input.bot.id,
            memberRoleIds: input.bot.roleIds,
            roles: input.roles,
            overwrites: channel.overwrites,
        })
        return { ok: (permissions & needed) === needed }
    }
    return {
        panel: allows(input.panelChannel, PANEL_PERMISSIONS),
        threads: allows(input.threadChannel, THREAD_PERMISSIONS),
    }
}
