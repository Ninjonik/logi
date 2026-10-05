import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MediaGalleryBuilder,
    MessageFlags,
    TextDisplayBuilder,
    type APIEmbedField,
} from "discord.js"
import { buildMembershipFlowHeader } from "./interactions/membership-flow"

import {
    DEFAULT_MESSAGE_ACCENT_COLOR,
    DEFAULT_MESSAGE_ACCENT_HEX,
} from "../../src/domain/discord-messages/format"
import { getMembershipMessages } from "../../src/lib/clan-language/membership"
import { formatDiscordMarkdown } from "../../src/lib/discord-markdown"
import { getEventMessages } from "../../src/lib/clan-language/events"

import type {
    ClanLanguage,
    DiscordConfig,
    EventRecord,
    MembershipApplicationThreadRecord,
    MembershipCategory,
    SyncPayload,
    TicketCategory,
    TicketThreadRecord,
} from "./types"
import { generateCalendarUrl } from "./utils"

function normalizeCategoryId(value?: string) {
    return value?.trim().toLowerCase() ?? ""
}

function findEventCategory(
    categories: SyncPayload["guild"]["eventCategories"],
    matchType?: string
) {
    const resolvedCategories = Array.isArray(categories) ? categories : []
    const normalizedMatchType = normalizeCategoryId(matchType)
    if (!normalizedMatchType) {
        return undefined
    }

    return resolvedCategories.find(
        (category) => normalizeCategoryId(category.id) === normalizedMatchType
    )
}

function resolveEventCategoryColor(
    categories: SyncPayload["guild"]["eventCategories"],
    event: EventRecord
) {
    return (
        findEventCategory(categories, event.matchType)?.color ??
        DEFAULT_MESSAGE_ACCENT_HEX
    )
}

function toDiscordColor(color: string) {
    const normalized = color.trim()
    if (/^#[\da-f]{6}$/i.test(normalized)) {
        return Number.parseInt(normalized.slice(1), 16)
    }

    return DEFAULT_MESSAGE_ACCENT_COLOR
}

export function buildTicketPanelEmbed(config: DiscordConfig) {
    const ticketSettings = config.ticketSettings
    if (!ticketSettings) {
        return null
    }

    const messages = getMembershipMessages(config.defaultLanguage)
    const embed = new EmbedBuilder()
        .setTitle(ticketSettings.panelTitle.slice(0, 256))
        .setDescription(
            formatDiscordMarkdown(ticketSettings.panelDescription, 4096)
        )
        .setColor("#3B82F6")
        .setFooter({ text: messages.panels.ticketManagedFooter })

    if (ticketSettings.panelImageUrl) {
        embed.setThumbnail(ticketSettings.panelImageUrl)
    }

    const categoryFieldValue = ticketSettings.categories
        .map((category) => {
            const heading = [
                category.emoji?.trim(),
                category.label?.trim() || category.id,
            ]
                .filter(Boolean)
                .join(" ")
            const description = category.description?.trim()
            return description
                ? `${heading}: ${formatDiscordMarkdown(description)}`
                : heading
        })
        .join("\n")
        .slice(0, 1024)

    const fields: APIEmbedField[] = []
    if (categoryFieldValue) {
        fields.push({
            name: messages.panels.ticketCategories,
            value: categoryFieldValue,
            inline: false,
        })
    }

    if (fields.length) {
        embed.addFields(fields)
    }

    return embed
}

export function buildTicketPanelComponents(config: DiscordConfig) {
    const ticketSettings = config.ticketSettings
    if (!ticketSettings?.categories.length) {
        return []
    }

    const buttons = ticketSettings.categories.map((category) => {
        const button = new ButtonBuilder()
            .setCustomId(`ticket:${category.id}`)
            .setStyle(ButtonStyle.Primary)

        const label = category.label?.trim()
        const emoji = category.emoji?.trim()

        if (emoji) {
            button.setEmoji(emoji)
        }
        if (label) {
            button.setLabel(label.slice(0, 80))
        } else if (!emoji) {
            button.setLabel(category.id.slice(0, 80))
        }

        return button
    })

    const rows: Array<ActionRowBuilder<ButtonBuilder>> = []
    for (let index = 0; index < buttons.length; index += 5) {
        rows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                buttons.slice(index, index + 5)
            )
        )
    }

    return rows
}

