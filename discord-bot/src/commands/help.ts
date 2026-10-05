import { MessageFlags, type ChatInputCommandInteraction } from "discord.js"

import {
    commandDecisionCard,
    notConnectedCard,
    verifyFailedCard,
} from "../../../src/domain/discord-commands/access-view"
import {
    defaultAccessConfig,
    readFreshCaller,
    type AccessInteraction,
    type FreshGuild,
} from "./access"
import {
    decideCommandUse,
    helpCommandsFor,
} from "../../../src/domain/discord-commands/permissions"
import { commandAccessConfig } from "../../../src/domain/discord-commands/guild-config"
import { buildHelpView } from "../../../src/domain/discord-commands/help-view"
import { getCommandMessages } from "../../../src/lib/clan-language/commands"
import type { InteractionFeature } from "../interactions/registry"
import type { GuildCommandConfigs } from "./guild-configs"
import { replyError, replyPrivately } from "../ui/replies"
import { fallbackGuildLanguage } from "./definitions"

/** The wiki page about commands that "Návod na webu" opens (M2-08). */
export function commandsGuideUrl(siteUrl: string) {
    return `${siteUrl.replace(/\/+$/, "")}/wiki/configuration/commands`
}

export type HelpDeps = {
    configs: Pick<GuildCommandConfigs, "get">
    workspaceOf(guildId: string): Promise<{ workspaceId: string } | null>
    readCaller?: typeof readFreshCaller
    siteUrl: string
}

type HelpInteraction = AccessInteraction &
    Pick<ChatInputCommandInteraction, "deferReply"> & {
        guild?: (FreshGuild & { name?: string }) | null
    }

/**
 * `/help` (M2 1.1): a private overview of only the commands this person may
 * use, in the clan language, with "Návod na webu". It reads the person's
 * roles freshly from Discord, never posts to a channel and has no options.
 * A server without Logi gets "Logi tu ještě není nastavené".
 */
export async function handleHelpCommand(
    interaction: HelpInteraction,
    deps: HelpDeps
) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral })
    const guildId = interaction.guildId
    const config = await deps.configs.get(guildId)
    const language =
        config?.language ??
        fallbackGuildLanguage(interaction.guild?.preferredLocale)
    const copy = getCommandMessages(language)
    const options = { language, style: config?.messageStyle }
    // A workspace without saved Discord settings still has its commands.
    if (!config && !(guildId && (await deps.workspaceOf(guildId)))) {
        await replyPrivately(
            interaction,
            notConnectedCard(copy.access, deps.siteUrl),
            options
        )
        return
    }
    const access = config ? commandAccessConfig(config) : defaultAccessConfig()
    const caller = await (deps.readCaller ?? readFreshCaller)(
        interaction.guild,
        interaction.user.id
    )
    if (!caller) {
        await replyError(interaction, verifyFailedCard(copy.access), options)
        return
    }
    const channel = interaction.channel
    const decision = decideCommandUse("help", {
        caller,
        config: access,
        channelId: interaction.channelId,
        parentChannelId: channel?.isThread?.() ? channel.parentId : null,
    })
    if (decision.kind !== "allowed") {
        await replyError(
            interaction,
            commandDecisionCard(decision, {
                command: "help",
                copy: copy.access,
            }),
            options
        )
        return
    }
    await replyPrivately(
        interaction,
        buildHelpView({
            copy: copy.help,
            clanName: interaction.guild?.name?.trim() || "Logi",
            list: helpCommandsFor(caller, access),
            channels: {
                recruitment: config?.membershipEnabled
                    ? config.membershipSubmitChannelId
                    : null,
                tickets: config?.ticketsEnabled
                    ? config.ticketSubmitChannelId
                    : null,
                announcements: config?.announcementsChannelId,
            },
            guideUrl: commandsGuideUrl(deps.siteUrl),
        }),
        options
    )
}

/** Routes `/help` through the interaction registry. */
export function helpInteractions(deps: () => HelpDeps): InteractionFeature {
    return {
        name: "help",
        register(registry) {
            registry.command("help", (interaction) =>
                handleHelpCommand(interaction, deps())
            )
        },
    }
}
