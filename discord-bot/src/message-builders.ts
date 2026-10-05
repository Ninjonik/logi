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
import { getPanelMessages } from "../../src/lib/clan-language/panels"
import { getEventMessages } from "../../src/lib/clan-language/events"
import { expandCalendarItems } from "../../src/lib/calendar-items"

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

function resolveEventCategoryEmoji(
    categories: SyncPayload["guild"]["eventCategories"],
    event: EventRecord
) {
    return (
        findEventCategory(categories, event.matchType)?.emoji?.trim() ||
        undefined
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

function resolveCalendarEventLabel(
    config: DiscordConfig,
    categories: SyncPayload["guild"]["eventCategories"],
    event: EventRecord
) {
    const messages = getPanelMessages(config.defaultLanguage)
    if (event.kind === "training") {
        return messages.calendar.trainingLabel
    }

    return (
        findEventCategory(categories, event.matchType)?.label ??
        event.matchType?.trim() ??
        messages.calendar.matchLabel
    )
}

function formatCalendarDate(
    timestamp: string,
    timezone: string,
    language: ClanLanguage
) {
    return new Intl.DateTimeFormat(configureLocale(language), {
        timeZone: timezone,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(timestamp))
}

function formatCalendarTime(
    timestamp: string,
    timezone: string,
    language: ClanLanguage
) {
    return new Intl.DateTimeFormat(configureLocale(language), {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
    }).format(new Date(timestamp))
}

function configureLocale(language: ClanLanguage) {
    return language === "cs" ? "cs-CZ" : language === "de" ? "de-DE" : "en-GB"
}

function getCalendarAllDayLabel(language: ClanLanguage) {
    return language === "cs"
        ? "Celý den"
        : language === "de"
          ? "Ganztägig"
          : "All day"
}

function getColorChipEmoji(color?: string) {
    const normalized = color?.trim() ?? ""
    const hex = /^#[\da-f]{6}$/i.test(normalized)
        ? normalized.slice(1)
        : DEFAULT_MESSAGE_ACCENT_HEX.slice(1)
    const red = Number.parseInt(hex.slice(0, 2), 16)
    const green = Number.parseInt(hex.slice(2, 4), 16)
    const blue = Number.parseInt(hex.slice(4, 6), 16)
    const palette = [
        { emoji: "🟥", red: 235, green: 69, blue: 90 },
        { emoji: "🟧", red: 249, green: 146, blue: 43 },
        { emoji: "🟨", red: 250, green: 208, blue: 72 },
        { emoji: "🟩", red: 64, green: 181, blue: 104 },
        { emoji: "🟦", red: 52, green: 152, blue: 219 },
        { emoji: "🟪", red: 155, green: 89, blue: 182 },
        { emoji: "🟫", red: 141, green: 110, blue: 99 },
        { emoji: "⬛", red: 47, green: 54, blue: 64 },
        { emoji: "⬜", red: 236, green: 240, blue: 241 },
    ]

    let closest = palette[0]!
    let closestDistance = Number.POSITIVE_INFINITY
    for (const candidate of palette) {
        const distance =
            (red - candidate.red) ** 2 +
            (green - candidate.green) ** 2 +
            (blue - candidate.blue) ** 2
        if (distance < closestDistance) {
            closest = candidate
            closestDistance = distance
        }
    }

    return closest.emoji
}

function escapeDiscordLinkLabel(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]")
}

function toDiscordTimestamp(timestamp: string, style: "t" | "f" | "F" | "R") {
    return `<t:${Math.floor(new Date(timestamp).getTime() / 1000)}:${style}>`
}

export function buildCalendarPanelEmbed(
    config: DiscordConfig,
    categories: SyncPayload["guild"]["eventCategories"],
    events: EventRecord[],
    calendarItems: SyncPayload["calendarItems"] = []
) {
    const resolvedCategories = Array.isArray(categories) ? categories : []
    const resolvedEvents = Array.isArray(events) ? events : []
    const resolvedCalendarItems = Array.isArray(calendarItems)
        ? calendarItems
        : []
    const messages = getPanelMessages(config.defaultLanguage)
    const now = Date.now()
    const upcomingEvents = [...resolvedEvents]
        .filter(
            (event) =>
                new Date(event.gameEnd).getTime() >= now &&
                event.status !== "concluded"
        )
        .sort(
            (left, right) =>
                new Date(left.meetingStart).getTime() -
                new Date(right.meetingStart).getTime()
        )
        .slice(0, 20)
    const manualOccurrences = expandCalendarItems(
        resolvedCalendarItems as never,
        new Date(now - 24 * 60 * 60 * 1000),
        new Date(now + 366 * 24 * 60 * 60 * 1000)
    ).filter((item) => new Date(item.endAt).getTime() >= now)

    const upcomingEntries = [
        ...upcomingEvents.map((event) => ({
            id: event.id,
            dateKey: event.gameStart,
            startAt: event.gameStart,
            endAt: event.gameEnd,
            title: event.name,
            label: resolveCalendarEventLabel(config, resolvedCategories, event),
            color: resolveEventCategoryColor(resolvedCategories, event),
            emoji: resolveEventCategoryEmoji(resolvedCategories, event),
            url: generateCalendarUrl(event, config.defaultLanguage),
            allDay: false,
        })),
        ...manualOccurrences.map((item) => ({
            id: item.id,
            dateKey: item.startAt,
            startAt: item.startAt,
            endAt: item.endAt,
            title: item.title,
            label: item.label,
            color: item.color,
            emoji: item.emoji,
            url: undefined,
            allDay: item.allDay,
        })),
    ]
        .sort(
            (left, right) =>
                new Date(left.startAt).getTime() -
                new Date(right.startAt).getTime()
        )
        .slice(0, 20)

    const allDayLabel = getCalendarAllDayLabel(config.defaultLanguage)
    const panelColor = upcomingEntries[0]?.color ?? "#2563EB"
    const embed = new EmbedBuilder()
        .setTitle(`📅 ${messages.calendar.panelTitle}`)
        .setColor(toDiscordColor(panelColor))
        .setFooter({
            text: `${getEventMessages(config.defaultLanguage).embed.managedFooter} • ${config.timezone}`,
        })

    if (!upcomingEntries.length) {
        if (!resolvedCategories.length) {
            embed.setDescription(messages.calendar.panelEmpty)
        }
        return embed
    }

    const legendEntries = new Map<string, string>()
    const descriptionLines: string[] = []

    for (const entry of upcomingEntries) {
        if (!entry.label) {
            continue
        }

        const chip = getColorChipEmoji(entry.color)
        const categoryEmoji = entry.emoji?.trim()
        const legendParts = [
            chip,
            categoryEmoji === chip ? undefined : categoryEmoji,
            entry.label.trim(),
        ].filter(Boolean)
        legendEntries.set(
            `${entry.label.trim().toLowerCase()}:${entry.color}:${entry.emoji?.trim() ?? ""}`,
            legendParts.join(" ")
        )
    }

    if (legendEntries.size) {
        descriptionLines.push(`**${messages.calendar.panelCategories}**`)
        descriptionLines.push(...legendEntries.values())
        descriptionLines.push("")
    }

    let currentDateLabel = ""
    for (const entry of upcomingEntries) {
        const dateLabel = formatCalendarDate(
            entry.dateKey,
            config.timezone,
            config.defaultLanguage
        )
        if (dateLabel !== currentDateLabel) {
            if (
                descriptionLines.length &&
                descriptionLines[descriptionLines.length - 1] !== ""
            ) {
                descriptionLines.push("")
            }
            descriptionLines.push(`**${dateLabel}**`)
            currentDateLabel = dateLabel
        }

        const timeLabel = entry.allDay
            ? allDayLabel
            : `${toDiscordTimestamp(entry.startAt, "t")} - ${toDiscordTimestamp(entry.endAt, "t")}`
        const chip = getColorChipEmoji(entry.color)
        const title = formatDiscordMarkdown(entry.title)
            .replace(/\n+/g, " ")
            .trim()
        const linkedTitle = entry.url
            ? `[${escapeDiscordLinkLabel(title)}](${entry.url})`
            : title
        const rowParts = [chip, linkedTitle, timeLabel]
        descriptionLines.push(rowParts.join(" "))
    }

    embed.setDescription(descriptionLines.join("\n").slice(0, 4096))

    return embed
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