export function buildMembershipPanelEmbed(config: DiscordConfig) {
    const membershipSettings = config.membershipSettings
    if (!membershipSettings) {
        return null
    }

    const messages = getMembershipMessages(config.defaultLanguage)
    const embed = new EmbedBuilder()
        .setTitle(membershipSettings.panelTitle.slice(0, 256))
        .setDescription(
            formatDiscordMarkdown(membershipSettings.panelDescription, 4096)
        )
        .setColor("#16A34A")
        .setFooter({ text: messages.panels.membershipManagedFooter })

    if (membershipSettings.panelImageUrl) {
        embed.setThumbnail(membershipSettings.panelImageUrl)
    }

    const categoryFieldValue = membershipSettings.categories
        .map((category) => {
            const heading = [
                category.emoji?.trim(),
                category.label?.trim() || category.id,
            ]
                .filter(Boolean)
                .join(" ")
            const description = category.description?.trim()
            return description
                ? `${heading}: ${formatDiscordMarkdown(description)}`
                : heading
        })
        .join("\n")
        .slice(0, 1024)

    if (categoryFieldValue) {
        embed.addFields({
            name: messages.panels.membershipApplications,
            value: categoryFieldValue,
            inline: false,
        })
    }

    return embed
}

export function buildMembershipPanelComponents(config: DiscordConfig) {
    const membershipSettings = config.membershipSettings
    if (!membershipSettings?.categories.length) {
        return []
    }

    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId("membership:apply")
                .setLabel(
                    getMembershipMessages(config.defaultLanguage).panels
                        .membershipApply
                )
                .setStyle(ButtonStyle.Success)
        ),
    ]
}

/**
 * One line per membership category for the public panel (design F1): the
 * button text in bold and, when set, the description written under it.
 */
export function membershipCategoryLines(
    categories: Pick<
        MembershipCategory,
        "id" | "emoji" | "label" | "description"
    >[]
) {
    return categories
        .map((category) => {
            const heading = [
                category.emoji?.trim(),
                `**${(category.label?.trim() || category.id).slice(0, 80)}**`,
            ]
                .filter(Boolean)
                .join(" ")
            const description = category.description?.trim()
            return description
                ? `${heading} · ${formatDiscordMarkdown(description, 240)}`
                : heading
        })
        .join("\n")
}

export function buildMembershipPanelMessage(config: DiscordConfig) {
    const membershipSettings = config.membershipSettings
    if (!membershipSettings?.categories.length) {
        return null
    }

    const messages = getMembershipMessages(config.defaultLanguage)
    const container = new ContainerBuilder().setAccentColor(0x16a34a)
    if (membershipSettings.panelImageUrl) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems({
                media: { url: membershipSettings.panelImageUrl },
                description: membershipSettings.panelTitle.slice(0, 1024),
            })
        )
    }
    const intro = [
        `# ${membershipSettings.panelTitle.slice(0, 256)}`,
        formatDiscordMarkdown(membershipSettings.panelDescription, 3000),
    ]
        .filter(Boolean)
        .join("\n")
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            [intro, membershipCategoryLines(membershipSettings.categories)]
                .filter(Boolean)
                .join("\n\n")
                .slice(0, 4000)
        )
    )
    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId("membership:apply")
                .setLabel(messages.panels.membershipApply)
                .setStyle(ButtonStyle.Success)
        )
    )
    return { components: [container], flags: MessageFlags.IsComponentsV2 }
}

function membershipGameLabel(gameId: MembershipCategory["gameId"]) {
    return gameId === "hell_let_loose_vietnam"
        ? "Hell Let Loose: Vietnam"
        : gameId === "wardogs"
          ? "Wardogs"
          : "Hell Let Loose"
}

