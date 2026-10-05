import {
    ActionRowBuilder,
    type APIMessageComponentEmoji,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonInteraction,
    ChannelType,
    type ChannelSelectMenuInteraction,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    MediaGalleryBuilder,
    MessageFlags,
    ModalBuilder,
    ModalSubmitInteraction,
    SlashCommandBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuInteraction,
    TextChannel,
    TextInputBuilder,
    TextInputStyle,
} from "discord.js"

import {
    detectPlatformFromId,
    getPlatformProfileUrl,
    stripPlatformPrefix,
} from "../../src/lib/platform-ids"
import { getMembershipMessages } from "../../src/lib/clan-language/membership"
import { withGameOverrides, type GameId } from "../../src/domain/games/game"
import { getCommandMessages } from "../../src/lib/clan-language/commands"
import { getEventMessages } from "../../src/lib/clan-language/events"
import type { ClanLanguage } from "../../src/lib/clan-language/core"

import {
    buildMockPlayerMessage,
    buildPlatformGuideMessage,
    buildPlatformLinkCustomId,
    buildPlatformLinkManageMessage,
    buildPlatformLinkModalId,
    buildPlatformLinkSearchModalId,
    buildPlayerSearchResultsMessage,
    buildPlatformSelectMessageWithEmojis,
    buildPlayedBeforeMessage,
    getPlatformFlowMessages,
    buildUnlinkPlatformMessage,
    parsePlatformLinkInteractionId,
    parsePlatformLinkModalId,
    parsePlatformLinkSearchModalId,
} from "./interactions/platform-link"
import {
    ATTENDANCE_DECLINE_MODAL_PREFIX,
    ATTENDANCE_DECLINE_PREFIX,
    handleAttendanceDeclineButton,
    handleAttendanceDeclineModalSubmit,
} from "./interactions/attendance-decline"
import {
    handleEventButtonInteraction,
    handleCheckSignupInteraction,
    handleEventSignupPickerInteraction,
    handleRosterAssignmentInteraction,
} from "./interactions/event-buttons"
import {
    createInteractionRegistry,
    type InteractionFeatureContext,
    type InteractionRegistry,
} from "./interactions/registry"
import {
    cleanupThread,
    formatTemplate,
    loadTicketCategoryContext,
    resolveSupportMemberIds,
} from "./interactions/shared"
import {
    detectPlatformFromStatsId,
    extractPlayerSearchResults,
} from "./interactions/player-search"
import {
    buildServerStatusCommand,
    handleServerStatusCommand,
} from "./interactions/server-status"
import type {
    EventInteractionContext,
    TicketCategory,
    TicketThreadRecord,
} from "./types"
import { handleMatchRecapPreference } from "./interactions/match-recap-preference"
import { buildCloseApplicationCommand } from "./interactions/membership-decision"
import { handleLegacyApplication } from "./interactions/membership-application"
import { checkCloseAuthority } from "./interactions/close-authority"
import { interactionFeatures } from "./interactions/features"
import { statsController } from "./interactions/stats-live"
import { buildTicketThreadEmbed } from "./message-builders"
import { reportClanDiscordError } from "./error-reporting"
import { buildStatsCommand } from "./interactions/stats"
import { handlePlayerReport } from "./player-reports"
import { interactionLanguage } from "./ui/replies"
import { logError, logInfo, logWarn } from "./log"
import { convex, references } from "./convex"
import { slugifyTicketLabel } from "./utils"
import { revalidateAppData } from "./cache"
import { client } from "./discord-client"
import { env } from "./environment"

type InteractionHandlerOptions = InteractionFeatureContext & {
    /** Feature routes; defaults to every module in `interactions/features.ts`. */
    registry?: InteractionRegistry
}

type TicketAnswer = {
    questionId: string
    label: string
    value: string
}

type PlatformLinkState = {
    id: string
    platformIds: string[]
    name: string
} | null

type PlatformEmojiMap = Partial<
    Record<"steam" | "epic" | "xbox" | "playstation", APIMessageComponentEmoji>
>
type PlayerSearchResult = {
    playerId: string
    playerName: string
    platform: "steam" | "epic" | "xbox" | "playstation" | "other"
}

type ClanPlayerAutocompleteResult = {
    id: string
    name: string
    avatar: string
    discordId: string
    platformIds: string[]
    assignmentType?: "member" | "mercenary"
    assignmentStatus?: "pending" | "recruit" | "active"
    matchesPlayed: number
    averageKills: number
    averageKd: number
    score: number
}

type ClanPlayerProfile = {
    id: string
    name: string
    avatar: string
    discordId: string
    linkedDiscordId?: string
    hasDiscordLink: boolean
    platformIds: string[]
    guildId?: string
    assignment: {
        type: "member" | "mercenary"
        status: "pending" | "recruit" | "active"
        membershipCategoryId?: string
        paused: boolean
        pausedNote?: string
    }
    score: number
    performance: {
        matchesPlayed: number
        averages: {
            kills: number
            killDeathRatio: number
            deaths: number
            offense: number
            defense: number
            support: number
        }
    }
    recentMatches: Array<{
        mapName?: string
        mapId: string
        team: string
        endedAt?: string
        importedAt: string
        kills: number
        deaths: number
        killDeathRatio: number
        offense: number
        defense: number
        support: number
        sourceUrl: string
    }>
    updatedAt: string
    createdAt: string
}

let platformEmojiCache: PlatformEmojiMap | null = null

function formatDiscordTimestamp(date: Date) {
    return `<t:${Math.floor(date.getTime() / 1000)}:F>`
}

function formatNumber(value: number, digits = 1) {
    return Number.isFinite(value) ? value.toFixed(digits) : "0.0"
}

function formatShortDateTimestamp(value?: string) {
    if (!value) {
        return "Unknown"
    }

    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return "Unknown"
    }

    return `<t:${Math.floor(date.getTime() / 1000)}:d>`
}

function getAssignmentBadge(input: {
    type?: "member" | "mercenary"
    status?: "pending" | "recruit" | "active"
}) {
    const typeLabel = input.type === "mercenary" ? "Mercenary" : "Member"
    const statusLabel =
        input.status === "pending"
            ? "Pending"
            : input.status === "recruit"
              ? "Recruit"
              : "Active"
    return `${typeLabel} • ${statusLabel}`
}

function buildClanPlayerOptionLabel(player: ClanPlayerAutocompleteResult) {
    return `${player.name} • ${getAssignmentBadge({
        type: player.assignmentType,
        status: player.assignmentStatus,
    })}`.slice(0, 100)
}

function buildClanPlayerOptionValue(player: ClanPlayerAutocompleteResult) {
    return player.id
}

function buildClanPlayerOptionDescription(
    player: ClanPlayerAutocompleteResult
) {
    const parts = [
        player.matchesPlayed
            ? `${player.matchesPlayed} matches`
            : "No imported matches",
        `KD ${formatNumber(player.averageKd)}`,
    ]
    return parts.join(" • ").slice(0, 100)
}

