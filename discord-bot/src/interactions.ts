import {
    ActionRowBuilder,
    type APIMessageComponentEmoji,
    AutocompleteInteraction,
    ButtonBuilder,
    ButtonInteraction,
    ButtonStyle,
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
import { skipsPendingOnApply } from "../../src/domain/membership/membership-options"
import { getMembershipMessages } from "../../src/lib/clan-language/membership"
import { withGameOverrides, type GameId } from "../../src/domain/games/game"
import { getCommandMessages } from "../../src/lib/clan-language/commands"
import { getEventMessages } from "../../src/lib/clan-language/events"
import type { ClanLanguage } from "../../src/lib/clan-language/core"

import {
    buildMockPlayerMessage,
    buildPlatformGuideMessage,
    buildPlatformLinkApplyModalId,
    buildPlatformLinkCustomId,
    buildPlatformLinkManageMessage,
    buildPlatformLinkModalId,
    buildPlatformLinkMockApplyModalId,
    buildPlatformLinkSearchModalId,
    buildPlayerSearchResultsMessage,
    buildPlatformSelectMessageWithEmojis,
    buildPlayedBeforeMessage,
    getPlatformFlowMessages,
    buildUnlinkPlatformMessage,
    parsePlatformLinkApplyModalId,
    parsePlatformLinkInteractionId,
    parsePlatformLinkModalId,
    parsePlatformLinkMockApplyModalId,
    parsePlatformLinkSearchModalId,
} from "./interactions/platform-link"
import {
    buildMembershipFlowCancelledMessage,
    buildMembershipFlowHeader,
    buildMembershipFlowMessage,
    getMembershipFlowCancelLabel,
    getMembershipFlowExpiredMessage,
    type MembershipFlowStep,
} from "./interactions/membership-flow"
import {
    cleanupThread,
    formatTemplate,
    getOutcomeLabel,
    loadMembershipCategoryContext,
    loadTicketCategoryContext,
    resolveSupportMemberIds,
    rollbackMembershipApplicationSetup,
} from "./interactions/shared"
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
import type {
    EventInteractionContext,
    MembershipApplicationThreadRecord,
    MembershipCategory,
    TicketCategory,
    TicketThreadRecord,
} from "./types"
import {
    buildMembershipCategorySelectionMessage,
    buildMembershipGameSelectionMessage,
} from "./message-builders"
import {
    detectPlatformFromStatsId,
    extractPlayerSearchResults,
} from "./interactions/player-search"
import {
    buildServerStatusCommand,
    handleServerStatusCommand,
} from "./interactions/server-status"
import {
    buildMembershipApplicationThreadEmbed,
    buildTicketThreadEmbed,
} from "./message-builders"
import { buildMembershipApplicationWelcomeContent } from "./interactions/membership-welcome"
import { handleMatchRecapPreference } from "./interactions/match-recap-preference"
import { checkCloseAuthority } from "./interactions/close-authority"
import { statsController } from "./interactions/stats-live"
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

type InteractionHandlerOptions = {
    enqueueEventSync: (eventId: string) => void
    triggerPollSoon: () => void
}

type TicketAnswer = {
    questionId: string
    label: string
    value: string
}

type MembershipAnswer = TicketAnswer

function parseGameId(value: string | undefined): GameId | undefined {
    return value === "hell_let_loose" ||
        value === "hell_let_loose_vietnam" ||
        value === "wardogs"
        ? value
        : undefined
}

function getMembershipPlatformReuseCopy(
    language: ClanLanguage,
    linkedThroughAnotherGame: boolean
) {
    switch (language) {
        case "cs":
            return {
                prompt: linkedThroughAnotherGame
                    ? "Našli jsme platform ID propojené s vaším účtem pro jinou hru. Chcete ho použít i pro tuto přihlášku?"
                    : "Už máte propojené platform ID. Chcete ho použít i pro tuto přihlášku?",
                reuse: "Použít propojené ID",
                linkAnother: "Propojit jiné ID",
            }
        case "de":
            return {
                prompt: linkedThroughAnotherGame
                    ? "Wir haben eine Plattform-ID gefunden, die über dein Konto mit einem anderen Spiel verknüpft ist. Möchtest du sie auch für diese Bewerbung verwenden?"
                    : "Du hast bereits eine Plattform-ID verknüpft. Möchtest du sie auch für diese Bewerbung verwenden?",
                reuse: "Verknüpfte ID verwenden",
                linkAnother: "Andere ID verknüpfen",
            }
        default:
            return {
                prompt: linkedThroughAnotherGame
                    ? "We found a platform ID linked to your account for another game. Would you like to use it for this application?"
                    : "You already have a linked platform ID. Would you like to use it for this application?",
                reuse: "Use linked ID",
                linkAnother: "Link another ID",
            }
    }
}

type MembershipPrereq = {
    config: EventInteractionContext["config"]
    category: MembershipCategory
    user: { platformIds?: string[] } | null
    assignment: { id: string; membershipCategoryId?: string } | null
    hasOpenApplication: boolean
    hasAssignmentInOtherGame: boolean
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

export function buildMembershipApplicationCloseEmbed(input: {
    messages: ReturnType<typeof getMembershipMessages>
    applicationNumber: number
    closerId: string
    closedAt: Date
    outcomeLabel: string
    reason?: string
}) {
    const {
        messages,
        applicationNumber,
        closerId,
        closedAt,
        outcomeLabel,
        reason,
    } = input

    const embed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(
            `${messages.membership.closeEmbedTitle} #${applicationNumber}`
        )
        .addFields(
            {
                name: messages.membership.closedByLabel,
                value: `<@${closerId}>`,
                inline: true,
            },
            {
                name: messages.membership.closedAtLabel,
                value: formatDiscordTimestamp(closedAt),
                inline: true,
            },
            {
                name: messages.membership.outcomeLabel,
                value: outcomeLabel,
                inline: true,
            }
        )
        .setTimestamp(closedAt)

    if (reason) {
        embed.addFields({
            name: messages.membership.reasonLabel,
            value: reason,
        })
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
    return {
        async handleButtonInteraction(interaction: ButtonInteraction) {
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

            if (interaction.customId.startsWith("membership:")) {
                await handleMembershipButtonInteraction(interaction)
                return
            }

            if (interaction.customId.startsWith("membership-flow:")) {
                await handleMembershipFlowInteraction(interaction)
                return
            }

            if (interaction.customId.startsWith("membership-reuse:")) {
                await handleMembershipPlatformReuseInteraction(interaction)
                return
            }

            if (interaction.customId.startsWith("plink:")) {
                await handlePlatformLinkButtonInteraction(interaction)
            }
        },

        async handleStringSelectMenuInteraction(
            interaction: StringSelectMenuInteraction
        ) {
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
            if (await handlePlayerReport(interaction)) return
            if (interaction.customId.startsWith("stats:")) {
                await statsController.modal(interaction)
            } else if (interaction.customId.startsWith("ticket-modal:")) {
                await handleTicketModalSubmit(interaction)
            } else if (interaction.customId.startsWith("membership-modal:")) {
                await handleMembershipModalSubmit(interaction)
            } else if (
                interaction.customId.startsWith("membership-flow-modal:")
            ) {
                await handleMembershipFlowModalSubmit(interaction)
            } else if (interaction.customId.startsWith("plink-modal:")) {
                await handlePlatformLinkModalSubmit(interaction)
            } else if (interaction.customId.startsWith("plink-search:")) {
                await handlePlatformLinkSearchModalSubmit(interaction)
            } else if (interaction.customId.startsWith("plink-apply:")) {
                await handlePlatformLinkApplyModalSubmit(interaction)
            } else if (interaction.customId.startsWith("plink-mock-apply:")) {
                await handlePlatformLinkMockApplyModalSubmit(interaction)
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
            if (interaction.commandName === "stats") {
                await statsController.autocomplete(interaction)
            } else if (interaction.commandName === "notice") {
                await handleNoticeAutocomplete(interaction)
            } else if (interaction.commandName === "player") {
                await handlePlayerAutocomplete(interaction)
            }
        },

        async handleChatInputCommand(interaction: ChatInputCommandInteraction) {
            if (interaction.commandName === "stats") {
                await statsController.command(interaction)
            } else if (interaction.commandName === "server-status") {
                await handleServerStatusCommand(interaction)
            } else if (interaction.commandName === "close_ticket") {
                await handleCloseTicketCommand(interaction)
            } else if (interaction.commandName === "close_application") {
                await handleCloseApplicationCommand(interaction)
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
                new SlashCommandBuilder()
                    .setName("close_application")
                    .setDescription(
                        messages.commands.closeApplicationDescription
                    )
                    .setDescriptionLocalizations({
                        cs: getCommandMessages("cs").commands
                            .closeApplicationDescription,
                        de: getCommandMessages("de").commands
                            .closeApplicationDescription,
                    })
                    .addStringOption((option) =>
                        option
                            .setName("outcome")
                            .setDescription(
                                messages.commands.outcomeOptionDescription
                            )
                            .setDescriptionLocalizations({
                                cs: getCommandMessages("cs").commands
                                    .outcomeOptionDescription,
                                de: getCommandMessages("de").commands
                                    .outcomeOptionDescription,
                            })
                            .setRequired(true)
                            .addChoices(
                                {
                                    name: getCommandMessages("en").commands
                                        .outcomeDenied,
                                    value: "denied",
                                    name_localizations: {
                                        cs: getCommandMessages("cs").commands
                                            .outcomeDenied,
                                        de: getCommandMessages("de").commands
                                            .outcomeDenied,
                                    },
                                },
                                {
                                    name: getCommandMessages("en").commands
                                        .outcomePending,
                                    value: "pending",
                                    name_localizations: {
                                        cs: getCommandMessages("cs").commands
                                            .outcomePending,
                                        de: getCommandMessages("de").commands
                                            .outcomePending,
                                    },
                                },
                                {
                                    name: getCommandMessages("en").commands
                                        .outcomeRecruit,
                                    value: "recruit",
                                    name_localizations: {
                                        cs: getCommandMessages("cs").commands
                                            .outcomeRecruit,
                                        de: getCommandMessages("de").commands
                                            .outcomeRecruit,
                                    },
                                },
                                {
                                    name: getCommandMessages("en").commands
                                        .outcomeMember,
                                    value: "member",
                                    name_localizations: {
                                        cs: getCommandMessages("cs").commands
                                            .outcomeMember,
                                        de: getCommandMessages("de").commands
                                            .outcomeMember,
                                    },
                                },
                                {
                                    name: getCommandMessages("en").commands
                                        .outcomeMercenary,
                                    value: "mercenary",
                                    name_localizations: {
                                        cs: getCommandMessages("cs").commands
                                            .outcomeMercenary,
                                        de: getCommandMessages("de").commands
                                            .outcomeMercenary,
                                    },
                                }
                            )
                    )
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

    async function getMembershipFlowDraft(
        draftId: string,
        guildId: string,
        creatorId: string
    ) {
        return (await convex.query(references.getMembershipApplicationDraft, {
            secret: env.internalSecret,
            draftId: draftId as never,
            guildId,
            creatorId,
        })) as {
            id: string
            categoryId: string
            gameId?: GameId
            specialization?: "infantry" | "armour"
            answers: MembershipAnswer[]
            step: MembershipFlowStep
        }
    }

    async function renderMembershipFlow(
        interaction:
            | ButtonInteraction
            | StringSelectMenuInteraction
            | ModalSubmitInteraction,
        draft: Awaited<ReturnType<typeof getMembershipFlowDraft>>,
        language: ClanLanguage,
        step: MembershipFlowStep,
        category: MembershipCategory,
        platformLinked: boolean,
        mode: "update" | "reply" = "update"
    ) {
        const message = buildMembershipFlowMessage({
            language,
            draftId: draft.id,
            step,
            gameId: draft.gameId,
            specialization: draft.specialization,
            platformLinked,
            hasQuestions: category.modalQuestions.length > 0,
            answers: draft.answers,
        })
        const payload = {
            ...message,
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }
        if (mode === "reply") {
            await interaction.reply(payload)
        } else if (interaction.isModalSubmit()) {
            // discord.js exposes `update` on modal submits at runtime, but its
            // TypeScript declaration omits it. This is Discord's component
            // interaction response and updates the originating ephemeral card.
            const updateModalMessage = Reflect.get(interaction, "update")
            if (typeof updateModalMessage === "function") {
                await Reflect.apply(updateModalMessage, interaction, [payload])
            } else {
                await interaction.reply(payload)
            }
        } else {
            await interaction.update(payload)
        }
    }

    function buildMembershipPlatformFlowMessage<
        T extends readonly ActionRowBuilder<
            ButtonBuilder | StringSelectMenuBuilder
        >[],
    >(
        language: ClanLanguage,
        draftId: string,
        legacyMessage: { embeds: readonly EmbedBuilder[]; components: T }
    ) {
        const container = new ContainerBuilder().setAccentColor(0x5865f2)
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `# ${getMembershipMessages(language).membership.modalTitle}`
            )
        )
        container.addSeparatorComponents(new SeparatorBuilder())
        const description = legacyMessage.embeds[0]?.data.description
        if (description) {
            container.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(description)
            )
        }
        for (const row of legacyMessage.components) {
            container.addActionRowComponents(row)
        }
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`membership-flow:${draftId}:cancel`)
                    .setLabel(getMembershipFlowCancelLabel(language))
                    .setStyle(ButtonStyle.Danger)
            )
        )
        return {
            components: [
                buildMembershipFlowHeader(language, "account"),
                container,
            ],
            flags: MessageFlags.IsComponentsV2,
        }
    }

    async function updateMembershipPlatformFlow(
        interaction: ButtonInteraction | StringSelectMenuInteraction,
        language: ClanLanguage,
        context: {
            mode: "membership" | "link"
            draftId?: string
        },
        legacyMessage: {
            embeds: readonly EmbedBuilder[]
            components: readonly ActionRowBuilder<
                ButtonBuilder | StringSelectMenuBuilder
            >[]
        }
    ) {
        if (context.mode === "membership" && context.draftId) {
            await interaction.update({
                ...buildMembershipPlatformFlowMessage(
                    language,
                    context.draftId,
                    legacyMessage
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            return
        }
        await interaction.update(legacyMessage)
    }

    async function resumeMembershipDraftAfterPlatformLink(
        interaction:
            | ButtonInteraction
            | StringSelectMenuInteraction
            | ModalSubmitInteraction,
        draftId: string
    ) {
        if (!interaction.guildId) return
        const draft = await getMembershipFlowDraft(
            draftId,
            interaction.guildId,
            interaction.user.id
        ).catch(() => null)
        const context = draft?.gameId
            ? await loadMembershipCategoryContext(
                  interaction.guildId,
                  draft.categoryId,
                  draft.gameId
              )
            : null
        if (!draft?.gameId || !context) {
            // The platform ID is already saved; tell the applicant why the wizard stopped.
            const config = (await convex.query(
                references.getConfigByDiscordGuildId,
                { secret: env.internalSecret, guildId: interaction.guildId }
            )) as { defaultLanguage?: string } | null
            await interaction
                .reply({
                    content: getMembershipFlowExpiredMessage(
                        config?.defaultLanguage
                    ),
                    flags: MessageFlags.Ephemeral,
                })
                .catch(() => null)
            return
        }
        // The account step is complete; a category without questions goes straight to review.
        const nextStep: MembershipFlowStep = context.category.modalQuestions
            .length
            ? "questions"
            : "review"
        await convex.mutation(references.updateMembershipApplicationDraft, {
            secret: env.internalSecret,
            draftId: draftId as never,
            guildId: interaction.guildId,
            creatorId: interaction.user.id,
            step: nextStep,
        })
        const updatedDraft = await getMembershipFlowDraft(
            draftId,
            interaction.guildId,
            interaction.user.id
        )
        const language = context.config.defaultLanguage as ClanLanguage
        await renderMembershipFlow(
            interaction,
            updatedDraft,
            language,
            nextStep,
            context.category,
            true,
            "update"
        )
    }

    async function handleMembershipFlowInteraction(
        interaction: ButtonInteraction
    ) {
        if (!interaction.guildId) return
        const [, draftId, ...actionParts] = interaction.customId.split(":")
        const action = actionParts.join(":")
        if (!draftId || !action) return

        let draft: Awaited<ReturnType<typeof getMembershipFlowDraft>>
        try {
            draft = await getMembershipFlowDraft(
                draftId,
                interaction.guildId,
                interaction.user.id
            )
        } catch {
            const config = (await convex.query(
                references.getConfigByDiscordGuildId,
                { secret: env.internalSecret, guildId: interaction.guildId }
            )) as { defaultLanguage?: string } | null
            await interaction.reply({
                content: getMembershipFlowExpiredMessage(
                    config?.defaultLanguage
                ),
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const config = (await convex.query(
            references.getConfigByDiscordGuildId,
            { secret: env.internalSecret, guildId: interaction.guildId }
        )) as EventInteractionContext["config"] | null
        const language = getEventMessages(
            config?.defaultLanguage
        ).locale.startsWith("cs")
            ? "cs"
            : getEventMessages(config?.defaultLanguage).locale.startsWith("de")
              ? "de"
              : "en"

        if (action === "cancel") {
            await convex.mutation(
                references.discardMembershipApplicationDraft,
                {
                    secret: env.internalSecret,
                    draftId: draftId as never,
                    guildId: interaction.guildId,
                    creatorId: interaction.user.id,
                }
            )
            await interaction.update({
                ...buildMembershipFlowCancelledMessage(language),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            return
        }

        if (action.startsWith("game:")) {
            const gameId = parseGameId(action.slice("game:".length))
            if (!gameId) return
            const context = await loadMembershipCategoryContext(
                interaction.guildId,
                draft.categoryId,
                gameId
            )
            if (!context) {
                await interaction.reply({
                    content:
                        getMembershipMessages(language).membership.unavailable,
                    flags: MessageFlags.Ephemeral,
                })
                return
            }
            const step: MembershipFlowStep = "account"
            await convex.mutation(references.updateMembershipApplicationDraft, {
                secret: env.internalSecret,
                draftId: draftId as never,
                guildId: interaction.guildId,
                creatorId: interaction.user.id,
                gameId,
                step,
            })
            draft = await getMembershipFlowDraft(
                draftId,
                interaction.guildId,
                interaction.user.id
            )
            const prereq = await loadMembershipApplicationPrereq(
                interaction.guildId,
                draft.categoryId,
                interaction.user.id,
                gameId
            )
            await renderMembershipFlow(
                interaction,
                draft,
                language,
                step,
                context.category,
                Boolean(prereq?.user?.platformIds?.length)
            )
            return
        }

        if (action.startsWith("specialization:")) {
            const specialization = action.slice("specialization:".length)
            if (specialization !== "infantry" && specialization !== "armour")
                return
            await convex.mutation(references.updateMembershipApplicationDraft, {
                secret: env.internalSecret,
                draftId: draftId as never,
                guildId: interaction.guildId,
                creatorId: interaction.user.id,
                specialization,
                step: "account",
            })
            draft = await getMembershipFlowDraft(
                draftId,
                interaction.guildId,
                interaction.user.id
            )
        }

        if (action === "back") {
            await convex.mutation(references.updateMembershipApplicationDraft, {
                secret: env.internalSecret,
                draftId: draftId as never,
                guildId: interaction.guildId,
                creatorId: interaction.user.id,
                step: "questions",
            })
            draft = await getMembershipFlowDraft(
                draftId,
                interaction.guildId,
                interaction.user.id
            )
        }

        if (action === "questions") {
            const context = draft.gameId
                ? await loadMembershipCategoryContext(
                      interaction.guildId,
                      draft.categoryId,
                      draft.gameId
                  )
                : null
            if (!context) return
            if (!context.category.modalQuestions.length) {
                await convex.mutation(
                    references.updateMembershipApplicationDraft,
                    {
                        secret: env.internalSecret,
                        draftId: draftId as never,
                        guildId: interaction.guildId,
                        creatorId: interaction.user.id,
                        step: "review",
                    }
                )
                draft = await getMembershipFlowDraft(
                    draftId,
                    interaction.guildId,
                    interaction.user.id
                )
                const prereq = await loadMembershipApplicationPrereq(
                    interaction.guildId,
                    draft.categoryId,
                    interaction.user.id,
                    draft.gameId
                )
                await renderMembershipFlow(
                    interaction,
                    draft,
                    language,
                    "review",
                    context.category,
                    Boolean(prereq?.user?.platformIds?.length)
                )
                return
            }
            await interaction.showModal(
                buildMembershipQuestionsModal(
                    `membership-flow-modal:${draftId}`,
                    context.category,
                    getMembershipMessages(language).membership.modalTitle,
                    5
                )
            )
            return
        }

        if (action === "submit" && draft.gameId) {
            const prereq = await loadMembershipApplicationPrereq(
                interaction.guildId,
                draft.categoryId,
                interaction.user.id,
                draft.gameId
            )
            if (
                !prereq ||
                prereq.assignment ||
                prereq.hasOpenApplication ||
                !prereq.user?.platformIds?.length
            ) {
                await interaction.reply({
                    content:
                        getMembershipMessages(language).membership.unavailable,
                    flags: MessageFlags.Ephemeral,
                })
                return
            }
            const answers = draft.specialization
                ? [
                      {
                          questionId: "specialization",
                          label:
                              language === "cs"
                                  ? "Specializace"
                                  : language === "de"
                                    ? "Spezialisierung"
                                    : "Specialization",
                          value:
                              draft.specialization === "infantry"
                                  ? language === "cs"
                                      ? "Pěchota"
                                      : language === "de"
                                        ? "Infanterie"
                                        : "Infantry"
                                  : language === "cs"
                                    ? "Tank"
                                    : language === "de"
                                      ? "Panzer"
                                      : "Armour",
                      },
                      ...draft.answers,
                  ]
                : draft.answers
            await createDiscordMembershipApplication(
                interaction,
                prereq.category,
                answers,
                draft.gameId
            )
            return
        }

        if (action === "link") {
            await interaction.update({
                ...buildMembershipPlatformFlowMessage(
                    language,
                    draftId,
                    buildPlatformSelectMessageWithEmojis({
                        language,
                        context: {
                            mode: "membership",
                            categoryId: draft.categoryId,
                            gameId: draft.gameId,
                            draftId,
                        },
                        emojis: await getPlatformEmojis(),
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            return
        }

        if (action.startsWith("platform:")) {
            const platform = action.slice("platform:".length)
            if (
                platform !== "steam" &&
                platform !== "epic" &&
                platform !== "xbox" &&
                platform !== "playstation"
            ) {
                return
            }
            await interaction.showModal(
                buildPlatformIdOnlyModal(
                    buildPlatformLinkModalId(
                        {
                            mode: "membership",
                            categoryId: draft.categoryId,
                            gameId: draft.gameId,
                            draftId,
                        },
                        platform
                    ),
                    platform,
                    language,
                    getMembershipMessages(language).membership.modalTitle
                )
            )
            return
        }

        const context = draft.gameId
            ? await loadMembershipCategoryContext(
                  interaction.guildId,
                  draft.categoryId,
                  draft.gameId
              )
            : null
        if (!context) return
        const prereq = await loadMembershipApplicationPrereq(
            interaction.guildId,
            draft.categoryId,
            interaction.user.id,
            draft.gameId
        )
        const nextStep: MembershipFlowStep = action.startsWith(
            "specialization:"
        )
            ? "account"
            : draft.step === "questions" &&
                !context.category.modalQuestions.length
              ? "account"
              : draft.step
        await renderMembershipFlow(
            interaction,
            draft,
            language,
            nextStep,
            context.category,
            Boolean(prereq?.user?.platformIds?.length)
        )
    }

    async function handleMembershipFlowModalSubmit(
        interaction: ModalSubmitInteraction
    ) {
        if (!interaction.guildId) return
        const draftId = interaction.customId.replace(
            "membership-flow-modal:",
            ""
        )
        const draft = await getMembershipFlowDraft(
            draftId,
            interaction.guildId,
            interaction.user.id
        ).catch(() => null)
        if (!draft?.gameId) return
        const context = await loadMembershipCategoryContext(
            interaction.guildId,
            draft.categoryId,
            draft.gameId
        )
        if (!context) return
        const answers = context.category.modalQuestions.map((question) => ({
            questionId: question.id,
            label: question.label,
            value: interaction.fields.getTextInputValue(question.id).trim(),
        }))
        await convex.mutation(references.updateMembershipApplicationDraft, {
            secret: env.internalSecret,
            draftId: draftId as never,
            guildId: interaction.guildId,
            creatorId: interaction.user.id,
            answers,
            step: "review",
        })
        const updatedDraft = await getMembershipFlowDraft(
            draftId,
            interaction.guildId,
            interaction.user.id
        )
        const prereq = await loadMembershipApplicationPrereq(
            interaction.guildId,
            updatedDraft.categoryId,
            interaction.user.id,
            updatedDraft.gameId
        )
        const language = getEventMessages(
            context.config.defaultLanguage
        ).locale.startsWith("cs")
            ? "cs"
            : getEventMessages(
                    context.config.defaultLanguage
                ).locale.startsWith("de")
              ? "de"
              : "en"
        await renderMembershipFlow(
            interaction,
            updatedDraft,
            language,
            "review",
            context.category,
            Boolean(prereq?.user?.platformIds?.length)
        )
    }

    async function handleMembershipButtonInteraction(
        interaction: ButtonInteraction
    ) {
        const fallbackMessages = getMembershipMessages("en")
        if (!interaction.guildId || !interaction.guild) {
            await interaction.reply({
                content: fallbackMessages.membership.serverOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const membershipAction = interaction.customId.replace("membership:", "")
        const config = (await convex.query(
            references.getConfigByDiscordGuildId,
            { secret: env.internalSecret, guildId: interaction.guildId }
        )) as EventInteractionContext["config"] | null
        const language = config?.defaultLanguage as ClanLanguage
        if (!config?.membershipSettings?.enabled) {
            await interaction.reply({
                content: fallbackMessages.membership.unavailable,
                flags: MessageFlags.Ephemeral,
            })
            return
        }
        if (membershipAction === "apply") {
            await interaction.reply({
                ...buildMembershipGameSelectionMessage(config),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            return
        }
        if (membershipAction.startsWith("game:")) {
            const gameId = parseGameId(membershipAction.slice("game:".length))
            if (!gameId) return
            await interaction.update({
                ...buildMembershipCategorySelectionMessage(config, gameId),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
            return
        }

        const [gameIdOrCategoryId, legacyCategoryId] = membershipAction
            .replace("membership:", "")
            .split(":", 2)
        const categoryId = legacyCategoryId ?? gameIdOrCategoryId
        const gameId = legacyCategoryId
            ? parseGameId(gameIdOrCategoryId)
            : undefined
        if (legacyCategoryId && !gameId) return

        const draft = (await convex.mutation(
            references.createMembershipApplicationDraft,
            {
                secret: env.internalSecret,
                guildId: interaction.guildId,
                creatorId: interaction.user.id,
                categoryId,
                gameId,
            }
        )) as { id: string }
        const storedDraft = await getMembershipFlowDraft(
            draft.id,
            interaction.guildId,
            interaction.user.id
        )
        const prereq = await loadMembershipApplicationPrereq(
            interaction.guildId,
            categoryId,
            interaction.user.id,
            storedDraft.gameId
        )
        const membershipLanguage = prereq?.config.defaultLanguage ?? language
        if (!prereq?.config.membershipSettings?.enabled) {
            await interaction.reply({
                content: fallbackMessages.membership.unavailable,
                flags: MessageFlags.Ephemeral,
            })
            return
        }
        if (prereq.assignment) {
            await interaction.reply({
                content:
                    getMembershipMessages(membershipLanguage).membership
                        .alreadyInClan,
                flags: MessageFlags.Ephemeral,
            })
            return
        }
        if (prereq.hasOpenApplication) {
            await interaction.reply({
                content:
                    getMembershipMessages(membershipLanguage).membership
                        .openApplicationExists,
                flags: MessageFlags.Ephemeral,
            })
            return
        }
        if (prereq.user?.platformIds?.length && gameId) {
            const reuseCopy = getMembershipPlatformReuseCopy(
                membershipLanguage,
                prereq.hasAssignmentInOtherGame
            )
            const reuseMessage = new ContainerBuilder().setAccentColor(0x5865f2)
            reuseMessage.addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `# ${getMembershipMessages(membershipLanguage).membership.modalTitle}\n${reuseCopy.prompt}`
                )
            )
            reuseMessage.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    new ButtonBuilder()
                        .setCustomId(
                            `membership-reuse:${draft.id}:${gameId}:${categoryId}:yes`
                        )
                        .setLabel(reuseCopy.reuse)
                        .setStyle(ButtonStyle.Primary),
                    new ButtonBuilder()
                        .setCustomId(
                            `membership-reuse:${draft.id}:${gameId}:${categoryId}:no`
                        )
                        .setLabel(reuseCopy.linkAnother)
                        .setStyle(ButtonStyle.Secondary),
                    new ButtonBuilder()
                        .setCustomId(`membership-flow:${draft.id}:cancel`)
                        .setLabel(
                            getMembershipFlowCancelLabel(membershipLanguage)
                        )
                        .setStyle(ButtonStyle.Danger)
                )
            )
            const reusePayload = {
                components: [
                    buildMembershipFlowHeader(membershipLanguage, "account"),
                    reuseMessage,
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            }
            if (interaction.message.flags.has(MessageFlags.IsComponentsV2)) {
                await interaction.update(reusePayload)
            } else {
                await interaction.reply(reusePayload)
            }
            return
        }
        const membershipFlowMessage = {
            ...buildMembershipFlowMessage({
                language: membershipLanguage,
                draftId: draft.id,
                step: storedDraft.step,
                gameId: storedDraft.gameId,
                platformLinked: Boolean(prereq.user?.platformIds?.length),
            }),
            flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
        }
        if (interaction.message.flags.has(MessageFlags.IsComponentsV2)) {
            await interaction.update(membershipFlowMessage)
        } else {
            await interaction.reply(membershipFlowMessage)
        }
        return
    }

    async function handleMembershipPlatformReuseInteraction(
        interaction: ButtonInteraction
    ) {
        const [, draftId, gameIdRaw, categoryId, choice] =
            interaction.customId.split(":")
        const gameId = parseGameId(gameIdRaw)
        if (
            !interaction.guildId ||
            !draftId ||
            !gameId ||
            !categoryId ||
            !choice
        )
            return

        const prereq = await loadMembershipApplicationPrereq(
            interaction.guildId,
            categoryId,
            interaction.user.id,
            gameId
        )
        const messages = getMembershipMessages(prereq?.config.defaultLanguage)
        if (!prereq?.config.membershipSettings?.enabled || prereq.assignment) {
            await interaction.update({
                content: prereq?.assignment
                    ? messages.membership.alreadyInClan
                    : messages.membership.unavailable,
                components: [],
            })
            return
        }

        if (choice === "yes" && prereq.user?.platformIds?.length) {
            await resumeMembershipDraftAfterPlatformLink(interaction, draftId)
            return
        }

        if (choice === "no") {
            const draft = await getMembershipFlowDraft(
                draftId,
                interaction.guildId,
                interaction.user.id
            )
            await interaction.update({
                ...buildMembershipPlatformFlowMessage(
                    prereq.config.defaultLanguage as ClanLanguage,
                    draft.id,
                    buildPlatformSelectMessageWithEmojis({
                        language: prereq.config.defaultLanguage as ClanLanguage,
                        context: {
                            mode: "membership",
                            categoryId,
                            gameId,
                            draftId: draft.id,
                        },
                        emojis: await getPlatformEmojis(),
                    })
                ),
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2,
            })
        }
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

            if (context.mode === "membership" && context.categoryId) {
                const categoryContext = await loadMembershipCategoryContext(
                    interaction.guildId!,
                    context.categoryId,
                    context.gameId
                )
                const messages = getMembershipMessages(
                    categoryContext?.config.defaultLanguage ?? language
                )
                if (!categoryContext?.config.membershipSettings?.enabled) {
                    await interaction.reply({
                        content: messages.membership.unavailable,
                        flags: MessageFlags.Ephemeral,
                    })
                    return
                }

                if (
                    categoryContext.category.modalQuestions.length &&
                    !context.draftId
                ) {
                    await interaction.showModal(
                        buildPlatformAndMembershipModal(
                            context.categoryId,
                            parsed.extra,
                            categoryContext.category,
                            messages.membership.modalTitle,
                            context.gameId
                        )
                    )
                    return
                }
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
            if (context.mode === "membership" && context.categoryId) {
                const prereq = await loadMembershipApplicationPrereq(
                    interaction.guildId!,
                    context.categoryId,
                    interaction.user.id,
                    context.gameId
                )
                const messages = getMembershipMessages(
                    prereq?.config.defaultLanguage ?? language
                )
                if (!prereq?.config.membershipSettings?.enabled) {
                    await interaction.reply({
                        content: messages.membership.unavailable,
                        flags: MessageFlags.Ephemeral,
                    })
                    return
                }

                if (context.draftId) {
                    await savePlatformIdLink(
                        interaction.user.id,
                        interaction.user.globalName ??
                            interaction.user.username,
                        interaction.user.displayAvatarURL(),
                        value
                    )
                    await resumeMembershipDraftAfterPlatformLink(
                        interaction,
                        context.draftId
                    )
                    return
                }

                if (prereq.category.modalQuestions.length) {
                    await interaction.showModal(
                        buildPlayerLinkedMembershipModal(
                            context.categoryId,
                            value,
                            prereq.category,
                            messages.membership.modalTitle,
                            context.gameId
                        )
                    )
                    return
                }

                await savePlatformIdLink(
                    interaction.user.id,
                    interaction.user.globalName ?? interaction.user.username,
                    interaction.user.displayAvatarURL(),
                    value
                )
                await createDiscordMembershipApplication(
                    interaction,
                    prereq.category,
                    [],
                    context.gameId
                )
                return
            }

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

    async function handleMembershipModalSubmit(
        interaction: ModalSubmitInteraction
    ) {
        const fallbackMessages = getMembershipMessages("en")
        if (!interaction.guildId) {
            await interaction.reply({
                content: fallbackMessages.membership.serverOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const [gameIdRaw, categoryIdRaw] = interaction.customId
            .replace("membership-modal:", "")
            .split(":", 2)
        const gameId = categoryIdRaw ? parseGameId(gameIdRaw) : undefined
        const categoryId = categoryIdRaw ?? gameIdRaw
        const context = await loadMembershipCategoryContext(
            interaction.guildId,
            categoryId,
            gameId
        )
        const messages = getMembershipMessages(context?.config.defaultLanguage)
        if (!context?.config.membershipSettings?.enabled) {
            await interaction.reply({
                content: messages.membership.unavailable,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const answers = context.category.modalQuestions.map((question) => ({
            questionId: question.id,
            label: question.label,
            value: interaction.fields.getTextInputValue(question.id).trim(),
        }))

        await createDiscordMembershipApplication(
            interaction,
            context.category,
            answers,
            gameId
        )
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

        if (parsed.context.mode === "membership" && parsed.context.categoryId) {
            if (parsed.context.draftId) {
                await resumeMembershipDraftAfterPlatformLink(
                    interaction,
                    parsed.context.draftId
                )
                return
            }
            const prereq = await loadMembershipApplicationPrereq(
                interaction.guildId!,
                parsed.context.categoryId,
                interaction.user.id,
                parsed.context.gameId
            )
            if (!prereq) {
                await interaction.reply({
                    content: getMembershipMessages("en").membership.unavailable,
                    flags: MessageFlags.Ephemeral,
                })
                return
            }

            await createDiscordMembershipApplication(
                interaction,
                prereq.category,
                [],
                parsed.context.gameId
            )
            return
        }

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
        if (context.mode === "membership" && context.draftId) {
            await originalMessage.edit({
                components: buildMembershipPlatformFlowMessage(
                    language,
                    context.draftId,
                    searchResultsMessage
                ).components,
            })
            return
        }
        await originalMessage.edit(searchResultsMessage)
    }

    async function handlePlatformLinkApplyModalSubmit(
        interaction: ModalSubmitInteraction
    ) {
        const parsed = parsePlatformLinkApplyModalId(interaction.customId)
        const language = await getGuildLanguage(interaction.guildId)
        const flowMessages = getPlatformFlowMessages(language)
        if (!parsed || !interaction.guildId) {
            await interaction.reply({
                content: flowMessages.invalidModal,
                flags: MessageFlags.Ephemeral,
            })
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

        const context = await loadMembershipCategoryContext(
            interaction.guildId,
            parsed.categoryId,
            parsed.gameId
        )
        if (!context) {
            await interaction.reply({
                content: messages.membership.unavailable,
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
        await createDiscordMembershipApplication(
            interaction,
            context.category,
            collectMembershipAnswers(interaction, context.category, 4),
            parsed.gameId
        )
    }

    async function handlePlatformLinkMockApplyModalSubmit(
        interaction: ModalSubmitInteraction
    ) {
        const parsed = parsePlatformLinkMockApplyModalId(interaction.customId)
        const language = await getGuildLanguage(interaction.guildId)
        const flowMessages = getPlatformFlowMessages(language)
        if (!parsed || !interaction.guildId) {
            await interaction.reply({
                content: flowMessages.invalidModal,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const context = await loadMembershipCategoryContext(
            interaction.guildId,
            parsed.categoryId,
            parsed.gameId
        )
        const messages = getMembershipMessages(language)
        if (!context) {
            await interaction.reply({
                content: messages.membership.unavailable,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await savePlatformIdLink(
            interaction.user.id,
            interaction.user.globalName ?? interaction.user.username,
            interaction.user.displayAvatarURL(),
            parsed.mockPlayerId
        )
        await createDiscordMembershipApplication(
            interaction,
            context.category,
            collectMembershipAnswers(interaction, context.category, 5),
            parsed.gameId
        )
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

    async function loadMembershipApplicationPrereq(
        guildId: string,
        categoryId: string,
        userId: string,
        gameId?: "hell_let_loose" | "hell_let_loose_vietnam" | "wardogs"
    ) {
        return (await convex.query(references.getMembershipApplicationPrereq, {
            secret: env.internalSecret,
            guildId,
            categoryId,
            userId,
            gameId,
        })) as MembershipPrereq | null
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

    async function continueMembershipApplicationFlow(
        interaction: ButtonInteraction | StringSelectMenuInteraction,
        prereq: MembershipPrereq,
        gameId?: GameId
    ) {
        const messages = getMembershipMessages(prereq.config.defaultLanguage)
        if (prereq.category.modalQuestions.length) {
            await interaction.showModal(
                buildMembershipQuestionsModal(
                    `membership-modal:${gameId ? `${gameId}:` : ""}${prereq.category.id}`,
                    prereq.category,
                    messages.membership.modalTitle,
                    5
                )
            )
            return
        }

        await createDiscordMembershipApplication(
            interaction,
            prereq.category,
            [],
            gameId
        )
    }

    function buildMembershipQuestionsModal(
        customId: string,
        category: MembershipCategory,
        fallbackTitle: string,
        maxQuestions: number
    ) {
        const modal = new ModalBuilder()
            .setCustomId(customId)
            .setTitle((category.label?.trim() || fallbackTitle).slice(0, 45))

        for (const question of category.modalQuestions.slice(0, maxQuestions)) {
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
                new ActionRowBuilder<TextInputBuilder>().addComponents(input)
            )
        }

        return modal
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

    function buildPlatformAndMembershipModal(
        categoryId: string,
        platform: "steam" | "epic" | "xbox" | "playstation",
        category: MembershipCategory,
        fallbackTitle: string,
        gameId?: GameId
    ) {
        const modal = buildMembershipQuestionsModal(
            buildPlatformLinkApplyModalId(categoryId, platform, gameId),
            category,
            fallbackTitle,
            4
        )

        modal.components.unshift(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId("platformId")
                    .setLabel("Platform ID")
                    .setStyle(TextInputStyle.Short)
                    .setRequired(true)
                    .setMaxLength(200)
            )
        )

        return modal
    }

    function buildPlayerLinkedMembershipModal(
        categoryId: string,
        playerId: string,
        category: MembershipCategory,
        fallbackTitle: string,
        gameId?: GameId
    ) {
        return buildMembershipQuestionsModal(
            buildPlatformLinkMockApplyModalId(categoryId, playerId, gameId),
            category,
            fallbackTitle,
            5
        )
    }

    function collectMembershipAnswers(
        interaction: ModalSubmitInteraction,
        category: MembershipCategory,
        maxQuestions: number
    ) {
        return category.modalQuestions
            .slice(0, maxQuestions)
            .map((question) => ({
                questionId: question.id,
                label: question.label,
                value: interaction.fields.getTextInputValue(question.id).trim(),
            }))
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

    async function createDiscordMembershipApplication(
        interaction:
            | ButtonInteraction
            | StringSelectMenuInteraction
            | ModalSubmitInteraction,
        category: MembershipCategory,
        answers: MembershipAnswer[],
        gameId?: GameId
    ) {
        const fallbackMessages = getMembershipMessages("en")
        if (!interaction.guildId || !interaction.guild) {
            await interaction.reply({
                content: fallbackMessages.membership.serverOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        if (!interaction.deferred && !interaction.replied) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral })
        }

        const categoryContext = await loadMembershipCategoryContext(
            interaction.guildId,
            category.id,
            gameId
        )
        const membershipSettings = categoryContext?.config.membershipSettings
        const messages = getMembershipMessages(
            categoryContext?.config.defaultLanguage
        )
        if (
            !categoryContext ||
            !membershipSettings?.applicationParentChannelId
        ) {
            await interaction.editReply({
                content: messages.membership.setupIncomplete,
            })
            return
        }

        const existingAssignment = (await convex.query(
            references.getAssignmentForServerUser,
            {
                secret: env.internalSecret,
                serverDiscordId: interaction.guildId,
                userId: interaction.user.id,
                gameId,
            }
        )) as { id: string } | null
        if (existingAssignment) {
            await interaction.editReply({
                content: messages.membership.alreadyAssigned,
            })
            return
        }

        const parentChannel = await interaction.guild.channels
            .fetch(membershipSettings.applicationParentChannelId)
            .catch(() => null)
        if (!parentChannel || parentChannel.type !== ChannelType.GuildText) {
            await interaction.editReply({
                content: messages.membership.parentChannelNotText,
            })
            return
        }

        const initialStatus = skipsPendingOnApply(membershipSettings, category)
            ? "recruit"
            : "pending"

        const assignmentId = (await convex
            .mutation(references.upsertAssignment, {
                secret: env.internalSecret,
                roleActor: { userId: interaction.user.id, kind: "application" },
                serverDiscordId: interaction.guildId,
                userId: interaction.user.id,
                gameId,
                type: category.assignmentType,
                status: initialStatus,
                membershipCategoryId: category.id,
                primaryGroupId: undefined,
                secondaryGroupIds: [],
                paused: false,
                pausedNote: undefined,
            })
            .catch(async (error) => {
                logError(
                    "interaction",
                    "Failed to create membership assignment before application thread",
                    {
                        guildId: interaction.guildId,
                        userId: interaction.user.id,
                        categoryId: category.id,
                        error,
                    }
                )
                await interaction
                    .editReply({
                        content: messages.membership.createAssignmentFailed,
                    })
                    .catch(() => null)
                return null
            })) as string | null
        if (!assignmentId) {
            return
        }

        await revalidateAppData({
            type: "assignment-changed",
            serverId: interaction.guildId,
            userId: interaction.user.id,
            assignmentId,
        })

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
                reason: `Application ${category.id} opened by ${interaction.user.tag}`,
            })
            .catch(async (error) => {
                logError(
                    "interaction",
                    "Failed to create membership application thread",
                    {
                        guildId: interaction.guildId,
                        userId: interaction.user.id,
                        categoryId: category.id,
                        error,
                    }
                )
                await reportClanDiscordError({
                    client,
                    guildId: interaction.guildId!,
                    error,
                    action: "Create a membership application thread",
                    location: "Membership applications",
                    scope: "interaction",
                    target: category.label?.trim() || category.id,
                    details: {
                        user: interaction.user.tag,
                        categoryId: category.id,
                    },
                })
                await rollbackMembershipApplicationSetup({
                    guild: interaction.guild!,
                    userId: interaction.user.id,
                    config: categoryContext.config,
                    assignmentId,
                    assignmentType: category.assignmentType,
                    assignmentStatus: initialStatus,
                    membershipCategoryId: category.id,
                })
                await interaction
                    .editReply({
                        content: messages.membership.createThreadFailed,
                    })
                    .catch(() => null)
                return null
            })
        if (!thread) {
            return
        }

        const supportMemberIds = resolveSupportMemberIds(
            interaction.guild,
            category.supportRoleIds,
            membershipSettings.inviteSupportMembersIndividually !== false
        )
        const participantIds = [
            ...new Set([interaction.user.id, ...supportMemberIds]),
        ]
        for (const memberId of participantIds) {
            await thread.members.add(memberId).catch((error) => {
                logWarn(
                    "interaction",
                    "Failed to add membership application thread member",
                    {
                        guildId: interaction.guildId,
                        threadId: thread.id,
                        memberId,
                        error,
                    }
                )
                void reportClanDiscordError({
                    client,
                    guildId: interaction.guildId!,
                    error,
                    action: "Add a participant to a membership application thread",
                    location: "Membership applications",
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
            .mutation(references.createMembershipApplicationThread, {
                secret: env.internalSecret,
                guildId: interaction.guildId,
                threadId: thread.id,
                parentChannelId: parentChannel.id,
                creatorId: interaction.user.id,
                categoryId: category.id,
                gameId,
                assignmentType: category.assignmentType,
                assignmentId: assignmentId as never,
                answers,
            })
            .catch(async (error) => {
                logError(
                    "interaction",
                    "Failed to create membership application thread record",
                    {
                        guildId: interaction.guildId,
                        threadId: thread.id,
                        userId: interaction.user.id,
                        categoryId: category.id,
                        assignmentId,
                        error,
                    }
                )
                return null
            })) as {
            application: Pick<
                MembershipApplicationThreadRecord,
                "applicationNumber" | "categoryLabel" | "threadId"
            >
        } | null
        if (!recordResponse) {
            await cleanupThread(
                thread,
                "Membership application record creation failed"
            )
            await rollbackMembershipApplicationSetup({
                guild: interaction.guild!,
                userId: interaction.user.id,
                config: categoryContext.config,
                assignmentId,
                assignmentType: category.assignmentType,
                assignmentStatus: initialStatus,
                membershipCategoryId: category.id,
            })
            await interaction
                .editReply({
                    content: messages.membership.recordFailed,
                })
                .catch(() => null)
            return
        }

        const supportRoleIdsForMessage =
            membershipSettings.inviteSupportMembersIndividually === false
                ? category.supportRoleIds.slice(0, 10)
                : category.supportRoleIds
        const content = buildMembershipApplicationWelcomeContent({
            applicantId: interaction.user.id,
            supportRoleIds: supportRoleIdsForMessage,
            categoryLabel: category.label?.trim() || category.id,
            welcomeMessage: membershipSettings.applicationWelcomeMessage,
        })

        const starter = await thread
            .send({
                content,
                allowedMentions: {
                    users: [interaction.user.id],
                    roles: supportRoleIdsForMessage,
                },
                embeds: [
                    buildMembershipApplicationThreadEmbed({
                        language: categoryContext.config.defaultLanguage,
                        category,
                        application: {
                            applicationNumber:
                                recordResponse.application.applicationNumber,
                            categoryLabel:
                                recordResponse.application.categoryLabel,
                            creatorId: interaction.user.id,
                            assignmentType: category.assignmentType,
                        },
                        answers: answers.map((answer) => ({
                            label: answer.label,
                            value: answer.value,
                        })),
                        creatorTag: interaction.user.tag,
                        assignmentStatus: initialStatus,
                    }),
                ],
            })
            .catch(async (error) => {
                logError(
                    "interaction",
                    "Failed to send membership application starter message",
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
                    action: "Send the first membership application message",
                    location: "Membership applications",
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
            const threadUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`
            await interaction
                .editReply({
                    content: formatTemplate(messages.membership.introFailed, {
                        url: threadUrl,
                    }),
                })
                .catch(() => null)
            return
        }

        await convex
            .mutation(references.updateMembershipApplicationTranscriptMessage, {
                secret: env.internalSecret,
                threadId: thread.id,
                transcriptMessageId: starter.id,
            })
            .catch((error) => {
                logWarn(
                    "interaction",
                    "Failed to store membership application transcript message id",
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
                `${slugifyTicketLabel(recordResponse.application.categoryLabel)}-${recordResponse.application.applicationNumber}`.slice(
                    0,
                    100
                )
            )
            .catch((error) => {
                logWarn(
                    "interaction",
                    "Failed to rename membership application thread",
                    {
                        guildId: interaction.guildId,
                        threadId: thread.id,
                        error,
                    }
                )
                void reportClanDiscordError({
                    client,
                    guildId: interaction.guildId!,
                    error,
                    action: "Rename a membership application thread",
                    location: "Membership applications",
                    scope: "interaction",
                    target: thread.name,
                    details: {
                        threadId: thread.id,
                    },
                })
                return null
            })

        const threadUrl = `https://discord.com/channels/${interaction.guildId}/${thread.id}`
        await interaction.editReply({
            content: formatTemplate(messages.membership.created, {
                url: threadUrl,
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

    async function handleCloseApplicationCommand(
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
                ).membership.closeCommandThreadOnly,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        const guild = interaction.guild
        if (!guild) {
            await interaction.reply({
                content: getMembershipMessages(
                    await interactionLanguage(interaction.guildId)
                ).membership.guildUnavailable,
                flags: MessageFlags.Ephemeral,
            })
            return
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral })

        const context = (await convex.query(
            references.getMembershipApplicationThreadContext,
            {
                secret: env.internalSecret,
                threadId: interaction.channelId,
            }
        )) as {
            config: EventInteractionContext["config"]
            application: MembershipApplicationThreadRecord
            assignment: {
                id?: string
                type: "member" | "mercenary"
                status: "pending" | "recruit" | "active"
                membershipCategoryId?: string
            } | null
            category: MembershipCategory | null
        } | null
        const messages = getMembershipMessages(context?.config.defaultLanguage)

        if (!context) {
            await interaction.editReply({
                content: messages.membership.notTracked,
            })
            return
        }

        if (context.application.status === "closed") {
            await interaction.editReply({
                content: messages.membership.alreadyClosed,
            })
            return
        }

        // Same fresh check as /close_ticket (M3-04).
        const authority = await checkCloseAuthority(
            guild,
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
                        ? messages.membership.noClosePermission
                        : messages.membership.unableToVerifyPermissions,
            })
            return
        }

        const outcome = interaction.options.getString("outcome", true) as
            "denied" | "pending" | "recruit" | "member" | "mercenary"
        const outcomeLabel = getOutcomeLabel(
            context.config.defaultLanguage,
            outcome
        )
        const reason =
            interaction.options.getString("reason")?.trim() || undefined
        const closedAt = new Date()

        if (outcome === "denied") {
            if (context.application.assignmentId) {
                await convex.mutation(references.removeAssignment, {
                    secret: env.internalSecret,
                    assignmentId: context.application.assignmentId as never,
                    roleActor: {
                        userId: interaction.user.id,
                        kind: "recruitment",
                    },
                    roleGuildId: interaction.guildId,
                })
                await revalidateAppData({
                    type: "assignment-changed",
                    serverId: interaction.guildId,
                    userId: context.application.creatorId,
                    assignmentId: context.application.assignmentId,
                })
            }
        } else {
            const nextType = outcome === "mercenary" ? "mercenary" : "member"
            const nextStatus =
                outcome === "pending"
                    ? "pending"
                    : outcome === "recruit"
                      ? "recruit"
                      : "active"
            const nextCategoryId =
                context.assignment?.membershipCategoryId ??
                context.application.categoryId
            const assignmentId = (await convex.mutation(
                references.upsertAssignment,
                {
                    secret: env.internalSecret,
                    serverDiscordId: interaction.guildId,
                    assignmentId: context.application.assignmentId as never,
                    roleActor: {
                        userId: interaction.user.id,
                        kind: "recruitment",
                    },
                    gameId: context.application.gameId,
                    userId: context.application.creatorId,
                    type: nextType,
                    status: nextStatus,
                    membershipCategoryId: nextCategoryId,
                    primaryGroupId: undefined,
                    secondaryGroupIds: [],
                    paused: false,
                    pausedNote: undefined,
                }
            )) as string
            await revalidateAppData({
                type: "assignment-changed",
                serverId: interaction.guildId,
                userId: context.application.creatorId,
                assignmentId,
            })
        }

        await convex.mutation(references.closeMembershipApplicationThread, {
            secret: env.internalSecret,
            threadId: interaction.channelId,
            closedByUserId: interaction.user.id,
            closeReason: reason,
            closeOutcome: outcome,
        })

        const creator = await interaction.client.users
            .fetch(context.application.creatorId)
            .catch(() => null)
        if (creator) {
            const lines = [
                formatTemplate(messages.membership.closeDmClosed, {
                    number: String(context.application.applicationNumber),
                    guildName:
                        (await resolveGuildName(interaction)) ??
                        messages.membership.serverFallback,
                }),
                `${messages.membership.outcomeLabel}: ${outcomeLabel}`,
                reason
                    ? `${messages.membership.reasonLabel}: ${reason}`
                    : messages.membership.noCloseReasonProvided,
            ]
            await creator.send({ content: lines.join("\n") }).catch(() => null)
        }

        await interaction.channel
            .send({
                embeds: [
                    buildMembershipApplicationCloseEmbed({
                        messages,
                        applicationNumber:
                            context.application.applicationNumber,
                        closerId: interaction.user.id,
                        closedAt,
                        outcomeLabel,
                        reason,
                    }),
                ],
            })
            .catch(() => null)

        await interaction.channel
            .setName(
                `closed-${context.application.applicationNumber}`.slice(0, 100)
            )
            .catch(() => null)
        await interaction.channel
            .setLocked(true, reason ?? messages.membership.closeAuditReason)
            .catch(() => null)
        await interaction.channel
            .setArchived(true, reason ?? messages.membership.closeAuditReason)
            .catch(() => null)
        await interaction.editReply({
            content: reason
                ? formatTemplate(messages.membership.closeReplyWithReason, {
                      outcome: outcomeLabel,
                      reason,
                  })
                : formatTemplate(messages.membership.closeReply, {
                      outcome: outcomeLabel,
                  }),
        })
    }
}