function buildMembershipSelectionMessage(input: {
    config: DiscordConfig
    gameId?: MembershipCategory["gameId"]
}) {
    const settings = input.config.membershipSettings
    const messages = getMembershipMessages(input.config.defaultLanguage)
    const container = new ContainerBuilder().setAccentColor(0x5865f2)

    if (!input.gameId) {
        const games = [
            ...new Set(
                settings?.categories.map(
                    (category) => category.gameId ?? "hell_let_loose"
                )
            ),
        ]
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                messages.panels.membershipChooseGame
            )
        )
        container.addActionRowComponents(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                games.map((gameId) =>
                    new ButtonBuilder()
                        .setCustomId(`membership:game:${gameId}`)
                        .setLabel(membershipGameLabel(gameId))
                        .setStyle(ButtonStyle.Primary)
                )
            )
        )
    } else {
        const categories =
            settings?.categories.filter(
                (category) =>
                    (category.gameId ?? "hell_let_loose") === input.gameId
            ) ?? []
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `${membershipGameLabel(input.gameId)}\n${messages.panels.membershipChooseCategory}`
            )
        )
        for (let index = 0; index < categories.length; index += 5) {
            container.addActionRowComponents(
                new ActionRowBuilder<ButtonBuilder>().addComponents(
                    categories.slice(index, index + 5).map((category) => {
                        const button = new ButtonBuilder()
                            .setCustomId(
                                `membership:${input.gameId}:${category.id}`
                            )
                            .setLabel(
                                (category.label?.trim() || category.id).slice(
                                    0,
                                    80
                                )
                            )
                            .setStyle(ButtonStyle.Primary)
                        if (category.emoji?.trim()) {
                            button.setEmoji(category.emoji.trim())
                        }
                        return button
                    })
                )
            )
        }
    }

    return {
        components: [
            buildMembershipFlowHeader(
                input.config.defaultLanguage,
                input.gameId ? "specialization" : "game"
            ),
            container,
        ],
        flags: MessageFlags.IsComponentsV2,
    }
}

export function buildMembershipGameSelectionMessage(config: DiscordConfig) {
    return buildMembershipSelectionMessage({ config })
}

export function buildMembershipCategorySelectionMessage(
    config: DiscordConfig,
    gameId: MembershipCategory["gameId"]
) {
    return buildMembershipSelectionMessage({ config, gameId })
}

export function buildTicketThreadEmbed(input: {
    language: ClanLanguage
    category: TicketCategory
    ticket: Pick<
        TicketThreadRecord,
        "ticketNumber" | "categoryLabel" | "creatorId"
    >
    answers: Array<{ label: string; value: string }>
    creatorTag: string
}) {
    const messages = getMembershipMessages(input.language)
    const embed = new EmbedBuilder()
        .setTitle(
            messages.ticket.threadTitle.replace(
                "{number}",
                String(input.ticket.ticketNumber)
            )
        )
        .setDescription(
            `${messages.ticket.category}: ${input.ticket.categoryLabel}\n${messages.ticket.createdBy}: <@${input.ticket.creatorId}>`
        )
        .setColor("#F59E0B")

    if (input.answers.length) {
        embed.addFields(
            input.answers.slice(0, 25).map((answer) => ({
                name: answer.label.slice(0, 256),
                value: answer.value.slice(0, 1024) || "-",
                inline: false,
            }))
        )
    }

    embed.setFooter({
        text: messages.ticket.openedBy.replace(
            "{creatorTag}",
            input.creatorTag
        ),
    })
    return embed
}

export function buildMembershipApplicationThreadEmbed(input: {
    language: ClanLanguage
    category: MembershipCategory
    application: Pick<
        MembershipApplicationThreadRecord,
        "applicationNumber" | "categoryLabel" | "creatorId" | "assignmentType"
    >
    answers: Array<{ label: string; value: string }>
    creatorTag: string
    assignmentStatus: "pending" | "recruit" | "active"
}) {
    const messages = getMembershipMessages(input.language)
    const resolvedStatus =
        input.assignmentStatus === "pending"
            ? messages.membership.statusPending
            : input.assignmentStatus === "recruit"
              ? messages.membership.statusRecruit
              : input.application.assignmentType === "mercenary"
                ? messages.membership.statusMercenary
                : messages.membership.statusMember

    const embed = new EmbedBuilder()
        .setTitle(
            messages.membership.threadTitle.replace(
                "{number}",
                String(input.application.applicationNumber)
            )
        )
        .setDescription(
            `${messages.membership.category}: ${input.application.categoryLabel}\n${messages.membership.createdBy}: <@${input.application.creatorId}>\n${messages.membership.initialStatus}: ${resolvedStatus}`
        )
        .setColor("#16A34A")

    if (input.answers.length) {
        embed.addFields(
            input.answers.slice(0, 25).map((answer) => ({
                name: answer.label.slice(0, 256),
                value: answer.value.slice(0, 1024) || "-",
                inline: false,
            }))
        )
    }

    embed.setFooter({
        text: messages.membership.openedBy.replace(
            "{creatorTag}",
            input.creatorTag
        ),
    })
    return embed
}