function buildPlatformFieldValue(platformIds: string[]) {
    const lines = platformIds.map((platformId) => {
        const platform = detectPlatformFromId(platformId)
        const label =
            platform === "steam"
                ? "Steam"
                : platform === "epic"
                  ? "Epic"
                  : platform === "xbox"
                    ? "Xbox"
                    : platform === "playstation"
                      ? "PlayStation"
                      : "Platform"
        const rawId = stripPlatformPrefix(platformId)
        const profileUrl = getPlatformProfileUrl(platformId)
        return profileUrl
            ? `[${label}: ${rawId}](${profileUrl})`
            : `${label}: \`${rawId}\``
    })

    return lines.join("\n").slice(0, 1024)
}

function buildRecentMatchesValue(
    profile: ClanPlayerProfile,
    messages = getCommandMessages("en")
) {
    if (!profile.recentMatches.length) {
        return messages.playerStats.noMatchHistory
    }

    return profile.recentMatches
        .map((match) => {
            const mapLabel = match.mapName?.trim() || match.mapId
            return `${formatShortDateTimestamp(match.endedAt ?? match.importedAt)} ${mapLabel} • ${match.kills}/${match.deaths} • KD ${formatNumber(match.killDeathRatio)}`
        })
        .join("\n")
        .slice(0, 1024)
}

function buildClanPlayerProfileEmbed(profile: ClanPlayerProfile) {
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(profile.name)
        .setThumbnail(profile.avatar)
        .addFields(
            {
                name: "Status",
                value: getAssignmentBadge(profile.assignment),
                inline: true,
            },
            {
                name: "Clan score",
                value: String(profile.score ?? 0),
                inline: true,
            },
            {
                name: "Matches",
                value: String(profile.performance.matchesPlayed ?? 0),
                inline: true,
            },
            {
                name: "Average kills",
                value: formatNumber(profile.performance.averages.kills),
                inline: true,
            },
            {
                name: "Average deaths",
                value: formatNumber(profile.performance.averages.deaths),
                inline: true,
            },
            {
                name: "Average KD",
                value: formatNumber(
                    profile.performance.averages.killDeathRatio
                ),
                inline: true,
            },
            {
                name: "Average offense",
                value: formatNumber(profile.performance.averages.offense),
                inline: true,
            },
            {
                name: "Average defense",
                value: formatNumber(profile.performance.averages.defense),
                inline: true,
            },
            {
                name: "Average support",
                value: formatNumber(profile.performance.averages.support),
                inline: true,
            },
            {
                name: "Discord",
                value: profile.hasDiscordLink
                    ? `<@${profile.linkedDiscordId ?? profile.discordId}>`
                    : `\`${profile.discordId}\``,
            },
            {
                name: "Platforms",
                value: profile.platformIds.length
                    ? buildPlatformFieldValue(profile.platformIds)
                    : "No linked platforms.",
            },
            { name: "Recent matches", value: buildRecentMatchesValue(profile) }
        )
        .setFooter({ text: `Player ID: ${profile.id}` })
        .setTimestamp(new Date(profile.updatedAt))

    if (profile.assignment.paused) {
        embed.addFields({
            name: "Assignment state",
            value: profile.assignment.pausedNote?.trim()
                ? `Paused: ${profile.assignment.pausedNote}`
                : "Paused",
        })
    }

    return embed
}

function buildClanPlayerProfileV2(
    profile: ClanPlayerProfile,
    messages: ReturnType<typeof getCommandMessages>
) {
    const container = new ContainerBuilder().setAccentColor(0x5865f2)
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            [
                `# ${profile.name}`,
                `**${getAssignmentBadge(profile.assignment)}**`,
                `${messages.playerStats.clanScore}: **${profile.score ?? 0}** · ${messages.playerStats.matches}: **${profile.performance.matchesPlayed ?? 0}**`,
            ].join("\n")
        )
    )
    container.addSeparatorComponents(new SeparatorBuilder())
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            [
                `## ${messages.playerStats.performance}`,
                `Kills **${formatNumber(profile.performance.averages.kills)}** · Deaths **${formatNumber(profile.performance.averages.deaths)}** · KD **${formatNumber(profile.performance.averages.killDeathRatio)}**`,
                `Offense **${formatNumber(profile.performance.averages.offense)}** · Defense **${formatNumber(profile.performance.averages.defense)}** · Support **${formatNumber(profile.performance.averages.support)}**`,
                "\n## Recent matches",
                buildRecentMatchesValue(profile, messages),
            ].join("\n")
        )
    )
    if (profile.avatar) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems({
                media: { url: profile.avatar },
                description: `${profile.name} profile image`,
            })
        )
    }
    return { components: [container] }
}

function buildTicketCloseEmbed(input: {
    messages: ReturnType<typeof getMembershipMessages>
    ticketNumber: number
    closerId: string
    closedAt: Date
    reason?: string
}) {
    const { messages, ticketNumber, closerId, closedAt, reason } = input
    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`${messages.ticket.closeEmbedTitle} #${ticketNumber}`)
        .addFields(
            {
                name: messages.ticket.closedByLabel,
                value: `<@${closerId}>`,
                inline: true,
            },
            {
                name: messages.ticket.closedAtLabel,
                value: formatDiscordTimestamp(closedAt),
                inline: true,
            }
        )
        .setTimestamp(closedAt)

    if (reason) {
        embed.addFields({ name: messages.ticket.reasonLabel, value: reason })
    }

    return embed
}

/**
 * Clan language for an event button. Reminder DMs have no guild, so the event
 * supplies it instead of falling back to English.
 */
async function resolveEventButtonLanguage(
    guildId: string | null,
    eventId: string
) {
    if (guildId) {
        const config = (await convex
            .query(references.getConfigByDiscordGuildId, {
                secret: env.internalSecret,
                guildId,
            })
            .catch(() => null)) as { defaultLanguage?: string } | null
        return config?.defaultLanguage
    }
    const context = (await convex
        .query(references.getEventInteractionContext, {
            secret: env.internalSecret,
            eventId: eventId as never,
        })
        .catch(() => null)) as EventInteractionContext | null
    return context?.config.defaultLanguage
}

