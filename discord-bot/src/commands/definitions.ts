import { createHash } from "node:crypto"

import {
    ApplicationIntegrationType,
    ChannelType,
    InteractionContextType,
    Locale,
    SlashCommandBuilder,
    type RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js"

import {
    COMMAND_REASON_MAX_LENGTH,
    LOGI_COMMANDS,
    type LogiCommand,
} from "../../../src/domain/discord-commands/catalog"
import {
    getCommandMessages,
    type CommandOptionCopy,
} from "../../../src/lib/clan-language/commands"
import type { ResolvedCommandSettings } from "../../../src/domain/discord-commands/command-settings"
import { describeCommand } from "../../../src/domain/discord-commands/descriptions"
import { resolveClanLanguage } from "../../../src/lib/clan-language/core"

/**
 * The definitions of Logi's eight slash commands for one Discord server
 * (boards M1 and N3). Names are English and the same everywhere. The
 * descriptions, option names and choices are the clan language's, for the
 * whole server (M1-B02): the descriptions and choices are registered in it
 * as Discord's default with no per-reader translations, and an option keeps
 * its English key (what handlers read) while every Discord locale shows the
 * clan-language name. The commands exist only in servers (M1-B03) and stay
 * visible to everyone; permission is checked when they are used (M1-06).
 */

export type CommandDefinition = RESTPostAPIChatInputApplicationCommandsJSONBody

const DISCORD_LOCALES = Object.values(Locale)

/** The clan-language option name for every Discord locale, unless it is the key. */
function optionNameLocalizations(key: string, copy: CommandOptionCopy) {
    const name = copy.name.toLocaleLowerCase()
    if (name === key) return null
    return Object.fromEntries(DISCORD_LOCALES.map((locale) => [locale, name]))
}

type OptionTarget = {
    setName(name: string): OptionTarget
    setNameLocalizations(value: Record<string, string> | null): OptionTarget
    setDescription(description: string): OptionTarget
}

function named<T extends OptionTarget>(
    option: T,
    key: string,
    copy: CommandOptionCopy
): T {
    option.setName(key).setDescription(copy.description)
    const localizations = optionNameLocalizations(key, copy)
    if (localizations) option.setNameLocalizations(localizations)
    return option
}

function command(name: LogiCommand, description: string) {
    return new SlashCommandBuilder()
        .setName(name)
        .setDescription(description.slice(0, 100))
        .setContexts(InteractionContextType.Guild)
        .setIntegrationTypes(ApplicationIntegrationType.GuildInstall)
}

/** Every command's definition in the clan language, in the "/" menu's order. */
export function buildCommandDefinitions(input: {
    language: string | null | undefined
    settings: ResolvedCommandSettings
}): CommandDefinition[] {
    const language = resolveClanLanguage(input.language)
    const copy = getCommandMessages(language).registry
    const options = copy.options
    const outcome = getCommandMessages(language).commands
    const describe = (name: LogiCommand) =>
        describeCommand(copy, name, input.settings)
    const games = [
        { name: "Hell Let Loose", value: "hll" },
        { name: "Wardogs", value: "wardogs" },
    ]

    const definitions: Record<
        LogiCommand,
        () => { toJSON(): CommandDefinition }
    > = {
        close_application: () =>
            command("close_application", describe("close_application"))
                .addStringOption((option) =>
                    named(option, "outcome", options.closeApplicationOutcome)
                        .setRequired(true)
                        .addChoices(
                            { name: outcome.outcomeMember, value: "member" },
                            { name: outcome.outcomeRecruit, value: "recruit" },
                            {
                                name: outcome.outcomeMercenary,
                                value: "mercenary",
                            },
                            { name: outcome.outcomePending, value: "pending" },
                            { name: outcome.outcomeDenied, value: "denied" }
                        )
                )
                .addStringOption((option) =>
                    named(option, "reason", options.closeApplicationReason)
                        .setMaxLength(COMMAND_REASON_MAX_LENGTH)
                        .setRequired(false)
                ),
        close_ticket: () =>
            command("close_ticket", describe("close_ticket")).addStringOption(
                (option) =>
                    named(option, "reason", options.closeTicketReason)
                        .setMaxLength(COMMAND_REASON_MAX_LENGTH)
                        .setRequired(false)
            ),
        help: () => command("help", describe("help")),
        link: () => command("link", describe("link")),
        notice: () =>
            command("notice", describe("notice")).addStringOption((option) =>
                named(option, "event", options.noticeEvent)
                    .setRequired(true)
                    .setAutocomplete(true)
            ),
        player: () =>
            command("player", describe("player")).addStringOption((option) =>
                named(option, "player", options.playerPlayer)
                    .setRequired(true)
                    .setMaxLength(100)
                    .setAutocomplete(true)
            ),
        "server-status": () =>
            command("server-status", describe("server-status")).addStringOption(
                (option) =>
                    named(option, "game", options.serverStatusGame)
                        .setRequired(true)
                        .addChoices(
                            { name: "Hell Let Loose", value: "hell_let_loose" },
                            { name: "Wardogs", value: "wardogs" }
                        )
            ),
        stats: () =>
            command("stats", describe("stats"))
                .addStringOption((option) =>
                    named(option, "game", options.statsGame)
                        .setRequired(true)
                        .addChoices(...games)
                )
                .addUserOption((option) =>
                    named(option, "member", options.statsMember)
                )
                .addStringOption((option) =>
                    named(option, "player", options.statsPlayer)
                        .setMaxLength(100)
                        .setAutocomplete(true)
                )
                .addStringOption((option) =>
                    named(option, "period", options.statsPeriod).addChoices(
                        { name: copy.periods["7d"], value: "7d" },
                        { name: copy.periods["30d"], value: "30d" },
                        { name: copy.periods["90d"], value: "90d" },
                        { name: copy.periods.all, value: "all" }
                    )
                )
                .addStringOption((option) =>
                    named(option, "server", options.statsServer)
                        .setMaxLength(64)
                        .setAutocomplete(true)
                )
                .addChannelOption((option) =>
                    named(
                        option,
                        "channel",
                        options.statsChannel
                    ).addChannelTypes(
                        ChannelType.GuildText,
                        ChannelType.GuildAnnouncement
                    )
                ),
    }
    return LOGI_COMMANDS.map((name) => definitions[name]().toJSON())
}

/** A stable fingerprint of the definitions, to register only when they change. */
export function commandDefinitionsSignature(
    definitions: readonly CommandDefinition[]
) {
    return createHash("sha256")
        .update(JSON.stringify(definitions))
        .digest("hex")
        .slice(0, 32)
}

/**
 * The language of a server without Logi: its Discord community language,
 * else English. A connected server always uses the clan language.
 */
export function fallbackGuildLanguage(
    preferredLocale: string | null | undefined
) {
    const value = (preferredLocale ?? "").toLowerCase()
    return value.startsWith("cs") ? "cs" : value.startsWith("de") ? "de" : "en"
}
