import { PermissionFlagsBits } from "discord.js"

import {
    decideCommandUse,
    type CommandAccessConfig,
    type CommandCaller,
    type CommandDecision,
} from "../../../src/domain/discord-commands/permissions"
import {
    commandAccessConfig,
    type GuildCommandConfig,
} from "../../../src/domain/discord-commands/guild-config"
import {
    commandDecisionCard,
    verifyFailedCard,
} from "../../../src/domain/discord-commands/access-view"
import { DEFAULT_COMMAND_SETTINGS } from "../../../src/domain/discord-commands/command-settings"
import type { ConfigurableCommand } from "../../../src/domain/discord-commands/catalog"
import type { MessageView } from "../../../src/domain/discord-messages/message-view"
import { getCommandMessages } from "../../../src/lib/clan-language/commands"
import { replyError, type PrivateReplyTarget } from "../ui/replies"
import type { GuildCommandConfigs } from "./guild-configs"
import { fallbackGuildLanguage } from "./definitions"

/** The parts of a discord.js `Guild` the fresh check reads. */
export type FreshGuild = {
    ownerId?: string | null
    /** The server's community language, used only without Logi settings. */
    preferredLocale?: string | null
    fetch(): Promise<{
        ownerId?: string | null
        roles: { fetch(): Promise<unknown> }
        members: {
            fetch(options: { user: string; force: true }): Promise<{
                permissions: { has(permission: bigint): boolean }
                roles: { cache: { keys(): Iterable<string> } }
            }>
        }
    }>
}

/**
 * The person as Discord sees them right now (M1-B04): the guild, its role
 * definitions and the member are read fresh, never from the cache, so a
 * removed role or permission counts immediately. Null when Discord does not
 * answer; the command then refuses rather than guess.
 */
export async function readFreshCaller(
    guild: FreshGuild | null | undefined,
    userId: string
): Promise<CommandCaller | null> {
    if (!guild) return null
    try {
        const fresh = await guild.fetch()
        await fresh.roles.fetch()
        const member = await fresh.members.fetch({ user: userId, force: true })
        return {
            isAdministrator:
                fresh.ownerId === userId ||
                member.permissions.has(PermissionFlagsBits.Administrator),
            roleIds: [...member.roles.cache.keys()],
        }
    } catch {
        return null
    }
}

/** A server without Logi settings: the design defaults and no roles. */
export function defaultAccessConfig(): CommandAccessConfig {
    return {
        dashboardAdminRoleId: null,
        clanRoleIds: [],
        ticketSupportRoleIds: [],
        membershipSupportRoleIds: [],
        ticketsEnabled: false,
        membershipEnabled: false,
        settings: DEFAULT_COMMAND_SETTINGS,
    }
}

/** What a command handler needs after the check passed. */
export type CommandAccess = {
    language: string
    config: GuildCommandConfig | null
    access: CommandAccessConfig
    /** Present when the check needed Discord's facts (a restricted group). */
    caller: CommandCaller | null
}

export type AccessInteraction = PrivateReplyTarget & {
    guildId: string | null
    channelId: string | null
    user: { id: string }
    guild?: FreshGuild | null
    channel?: { isThread?(): boolean; parentId?: string | null } | null
}

export type AccessDeps = {
    configs: Pick<GuildCommandConfigs, "get">
    readCaller?: typeof readFreshCaller
    /** A command's own wording of a refusal; the shared cards otherwise. */
    refusal?: (
        decision: Exclude<CommandDecision, { kind: "allowed" }>,
        language: string,
        config: GuildCommandConfig | null
    ) => MessageView
}

/**
 * The one check every configurable command runs first (M1-03, M1-21): the
 * clan's switch, the group with its extra roles from fresh Discord facts,
 * and the allowed channels. A refusal is answered privately with the shared
 * error card in the clan language and ends the command (returns null).
 */
export async function checkCommandAccess(
    interaction: AccessInteraction,
    command: ConfigurableCommand,
    deps: AccessDeps
): Promise<CommandAccess | null> {
    const config = await deps.configs.get(interaction.guildId)
    const language =
        config?.language ??
        fallbackGuildLanguage(interaction.guild?.preferredLocale)
    const access = config ? commandAccessConfig(config) : defaultAccessConfig()
    const entry = access.settings[command]
    const copy = getCommandMessages(language).access
    const options = { language, style: config?.messageStyle }
    let caller: CommandCaller | null = null
    if (entry.enabled && entry.audience !== "everyone") {
        caller = await (deps.readCaller ?? readFreshCaller)(
            interaction.guild,
            interaction.user.id
        )
        if (!caller) {
            await replyError(interaction, verifyFailedCard(copy), options)
            return null
        }
    }
    const channel = interaction.channel
    const decision = decideCommandUse(command, {
        caller: caller ?? { isAdministrator: false, roleIds: [] },
        config: access,
        channelId: interaction.channelId,
        parentChannelId: channel?.isThread?.() ? channel.parentId : null,
    })
    if (decision.kind !== "allowed") {
        await replyError(
            interaction,
            deps.refusal?.(decision, language, config) ??
                commandDecisionCard(decision, { command, copy }),
            options
        )
        return null
    }
    return { language, config, access, caller }
}