export function createInteractionHandler(options: InteractionHandlerOptions) {
    // Feature modules register their routes; registered routes win and the
    // rest of this dispatch stays as it is (interactions/registry.ts).
    const registry =
        options.registry ??
        createInteractionRegistry(interactionFeatures, options)
    return {
        async handleButtonInteraction(interaction: ButtonInteraction) {
            if (await registry.routeButton(interaction)) return
            if (await handlePlayerReport(interaction)) return
            if (interaction.customId.startsWith("stats:")) {
                await statsController.button(interaction)
                return
            }
            if (interaction.customId.startsWith("match-recap:")) {
                await handleMatchRecapPreference(interaction)
                return
            }
            if (interaction.customId.startsWith(ATTENDANCE_DECLINE_PREFIX)) {
                await handleAttendanceDeclineButton(interaction)
                return
            }
            if (interaction.customId.startsWith("attendance-late:")) {
                const eventId = interaction.customId.replace(
                    "attendance-late:",
                    ""
                )
                const messages = getEventMessages(
                    await resolveEventButtonLanguage(
                        interaction.guildId,
                        eventId
                    )
                )
                await openNoticeModal(
                    interaction,
                    eventId,
                    messages.embed.lateNoticeTitle,
                    messages.embed.lateNoticeLabel
                )
                return
            }
            if (interaction.customId.startsWith("signup-picker:")) {
                await handleEventSignupPickerInteraction(interaction)
                return
            }
            if (interaction.customId.startsWith("check-signup:")) {
                await handleCheckSignupInteraction(interaction)
                return
            }
            if (interaction.customId.startsWith("roster-assignment:")) {
                await handleRosterAssignmentInteraction(interaction)
                return
            }
            if (
                interaction.customId.startsWith("signup:") ||
                interaction.customId.startsWith("attendance:")
            ) {
                await handleEventButtonInteraction(interaction, options)
                return
            }

            if (interaction.customId.startsWith("ticket:")) {
                await handleTicketButtonInteraction(interaction)
                return
            }

            if (interaction.customId.startsWith("plink:")) {
                await handlePlatformLinkButtonInteraction(interaction)
            }
        },

        async handleStringSelectMenuInteraction(
            interaction: StringSelectMenuInteraction
        ) {
            if (await registry.routeStringSelect(interaction)) return
            if (await handlePlayerReport(interaction)) return
            if (interaction.customId.startsWith("signup:")) {
                await handleEventButtonInteraction(interaction, options)
                return
            }
            if (interaction.customId.startsWith("plink:")) {
                await handlePlatformLinkSelectInteraction(interaction)
            }
        },

        async handleModalSubmit(interaction: ModalSubmitInteraction) {
            if (await registry.routeModal(interaction)) return
            if (await handlePlayerReport(interaction)) return
            if (interaction.customId.startsWith("stats:")) {
                await statsController.modal(interaction)
            } else if (interaction.customId.startsWith("ticket-modal:")) {
                await handleTicketModalSubmit(interaction)
            } else if (interaction.customId.startsWith("plink-modal:")) {
                await handlePlatformLinkModalSubmit(interaction)
            } else if (interaction.customId.startsWith("plink-search:")) {
                await handlePlatformLinkSearchModalSubmit(interaction)
            } else if (interaction.customId.startsWith("notice-modal:")) {
                await handleNoticeModalSubmit(interaction)
            } else if (
                interaction.customId.startsWith(ATTENDANCE_DECLINE_MODAL_PREFIX)
            ) {
                await handleAttendanceDeclineModalSubmit(interaction, options)
            }
        },

        async handleAutocompleteInteraction(
            interaction: AutocompleteInteraction
        ) {
            if (await registry.routeAutocomplete(interaction)) return
            if (interaction.commandName === "stats") {
                await statsController.autocomplete(interaction)
            } else if (interaction.commandName === "notice") {
                await handleNoticeAutocomplete(interaction)
            } else if (interaction.commandName === "player") {
                await handlePlayerAutocomplete(interaction)
            }
        },

        async handleChatInputCommand(interaction: ChatInputCommandInteraction) {
            if (await registry.routeCommand(interaction)) return
            if (interaction.commandName === "stats") {
                await statsController.command(interaction)
            } else if (interaction.commandName === "server-status") {
                await handleServerStatusCommand(interaction)
            } else if (interaction.commandName === "close_ticket") {
                await handleCloseTicketCommand(interaction)
            } else if (interaction.commandName === "link") {
                await handleLinkCommand(interaction)
            } else if (interaction.commandName === "notice") {
                await handleNoticeCommand(interaction)
            } else if (interaction.commandName === "player") {
                await handlePlayerCommand(interaction)
            }
        },

        async handleChannelSelectMenuInteraction(
            interaction: ChannelSelectMenuInteraction
        ) {
            if (await registry.routeChannelSelect(interaction)) return
            if (interaction.customId.startsWith("stats:"))
                await statsController.channel(interaction)
        },

        async registerGuildCommands(guild: import("discord.js").Guild) {
            const messages = getCommandMessages(
                guild.preferredLocale === "cs"
                    ? "cs"
                    : guild.preferredLocale === "de"
                      ? "de"
                      : "en"
            )
            const commands = [
                buildStatsCommand(),
                buildServerStatusCommand(),
                new SlashCommandBuilder()
                    .setName("close_ticket")
                    .setDescription(messages.commands.closeTicketDescription)
                    .setDescriptionLocalizations({
                        cs: getCommandMessages("cs").commands
                            .closeTicketDescription,
                        de: getCommandMessages("de").commands
                            .closeTicketDescription,
                    })
                    .addStringOption((option) =>
                        option
                            .setName("reason")
                            .setDescription(
                                messages.commands.reasonOptionDescription
                            )
                            .setDescriptionLocalizations({
                                cs: getCommandMessages("cs").commands
                                    .reasonOptionDescription,
                                de: getCommandMessages("de").commands
                                    .reasonOptionDescription,
                            })
                            .setMaxLength(500)
                            .setRequired(false)
                    )
                    .setDMPermission(false),
                buildCloseApplicationCommand(
                    guild.preferredLocale === "cs"
                        ? "cs"
                        : guild.preferredLocale === "de"
                          ? "de"
                          : "en"
                ),
                new SlashCommandBuilder()
                    .setName("notice")
                    .setDescription(messages.commands.noticeDescription)
                    .setDescriptionLocalizations({
                        cs: getCommandMessages("cs").commands.noticeDescription,
                        de: getCommandMessages("de").commands.noticeDescription,
                    })
                    .addStringOption((option) =>
                        option
                            .setName("event")
                            .setDescription(
                                messages.commands.noticeEventOptionDescription
                            )
                            .setDescriptionLocalizations({
                                cs: getCommandMessages("cs").commands
                                    .noticeEventOptionDescription,
                                de: getCommandMessages("de").commands
                                    .noticeEventOptionDescription,
                            })
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .setDMPermission(false),
                new SlashCommandBuilder()
                    .setName("link")
                    .setDescription(messages.commands.linkDescription)
                    .setDescriptionLocalizations({
                        cs: getCommandMessages("cs").commands.linkDescription,
                        de: getCommandMessages("de").commands.linkDescription,
                    })
                    .setDMPermission(false),
                new SlashCommandBuilder()
                    .setName("player")
                    .setDescription(messages.commands.playerDescription)
                    .setDescriptionLocalizations({
                        cs: getCommandMessages("cs").commands.playerDescription,
                        de: getCommandMessages("de").commands.playerDescription,
                    })
                    .addStringOption((option) =>
                        option
                            .setName("player")
                            .setDescription(
                                messages.commands.playerOptionDescription
                            )
                            .setDescriptionLocalizations({
                                cs: getCommandMessages("cs").commands
                                    .playerOptionDescription,
                                de: getCommandMessages("de").commands
                                    .playerOptionDescription,
                            })
                            .setRequired(true)
                            .setAutocomplete(true)
                    )
                    .setDMPermission(false),
            ]

            await guild.commands.set(
                commands.map((command) => command.toJSON())
            )
        },
    }

    async function handleTicketButtonInteraction(
        interaction: ButtonInteraction
    ) {
        const fallbackMessages = getMembershipMessages("en")
        if (!interaction.guildId || !interaction.guild) {
            await interaction.reply({
                content: fallbackMessages.ticket.serverOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const categoryId = interaction.customId.replace("ticket:", "")
        const context = await loadTicketCategoryContext(
            interaction.guildId,
            categoryId
        )
        const messages = getMembershipMessages(context?.config.defaultLanguage)
        if (!context?.config.ticketSettings?.enabled) {
            await interaction.reply({
                content: messages.ticket.unavailable,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        if (context.category.modalQuestions.length) {
            const modal = new ModalBuilder()
                .setCustomId(`ticket-modal:${categoryId}`)
                .setTitle(
                    (
                        context.category.label?.trim() ||
                        messages.ticket.modalTitle
                    ).slice(0, 45)
                )

            for (const question of context.category.modalQuestions.slice(
                0,
                5
            )) {
                const input = new TextInputBuilder()
                    .setCustomId(question.id)
                    .setLabel(question.label.slice(0, 45))
                    .setStyle(
                        question.style === "paragraph"
                            ? TextInputStyle.Paragraph
                            : TextInputStyle.Short
                    )
                    .setRequired(question.required)
                    .setMaxLength(question.style === "paragraph" ? 1000 : 400)

                if (question.placeholder) {
                    input.setPlaceholder(question.placeholder.slice(0, 100))
                }

                modal.addComponents(
                    new ActionRowBuilder<TextInputBuilder>().addComponents(
                        input
                    )
                )
            }

            await interaction.showModal(modal)
            return
        }

        await createDiscordTicket(interaction, context.category, [])
    }

    async function handleNoticeCommand(
        interaction: ChatInputCommandInteraction
    ) {
        const fallbackMessages = getMembershipMessages("en")
        if (!interaction.guildId) {
            await interaction.reply({
                content: fallbackMessages.membership.serverOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const eventSelection = interaction.options
            .getString("event", true)
            .trim()
        const guildConfig = (await convex
            .query(references.getConfigByDiscordGuildId, {
                secret: env.internalSecret,
                guildId: interaction.guildId,
            })
            .catch(() => null)) as {
            defaultLanguage?: "en" | "cs" | "de"
        } | null
        const messages = getCommandMessages(guildConfig?.defaultLanguage)

        const matches = (await convex.query(references.findNoticeTarget, {
            secret: env.internalSecret,
            guildId: interaction.guildId,
            userId: interaction.user.id,
            query: eventSelection,
        })) as Array<{ id: string; name: string }>

        logInfo("interaction", "Resolved notice command candidates", {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            eventSelection,
            matchCount: matches.length,
            matchIds: matches.map((event) => event.id),
            matchNames: matches.map((event) => event.name),
        })

        const exactIdMatch = matches.find(
            (event) => event.id === eventSelection
        )
        if (exactIdMatch) {
            await openNoticeModal(
                interaction,
                exactIdMatch.id,
                messages.commands.noticeModalTitle,
                messages.commands.noticeReasonLabel
            )
            return
        }

        if (!matches.length) {
            await interaction.reply({
                content: messages.commands.noticeNoMatch,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const exactNameMatches = matches.filter(
            (event) =>
                event.name.trim().toLowerCase() === eventSelection.toLowerCase()
        )
        if (exactNameMatches.length === 1) {
            await openNoticeModal(
                interaction,
                exactNameMatches[0].id,
                messages.commands.noticeModalTitle,
                messages.commands.noticeReasonLabel
            )
            return
        }

        if (matches.length > 1) {
            await interaction.reply({
                content: messages.commands.noticeMultipleMatches,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await openNoticeModal(
            interaction,
            matches[0].id,
            messages.commands.noticeModalTitle,
            messages.commands.noticeReasonLabel
        )
    }

    async function handlePlayerAutocomplete(
        interaction: AutocompleteInteraction
    ) {
        if (!interaction.guildId) {
            await interaction.respond([])
            return
        }

        const query = interaction.options.getFocused(true)
        if (query.name !== "player") {
            await interaction.respond([])
            return
        }

        const matches = (await convex
            .query(references.searchClanPlayers, {
                secret: env.internalSecret,
                guildId: interaction.guildId,
                query: String(query.value ?? ""),
                limit: 5,
            })
            .catch(() => [])) as ClanPlayerAutocompleteResult[]

        await interaction.respond(
            matches.map((player) => ({
                name: buildClanPlayerOptionLabel(player),
                value: buildClanPlayerOptionValue(player),
            }))
        )
    }

    async function handlePlayerCommand(
        interaction: ChatInputCommandInteraction
    ) {
        if (!interaction.guildId) {
            await interaction.reply({
                content: getCommandMessages("en").commands.playerServerOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await interaction.deferReply()
        const guildConfig = (await convex
            .query(references.getConfigByDiscordGuildId, {
                secret: env.internalSecret,
                guildId: interaction.guildId,
            })
            .catch(() => null)) as {
            defaultLanguage?: "en" | "cs" | "de"
        } | null
        const messages = getCommandMessages(guildConfig?.defaultLanguage)

        const playerId = interaction.options.getString("player", true).trim()
        const profile = (await convex
            .query(references.getClanPlayerProfile, {
                secret: env.internalSecret,
                guildId: interaction.guildId,
                userId: playerId,
            })
            .catch(() => null)) as ClanPlayerProfile | null

        if (!profile) {
            await interaction.editReply({
                content: messages.commands.playerNotFound,
            })
            return
        }

        await interaction.editReply({
            ...buildClanPlayerProfileV2(profile, messages),
            flags: MessageFlags.IsComponentsV2,
        })
    }

    async function handleNoticeAutocomplete(
        interaction: AutocompleteInteraction
    ) {
        if (!interaction.guildId) {
            logInfo(
                "interaction",
                "Ignored notice autocomplete outside guild",
                {
                    userId: interaction.user.id,
                }
            )
            await interaction.respond([])
            return
        }

        const query = interaction.options.getFocused(true)
        if (query.name !== "event") {
            logInfo(
                "interaction",
                "Ignored notice autocomplete for unexpected option",
                {
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    optionName: query.name,
                }
            )
            await interaction.respond([])
            return
        }

        logInfo("interaction", "Received notice autocomplete", {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            query: String(query.value ?? ""),
        })

        const matches = (await convex
            .query(references.findNoticeTarget, {
                secret: env.internalSecret,
                guildId: interaction.guildId,
                userId: interaction.user.id,
                query: String(query.value ?? ""),
            })
            .catch(() => [])) as Array<{
            id: string
            name: string
            gameStart?: string
        }>

        logInfo("interaction", "Resolved notice autocomplete candidates", {
            guildId: interaction.guildId,
            userId: interaction.user.id,
            query: String(query.value ?? ""),
            matchCount: matches.length,
            matchIds: matches.map((event) => event.id),
            matchNames: matches.map((event) => event.name),
            matchGameStarts: matches.map((event) => event.gameStart),
        })

        await interaction.respond(
            matches.slice(0, 25).map((event) => ({
                name: formatNoticeAutocompleteLabel(
                    event.name,
                    event.gameStart
                ),
                value: event.id,
            }))
        )
    }

    async function openNoticeModal(
        interaction: ChatInputCommandInteraction | ButtonInteraction,
        eventId: string,
        modalTitle: string,
        reasonLabel: string
    ) {
        const modal = new ModalBuilder()
            .setCustomId(`notice-modal:${eventId}`)
            .setTitle(modalTitle.slice(0, 45))

        modal.addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("reason")
                    .setLabel(reasonLabel.slice(0, 45))
                    .setStyle(TextInputStyle.Paragraph)
                    .setRequired(true)
                    .setMaxLength(500)
            )
        )

        await interaction.showModal(modal)
    }

    function formatNoticeAutocompleteLabel(name: string, gameStart?: string) {
        if (!gameStart) {
            return name.slice(0, 100)
        }

        const timestamp = new Date(gameStart)
        if (Number.isNaN(timestamp.getTime())) {
            return name.slice(0, 100)
        }

        return `${name} • ${timestamp.toLocaleString("en-GB", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
            timeZone: "UTC",
        })} UTC`.slice(0, 100)
    }

    async function handleNoticeModalSubmit(
        interaction: ModalSubmitInteraction
    ) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        const eventId = interaction.customId.replace("notice-modal:", "")
        // The "Running late" button also sits on reminder DMs, which have no
        // guild: the event then supplies its guild and clan language.
        const eventContext = interaction.guildId
            ? null
            : ((await convex
                  .query(references.getEventInteractionContext, {
                      secret: env.internalSecret,
                      eventId: eventId as never,
                  })
                  .catch(() => null)) as EventInteractionContext | null)
        const guildId = interaction.guildId ?? eventContext?.event.guildId
        if (!guildId) {
            await interaction.editReply({
                content:
                    getEventMessages("en").interaction.unableToLoadEventContext,
            })
            return
        }
        const guildConfig = eventContext
            ? eventContext.config
            : ((await convex
                  .query(references.getConfigByDiscordGuildId, {
                      secret: env.internalSecret,
                      guildId,
                  })
                  .catch(() => null)) as {
                  defaultLanguage?: "en" | "cs" | "de"
              } | null)
        const messages = getCommandMessages(guildConfig?.defaultLanguage)

        await convex.mutation(references.upsertNotice, {
            secret: env.internalSecret,
            eventId: eventId as never,
            userId: interaction.user.id,
            reason: interaction.fields.getTextInputValue("reason"),
        })

        await revalidateAppData({
            type: "event-changed",
            serverId: guildId,
            eventId,
        })
        options.enqueueEventSync(eventId)
        options.triggerPollSoon()

        await interaction.editReply({ content: messages.commands.noticeSaved })
    }

    async function handleLinkCommand(interaction: ChatInputCommandInteraction) {
        const fallbackMessages = getMembershipMessages("en")
        if (!interaction.guildId) {
            await interaction.reply({
                content: fallbackMessages.membership.serverOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        const guildConfig = (await convex
            .query(references.getConfigByDiscordGuildId, {
                secret: env.internalSecret,
                guildId: interaction.guildId,
            })
            .catch(() => null)) as {
            defaultLanguage?: "en" | "cs" | "de"
        } | null
        const language = guildConfig?.defaultLanguage ?? "en"
        const linkState = await loadDiscordPlatformLinkState(
            interaction.user.id
        )
        const emojis = await getPlatformEmojis()
        await interaction.editReply({
            ...(linkState?.platformIds?.length
                ? buildPlatformLinkManageMessage({
                      language,
                      platformIds: linkState.platformIds,
                      emojis,
                  })
                : buildPlatformSelectMessageWithEmojis({
                      language,
                      context: { mode: "link" },
                      emojis,
                  })),
        })
    }

    async function handleTicketModalSubmit(
        interaction: ModalSubmitInteraction
    ) {
        const fallbackMessages = getMembershipMessages("en")
        if (!interaction.guildId) {
            await interaction.reply({
                content: fallbackMessages.ticket.serverOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const categoryId = interaction.customId.replace("ticket-modal:", "")
        const context = await loadTicketCategoryContext(
            interaction.guildId,
            categoryId
        )
        const messages = getMembershipMessages(context?.config.defaultLanguage)
        if (!context?.config.ticketSettings?.enabled) {
            await interaction.reply({
                content: messages.ticket.unavailable,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const answers = context.category.modalQuestions.map((question) => ({
            questionId: question.id,
            label: question.label,
            value: interaction.fields.getTextInputValue(question.id).trim(),
        }))

        await createDiscordTicket(interaction, context.category, answers)
    }

    async function updateMembershipPlatformFlow(
        interaction: ButtonInteraction | StringSelectMenuInteraction,
        _language: ClanLanguage,
        _context: { mode: "membership" | "link"; draftId?: string },
        legacyMessage: {
            embeds: readonly EmbedBuilder[]
            components: readonly ActionRowBuilder<
                ButtonBuilder | StringSelectMenuBuilder
            >[]
        }
    ) {
        // The clan application has its own accounts window now (L6-28).
        await interaction.update(legacyMessage)
    }

    async function handlePlatformLinkButtonInteraction(
        interaction: ButtonInteraction
    ) {
        const parsed = parsePlatformLinkInteractionId(interaction.customId)
        const context = parsed?.context
        const language = await getGuildLanguage(interaction.guildId)
        const flowMessages = getPlatformFlowMessages(language)
        if (!parsed || !context) {
            await interaction.reply({
                content: flowMessages.invalidAction,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        if (context.mode === "membership") {
            await handleLegacyApplication(interaction)
            return
        }

        const emojis = await getPlatformEmojis()

        if (parsed.step === "start") {
            if (
                await hasConfiguredStatsServers(
                    interaction.guildId,
                    context.gameId
                )
            ) {
                await updateMembershipPlatformFlow(
                    interaction,
                    language,
                    context,
                    buildPlayedBeforeMessage(language, context)
                )
                return
            }

            await updateMembershipPlatformFlow(
                interaction,
                language,
                context,
                buildPlatformSelectMessageWithEmojis({
                    language,
                    context,
                    emojis,
                })
            )
            return
        }

        if (parsed.step === "player-search") {
            await interaction.showModal(
                buildPlayerSearchModal(context, language)
            )
            return
        }

        if (parsed.step === "unlink" && context.mode === "link") {
            const linkState = await loadDiscordPlatformLinkState(
                interaction.user.id
            )
            await interaction.update(
                buildUnlinkPlatformMessage({
                    language,
                    platformIds: linkState?.platformIds ?? [],
                    emojis,
                })
            )
            return
        }

        if (parsed.step === "manual" && parsed.extra) {
            if (
                parsed.extra !== "steam" &&
                parsed.extra !== "epic" &&
                parsed.extra !== "xbox" &&
                parsed.extra !== "playstation"
            ) {
                await interaction.reply({
                    content:
                        getMembershipMessages(language).platformFlow
                            ?.invalidPlatformId ?? "Invalid platform.",
                    flags: MessageFlags.Ephemeral,
                })
                return
            }

            await interaction.showModal(
                buildPlatformIdOnlyModal(
                    buildPlatformLinkModalId(context, parsed.extra),
                    parsed.extra,
                    language
                )
            )
        }
    }

    async function handlePlatformLinkSelectInteraction(
        interaction: StringSelectMenuInteraction
    ) {
        const parsed = parsePlatformLinkInteractionId(interaction.customId)
        const context = parsed?.context
        const language = await getGuildLanguage(interaction.guildId)
        const flowMessages = getPlatformFlowMessages(language)
        if (!parsed || !context) {
            await interaction.reply({
                content: flowMessages.invalidAction,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        if (context.mode === "membership") {
            await handleLegacyApplication(interaction)
            return
        }

        const value = interaction.values[0]
        const emojis = await getPlatformEmojis()

        if (parsed.step === "played") {
            if (value === "yes") {
                await updateMembershipPlatformFlow(
                    interaction,
                    language,
                    context,
                    buildMockPlayerMessage(language, context)
                )
                return
            }

            await updateMembershipPlatformFlow(
                interaction,
                language,
                context,
                buildPlatformSelectMessageWithEmojis({
                    language,
                    context,
                    emojis,
                })
            )
            return
        }

        if (parsed.step === "platform") {
            if (
                value !== "steam" &&
                value !== "epic" &&
                value !== "xbox" &&
                value !== "playstation"
            ) {
                await interaction.reply({
                    content:
                        getMembershipMessages(language).platformFlow
                            ?.invalidPlatformId ?? "Invalid platform.",
                    flags: MessageFlags.Ephemeral,
                })
                return
            }

            await updateMembershipPlatformFlow(
                interaction,
                language,
                context,
                buildPlatformGuideMessage(language, context, value, emojis)
            )
            return
        }

        if (parsed.step === "unlink-select" && context.mode === "link") {
            await convex.mutation(references.unlinkDiscordPlatformId, {
                secret: env.internalSecret,
                userId: interaction.user.id,
                platformId: value,
            })
            const linkState = await loadDiscordPlatformLinkState(
                interaction.user.id
            )
            await interaction.update(
                buildPlatformLinkManageMessage({
                    language,
                    platformIds: linkState?.platformIds ?? [],
                    emojis,
                })
            )
            return
        }

        if (parsed.step === "player") {
            await savePlatformIdLink(
                interaction.user.id,
                interaction.user.globalName ?? interaction.user.username,
                interaction.user.displayAvatarURL(),
                value
            )
            const linkState = await loadDiscordPlatformLinkState(
                interaction.user.id
            )
            await interaction.update(
                buildPlatformLinkManageMessage({
                    language,
                    platformIds: linkState?.platformIds ?? [],
                    emojis,
                })
            )
        }
    }

    async function handlePlatformLinkModalSubmit(
        interaction: ModalSubmitInteraction
    ) {
        const parsed = parsePlatformLinkModalId(interaction.customId)
        const language = await getGuildLanguage(interaction.guildId)
        const flowMessages = getPlatformFlowMessages(language)
        if (!parsed?.context) {
            await interaction.reply({
                content: flowMessages.invalidModal,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        if (parsed.context.mode === "membership") {
            await handleLegacyApplication(interaction)
            return
        }

        const platformId = interaction.fields
            .getTextInputValue("platformId")
            .trim()
        const messages = getMembershipMessages(language)
        if (!platformId || /\s/.test(platformId)) {
            await interaction.reply({
                content:
                    messages.platformFlow?.invalidPlatformId ??
                    "Enter a platform ID without spaces.",
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await savePlatformIdLink(
            interaction.user.id,
            interaction.user.globalName ?? interaction.user.username,
            interaction.user.displayAvatarURL(),
            toStoredPlatformId(parsed.platform, platformId)
        )

        const linkState = await loadDiscordPlatformLinkState(
            interaction.user.id
        )
        const emojis = await getPlatformEmojis()
        await interaction.reply({
            ...buildPlatformLinkManageMessage({
                language,
                platformIds: linkState?.platformIds ?? [],
                emojis,
            }),
            flags: MessageFlags.Ephemeral,
        })
    }

    async function handlePlatformLinkSearchModalSubmit(
        interaction: ModalSubmitInteraction
    ) {
        const context = parsePlatformLinkSearchModalId(interaction.customId)
        const language = await getGuildLanguage(interaction.guildId)
        const flowMessages = getPlatformFlowMessages(language)
        if (!context || !interaction.guildId) {
            await interaction.reply({
                content: flowMessages.invalidSearchModal,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const query = interaction.fields.getTextInputValue("query").trim()
        const originalMessage = interaction.message
        if (!originalMessage) {
            await interaction.reply({
                content: flowMessages.invalidSearchModal,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        // Search modals originate from the platform-link response. A modal
        // cannot update that response directly, so acknowledge it and edit its
        // originating message in place instead of creating another reply.
        await interaction.deferUpdate()
        const results = await searchPlayerStatsServers(
            interaction.guildId,
            query,
            context.gameId
        )
        const emojis = await getPlatformEmojis()

        const searchResultsMessage = buildPlayerSearchResultsMessage({
            language,
            context,
            results: results.map((result) => ({
                playerId: result.playerId,
                playerName: result.playerName,
                description: result.playerId,
                emoji:
                    result.platform === "other"
                        ? undefined
                        : emojis[result.platform],
            })),
        })
        await originalMessage.edit(searchResultsMessage)
    }

    async function getGuildLanguage(guildId: string | null) {
        if (!guildId) {
            return "en" as const
        }

        const guildConfig = (await convex
            .query(references.getConfigByDiscordGuildId, {
                secret: env.internalSecret,
                guildId,
            })
            .catch(() => null)) as {
            defaultLanguage?: "en" | "cs" | "de"
        } | null

        return guildConfig?.defaultLanguage ?? "en"
    }

    async function getPlatformEmojis() {
        if (platformEmojiCache) {
            return platformEmojiCache
        }

        const emojis = await client.application?.emojis
            .fetch()
            .catch(() => null)
        const resolve = (name: string) => {
            const emoji = emojis?.find((candidate) => candidate.name === name)
            return emoji
                ? ({
                      id: emoji.id,
                      name: emoji.name ?? undefined,
                  } satisfies APIMessageComponentEmoji)
                : undefined
        }

        platformEmojiCache = {
            steam: resolve("steam"),
            epic: resolve("epicgames"),
            xbox: resolve("xbox"),
            playstation: resolve("playstation"),
        }

        return platformEmojiCache
    }

    async function loadDiscordPlatformLinkState(userId: string) {
        return (await convex.query(references.getDiscordPlatformLinkState, {
            secret: env.internalSecret,
            userId,
        })) as PlatformLinkState
    }

    async function hasConfiguredStatsServers(
        guildId: string | null,
        gameId?: GameId
    ) {
        if (!guildId) {
            return false
        }

        const config = (await convex
            .query(references.getConfigByDiscordGuildId, {
                secret: env.internalSecret,
                guildId,
            })
            .catch(() => null)) as EventInteractionContext["config"] | null

        const scopedConfig = config
            ? withGameOverrides(config, config.gameOverrides, gameId)
            : null
        return (
            scopedConfig?.playerStatsServers?.some(
                (item) => item.token?.trim() && item.url?.trim()
            ) ?? false
        )
    }

    async function searchPlayerStatsServers(
        guildId: string,
        query: string,
        gameId?: GameId
    ): Promise<PlayerSearchResult[]> {
        const config = (await convex
            .query(references.getConfigByDiscordGuildId, {
                secret: env.internalSecret,
                guildId,
            })
            .catch(() => null)) as EventInteractionContext["config"] | null
        const scopedConfig = config
            ? withGameOverrides(config, config.gameOverrides, gameId)
            : null
        const servers =
            scopedConfig?.playerStatsServers?.filter(
                (item) => item.token?.trim() && item.url?.trim()
            ) ?? []
        if (!query.trim() || !servers.length) {
            return []
        }

        const settled = await Promise.allSettled(
            servers.map(async (server) => {
                const response = await fetch(server.url, {
                    method: "POST",
                    headers: {
                        "content-type": "application/json",
                        authorization: server.token
                            .trim()
                            .toLowerCase()
                            .startsWith("bearer ")
                            ? server.token.trim()
                            : `Bearer ${server.token.trim()}`,
                    },
                    body: JSON.stringify({
                        page: 1,
                        page_size: 50,
                        flags: [],
                        blacklisted: false,
                        exact_name_match: false,
                        ignore_accent: true,
                        is_watched: false,
                        player_name: query,
                        country: "",
                    }),
                })
                if (!response.ok) {
                    throw new Error(
                        `Stats search failed with ${response.status}`
                    )
                }

                const body = await response.json()
                return extractPlayerSearchResults(body).map((item) => ({
                    playerId: item.playerId,
                    playerName: item.playerName,
                    platform: detectPlatformFromStatsId(item.playerId),
                }))
            })
        )

        const deduped = new Map<string, PlayerSearchResult>()
        for (const entry of settled) {
            if (entry.status !== "fulfilled") {
                continue
            }

            for (const result of entry.value) {
                if (!deduped.has(result.playerId)) {
                    deduped.set(result.playerId, result)
                }
            }
        }

        return [...deduped.values()].slice(0, 25)
    }

    function buildPlayerSearchModal(
        context: {
            mode: "membership" | "link"
            categoryId?: string
            gameId?: GameId
        },
        language: ClanLanguage
    ) {
        const messages = getPlatformFlowMessages(language)
        return new ModalBuilder()
            .setCustomId(buildPlatformLinkSearchModalId(context))
            .setTitle(messages.playerSearchModalTitle)
            .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId("query")
                        .setLabel(messages.playerSearchModalLabel)
                        .setPlaceholder(messages.playerSearchModalPlaceholder)
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(100)
                )
            )
    }

    function buildPlatformIdOnlyModal(
        customId: string,
        platform: "steam" | "epic" | "xbox" | "playstation",
        language: ClanLanguage,
        title?: string
    ) {
        const messages =
            getMembershipMessages(language).platformFlow ??
            getMembershipMessages("en").platformFlow!
        const label = messages.guides[platform].label

        return new ModalBuilder()
            .setCustomId(customId)
            .setTitle((title ?? messages.title).slice(0, 45))
            .addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(
                    new TextInputBuilder()
                        .setCustomId("platformId")
                        .setLabel(label.slice(0, 45))
                        .setStyle(TextInputStyle.Short)
                        .setRequired(true)
                        .setMaxLength(200)
                )
            )
    }

    async function savePlatformIdLink(
        userId: string,
        userName: string,
        userAvatar: string,
        platformId: string
    ) {
        await convex.mutation(references.linkDiscordPlatformId, {
            secret: env.internalSecret,
            userId,
            userName,
            userAvatar,
            platformId,
        })
    }

    function toStoredPlatformId(
        platform: "steam" | "epic" | "xbox" | "playstation",
        platformId: string
    ) {
        return `${platform}:${platformId.trim()}`
    }

    async function createDiscordTicket(
        interaction: ButtonInteraction | ModalSubmitInteraction,
        category: TicketCategory,
        answers: TicketAnswer[]
    ) {
        const fallbackMessages = getMembershipMessages("en")
        if (!interaction.guildId || !interaction.guild) {
            await interaction.reply({
                content: fallbackMessages.ticket.serverOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        }

        const categoryContext = await loadTicketCategoryContext(
            interaction.guildId,
            category.id
        )
        const ticketSettings = categoryContext?.config.ticketSettings
        const messages = getMembershipMessages(
            categoryContext?.config.defaultLanguage
        )
        if (!categoryContext || !ticketSettings?.ticketParentChannelId) {
            await interaction.editReply({
                content: messages.ticket.setupIncomplete,
            })
            return
        }

        const parentChannel = await interaction.guild.channels
            .fetch(ticketSettings.ticketParentChannelId)
            .catch(() => null)
        if (!parentChannel || parentChannel.type !== ChannelType.GuildText) {
            await interaction.editReply({
                content: messages.ticket.parentChannelNotText,
            })
            return
        }

        await interaction.guild.members.fetch().catch(() => null)

        const thread = await (parentChannel as TextChannel).threads
            .create({
                name: `${slugifyTicketLabel(category.label?.trim() || category.id)}-pending`.slice(
                    0,
                    100
                ),
                autoArchiveDuration: 10080,
                type: ChannelType.PrivateThread,
                invitable: false,
                reason: `Ticket ${category.id} opened by ${interaction.user.tag}`,
            })
            .catch(async (error) => {
                logError("interaction", "Failed to create ticket thread", {
                    guildId: interaction.guildId,
                    userId: interaction.user.id,
                    categoryId: category.id,
                    error,
                })
                await reportClanDiscordError({
                    client,
                    guildId: interaction.guildId!,
                    error,
                    action: "Create a ticket thread",
                    location: "Ticket system",
                    scope: "interaction",
                    target: category.label?.trim() || category.id,
                    details: {
                        user: interaction.user.tag,
                        categoryId: category.id,
                    },
                })
                await interaction
                    .editReply({
                        content: messages.ticket.createThreadFailed,
                    })
                    .catch(() => null)
                return null
            })
        if (!thread) {
            return
        }

        const supportMemberIds = resolveSupportMemberIds(
            interaction.guild,
            category.supportRoleIds
        )
        const participantIds = [
            ...new Set([interaction.user.id, ...supportMemberIds]),
        ]

        for (const memberId of participantIds) {
            await thread.members.add(memberId).catch((error) => {
                logWarn("interaction", "Failed to add ticket thread member", {
                    guildId: interaction.guildId,
                    threadId: thread.id,
                    memberId,
                    error,
                })
                void reportClanDiscordError({
                    client,
                    guildId: interaction.guildId!,
                    error,
                    action: "Add a participant to a ticket thread",
                    location: "Ticket system",
                    scope: "interaction",
                    target: thread.name,
                    details: {
                        threadId: thread.id,
                        memberId,
                    },
                })
                return null
            })
        }

        const recordResponse = (await convex
            .mutation(references.createTicketThread, {
                secret: env.internalSecret,
                guildId: interaction.guildId,
                threadId: thread.id,
                parentChannelId: parentChannel.id,
                creatorId: interaction.user.id,
                categoryId: category.id,
                answers,
            })
            .catch(async (error) => {
                logError(
                    "interaction",
                    "Failed to create ticket thread record",
                    {
                        guildId: interaction.guildId,
                        threadId: thread.id,
                        userId: interaction.user.id,
                        categoryId: category.id,
                        error,
                    }
                )
                return null
            })) as {
            ticket: Pick<
                TicketThreadRecord,
                "ticketNumber" | "categoryLabel" | "threadId"
            >
            category: TicketCategory
        } | null
        if (!recordResponse) {
            await cleanupThread(thread, "Ticket record creation failed")
            await interaction
                .editReply({
                    content: messages.ticket.recordFailed,
                })
                .catch(() => null)
            return
        }

        const mentions = [
            `<@${interaction.user.id}>`,
            ...category.supportRoleIds.map((roleId) => `<@&${roleId}>`),
        ].join(" ")

        const starter = await thread
            .send({
                content: mentions,
                embeds: [
                    buildTicketThreadEmbed({
                        language: categoryContext.config.defaultLanguage,
                        category,
                        ticket: {
                            ticketNumber: recordResponse.ticket.ticketNumber,
                            categoryLabel: recordResponse.ticket.categoryLabel,
                            creatorId: interaction.user.id,
                        },
                        answers: answers.map((answer) => ({
                            label: answer.label,
                            value: answer.value,
                        })),
                        creatorTag: interaction.user.tag,
                    }),
                ],
            })
            .catch(async (error) => {
                logError(
                    "interaction",
                    "Failed to send ticket starter message",
                    {
                        guildId: interaction.guildId,
                        threadId: thread.id,
                        userId: interaction.user.id,
                        error,
                    }
                )
                await reportClanDiscordError({
                    client,
                    guildId: interaction.guildId!,
                    error,
                    action: "Send the first ticket message",
                    location: "Ticket system",
                    scope: "interaction",
                    target: thread.name,
                    details: {
                        threadId: thread.id,
                        user: interaction.user.tag,
                    },
                })
                return null
            })
        if (!starter) {
            const ticketUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`
            await interaction
                .editReply({
                    content: formatTemplate(messages.ticket.introFailed, {
                        url: ticketUrl,
                    }),
                })
                .catch(() => null)
            return
        }

        await convex
            .mutation(references.updateTicketTranscriptMessage, {
                secret: env.internalSecret,
                threadId: thread.id,
                transcriptMessageId: starter.id,
            })
            .catch((error) => {
                logWarn(
                    "interaction",
                    "Failed to store ticket transcript message id",
                    {
                        guildId: interaction.guildId,
                        threadId: thread.id,
                        messageId: starter.id,
                        error,
                    }
                )
                return null
            })

        await thread
            .setName(
                `${slugifyTicketLabel(recordResponse.ticket.categoryLabel)}-${recordResponse.ticket.ticketNumber}`.slice(
                    0,
                    100
                )
            )
            .catch((error) => {
                logWarn("interaction", "Failed to rename ticket thread", {
                    guildId: interaction.guildId,
                    threadId: thread.id,
                    error,
                })
                void reportClanDiscordError({
                    client,
                    guildId: interaction.guildId!,
                    error,
                    action: "Rename a ticket thread",
                    location: "Ticket system",
                    scope: "interaction",
                    target: thread.name,
                    details: {
                        threadId: thread.id,
                    },
                })
                return null
            })

        const ticketUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`
        await interaction.editReply({
            content: formatTemplate(messages.ticket.created, {
                url: ticketUrl,
            }),
        })
    }

    /** The server's name for DMs, read again when it is not cached. */
    async function resolveGuildName(interaction: ChatInputCommandInteraction) {
        if (interaction.guild?.name) return interaction.guild.name
        if (!interaction.guildId) return undefined
        try {
            return (await interaction.client.guilds.fetch(interaction.guildId))
                .name
        } catch {
            return undefined
        }
    }

    async function handleCloseTicketCommand(
        interaction: ChatInputCommandInteraction
    ) {
        if (
            !interaction.inGuild() ||
            !interaction.channel?.isThread() ||
            !interaction.guildId
        ) {
            await interaction.reply({
                content: getMembershipMessages(
                    await interactionLanguage(interaction.guildId)
                ).ticket.closeCommandThreadOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const context = (await convex.query(references.getTicketThreadContext, {
            secret: env.internalSecret,
            threadId: interaction.channelId,
        })) as {
            config: EventInteractionContext["config"]
            ticket: TicketThreadRecord
            category: TicketCategory | null
        } | null
        const messages = getMembershipMessages(context?.config.defaultLanguage)
        const guildName =
            (await resolveGuildName(interaction)) ??
            messages.ticket.serverFallback

        if (!context) {
            await interaction.editReply({ content: messages.ticket.notTracked })
            return
        }

        if (context.ticket.status === "closed") {
            await interaction.editReply({
                content: messages.ticket.alreadyClosed,
            })
            return
        }

        // Same fresh check as /close_application (M3-04).
        const authority = await checkCloseAuthority(
            interaction.guild,
            interaction.user.id,
            {
                dashboardAdminRoleId: context.config.dashboardAdminRoleId,
                supportRoleIds: context.category?.supportRoleIds,
            }
        )
        if (authority !== "allowed") {
            await interaction.editReply({
                content:
                    authority === "denied"
                        ? messages.ticket.noClosePermission
                        : messages.ticket.unableToVerifyPermissions,
            })
            return
        }

        const reason =
            interaction.options.getString("reason")?.trim() || undefined
        const closedAt = new Date()

        await convex.mutation(references.closeTicketThread, {
            secret: env.internalSecret,
            threadId: interaction.channelId,
            closedByUserId: interaction.user.id,
            closeReason: reason,
        })

        const creator = await interaction.client.users
            .fetch(context.ticket.creatorId)
            .catch(() => null)
        if (creator) {
            const dmLines = [
                formatTemplate(messages.ticket.closeDmClosed, {
                    number: String(context.ticket.ticketNumber),
                    guildName,
                }),
                reason
                    ? `${messages.ticket.reasonLabel}: ${reason}`
                    : messages.ticket.noCloseReasonProvided,
            ]
            await creator
                .send({ content: dmLines.join("\n") })
                .catch(() => null)
        }

        await interaction.channel
            .send({
                embeds: [
                    buildTicketCloseEmbed({
                        messages,
                        ticketNumber: context.ticket.ticketNumber,
                        closerId: interaction.user.id,
                        closedAt,
                        reason,
                    }),
                ],
            })
            .catch(() => null)

        await interaction.channel
            .setName(`closed-${context.ticket.ticketNumber}`.slice(0, 100))
            .catch(() => null)
        await interaction.channel
            .setLocked(true, reason ?? messages.ticket.closeAuditReason)
            .catch(() => null)
        await interaction.channel
            .setArchived(true, reason ?? messages.ticket.closeAuditReason)
            .catch(() => null)

        await interaction.editReply({
            content: reason
                ? formatTemplate(messages.ticket.closeReplyWithReason, {
                      reason,
                  })
                : messages.ticket.closeReply,
        })
    }
}
