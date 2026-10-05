import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MediaGalleryBuilder,
    MessageFlags,
    SeparatorBuilder,
    TextDisplayBuilder,
    type APIEmbedField,
} from "discord.js"
import { buildMembershipFlowHeader } from "./interactions/membership-flow"

import {
    DEFAULT_MESSAGE_ACCENT_COLOR,
    DEFAULT_MESSAGE_ACCENT_HEX,
    discordTimestamp,
    fillTemplate,
    formatCount,
    resolveMessageAccentColor,
} from "../../src/domain/discord-messages/format"
import { getMembershipMessages } from "../../src/lib/clan-language/membership"
import { formatDiscordMarkdown } from "../../src/lib/discord-markdown"
import { getPanelMessages } from "../../src/lib/clan-language/panels"
import { getEventMessages } from "../../src/lib/clan-language/events"
import { formatHllPresetLabel } from "../../src/lib/hll-map-presets"
import { expandCalendarItems } from "../../src/lib/calendar-items"

import type {
    ClanLanguage,
    DiscordConfig,
    EventRecord,
    MembershipApplicationThreadRecord,
    MembershipCategory,
    Roster,
    SyncPayload,
    TicketCategory,
    TicketThreadRecord,
} from "./types"
import {
    buildForumThreadName,
    getRosterImageVersion,
    buildRosterImageUrl,
    formatInTimezone,
    generateCalendarUrl,
    buildPublicRosterUrl,
} from "./utils"

type RosterInfoOptions = {
    /** The roster picture uploaded with the message (`attachment://…`). */
    rosterImageUrl?: string
}

type Messages = ReturnType<typeof getEventMessages>

function rosterImageUrlOf(
    event: EventRecord,
    roster: Roster,
    options?: RosterInfoOptions
) {
    return (
        options?.rosterImageUrl ??
        buildRosterImageUrl(
            event.id,
            getRosterImageVersion(event, roster.updatedAt)
        )
    )
}

function rosterTitle(messages: Messages, event: EventRecord) {
    return fillTemplate(messages.rosterSummary.title, {
        event: toSingleLine(event.name),
    })
}

/**
 * The published roster card in the event information channel: roster title,
 * the meeting line, one line per squad and the reserves, the roster image and
 * "My assignment" / "Full roster on the web". The match announcement itself
 * lives in `events/announcement.ts`.
 */
export function buildRosterInfoV2Message(
    payload: Pick<SyncPayload, "config">,
    event: EventRecord,
    roster: Roster,
    userDisplayNames: Record<string, string> = {},
    options?: RosterInfoOptions
) {
    const messages = getEventMessages(payload.config.defaultLanguage)
    const container = new ContainerBuilder().setAccentColor(
        resolveMessageAccentColor({
            messageStyle: payload.config.messageStyle,
        })
    )
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            [
                `### ${escapeDisplayName(rosterTitle(messages, event))}`,
                buildRosterSummaryText(
                    payload.config,
                    event,
                    roster,
                    userDisplayNames
                ),
            ]
                .filter(Boolean)
                .join("\n")
                .slice(0, 4000)
        )
    )
    container.addMediaGalleryComponents(
        new MediaGalleryBuilder().addItems({
            media: { url: rosterImageUrlOf(event, roster, options) },
            description: `${event.name} roster`,
        })
    )
    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`roster-assignment:${event.id}`)
                .setStyle(ButtonStyle.Primary)
                .setLabel(messages.embed.myAssignment),
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel(messages.buttons.viewFullRoster)
                .setURL(
                    buildPublicRosterUrl(
                        event.id,
                        payload.config.defaultLanguage
                    )
                )
        )
    )
    return { components: [container] }
}

/** {@link buildRosterInfoV2Message} for a legacy embed message. */
export function buildRosterInfoEmbed(
    config: DiscordConfig,
    event: EventRecord,
    roster: Roster,
    userDisplayNames: Record<string, string> = {},
    options?: RosterInfoOptions
) {
    const messages = getEventMessages(config.defaultLanguage)
    return new EmbedBuilder()
        .setColor(
            resolveMessageAccentColor({ messageStyle: config.messageStyle })
        )
        .setTitle(
            truncateUtf16(
                rosterTitle(messages, event),
                DISCORD_EMBED_TITLE_LIMIT
            )
        )
        .setDescription(
            buildRosterSummaryText(
                config,
                event,
                roster,
                userDisplayNames
            ).slice(0, DISCORD_EMBED_DESCRIPTION_LIMIT) || null
        )
        .setImage(rosterImageUrlOf(event, roster, options))
}

function formatRosterPlayerName(
    player: Roster["squads"][number]["players"][number],
    userDisplayNames: Record<string, string>
) {
    const customName = player.customName?.trim()
    if (customName) return escapeDisplayName(customName)
    return player.id
        ? resolveAnnouncementDisplayName(player.id, userDisplayNames)
        : undefined
}

/**
 * Published roster overview: meeting time and channel, one line per squad
 * with its player count (a one-player squad such as Command shows the name)
 * and the reserves. Empty slots are not counted.
 */
export function buildRosterSummaryText(
    config: DiscordConfig,
    event: EventRecord,
    roster: Roster,
    userDisplayNames: Record<string, string> = {}
) {
    const messages = getEventMessages(config.defaultLanguage)
    const lines: string[] = []
    const meeting = discordTimestamp(event.meetingStart, "t")
    const meetingRelative = discordTimestamp(event.meetingStart, "R")
    if (meeting) {
        const time = meetingRelative
            ? `${meeting} (${meetingRelative})`
            : meeting
        const channelId =
            event.meetingChannelId?.trim() || config.meetingChannelId?.trim()
        lines.push(
            channelId
                ? fillTemplate(messages.rosterSummary.meetingInChannel, {
                      time,
                      channel: `<#${channelId}>`,
                  })
                : fillTemplate(messages.rosterSummary.meeting, { time })
        )
    }
    const squads = [...roster.squads].sort(
        (left, right) => left.order - right.order
    )
    for (const squad of squads) {
        const players = squad.players.filter(
            (player) => player.id || player.customName?.trim()
        )
        if (!players.length) continue
        const onlyName =
            players.length === 1
                ? formatRosterPlayerName(players[0]!, userDisplayNames)
                : undefined
        lines.push(
            `**${escapeDisplayName(toSingleLine(squad.name))}** · ${
                onlyName ??
                formatCount(
                    messages.locale,
                    players.length,
                    messages.rosterSummary.players
                )
            }`
        )
    }
    if (roster.reservePlayerIds.length) {
        lines.push(
            `**${messages.rosterImage.reserves}** · ${formatCount(
                messages.locale,
                roster.reservePlayerIds.length,
                messages.rosterSummary.players
            )}`
        )
    }
    return lines.join("\n")
}

function escapeDisplayName(value: string) {
    return value.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, "\\$1")
}

function resolveAnnouncementDisplayName(
    userId: string,
    userDisplayNames: Record<string, string>
) {
    const displayName = userDisplayNames[userId]?.trim()
    if (displayName) return escapeDisplayName(displayName)
    // Without a stored name a Discord mention still shows the member's name
    // (messages are sent without pinging); never print a raw snowflake.
    return /^\d{17,20}$/.test(userId)
        ? `<@${userId}>`
        : escapeDisplayName(userId)
}

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

const DISCORD_EMBED_TITLE_LIMIT = 256
const DISCORD_EMBED_DESCRIPTION_LIMIT = 4096

/** Keeps a stored label on one line so it cannot start Markdown blocks. */
function toSingleLine(value: string) {
    return value.replace(/[\s\p{Cc}]+/gu, " ").trim()
}

/**
 * Cuts to a Discord length limit, which counts UTF-16 code units, without
 * splitting a surrogate pair.
 */
function truncateUtf16(value: string, maxLength: number) {
    if (value.length <= maxLength) return value
    let truncated = ""
    for (const codePoint of value) {
        if (truncated.length + codePoint.length > maxLength) break
        truncated += codePoint
    }
    return truncated
}

export function buildForumInfoEmbed(
    config: DiscordConfig,
    event: EventRecord,
    stratmapLinks: string[] = []
) {
    const messages = getEventMessages(config.defaultLanguage)
    const embed = new EmbedBuilder()
        .setTitle(event.name)
        .setDescription(
            formatDiscordMarkdown(
                event.notes ||
                    event.description ||
                    messages.forum.matchInformation
            )
        )
        .setFooter({
            text: `${messages.forum.managedFooter} ${config.timezone}`,
        })

    if (event.thumbnailUrl) {
        embed.setThumbnail(event.thumbnailUrl)
    }

    if (event.kind === "match" && event.imageUrl) {
        embed.setImage(event.imageUrl)
    }

    if (event.kind === "match") {
        embed.addFields(
            {
                name: messages.forum.map,
                value: event.map
                    ? (formatHllPresetLabel(event.map) ?? event.map)
                    : messages.forum.notSet,
                inline: true,
            },
            {
                name: messages.forum.side,
                value: event.side ?? messages.forum.notSet,
                inline: true,
            },
            {
                name: messages.forum.cap,
                value: event.cap ?? messages.forum.notSet,
                inline: true,
            },
            {
                name: messages.forum.server,
                value: event.server ?? messages.forum.notSet,
                inline: true,
            },
            {
                // Forum channels inherit their category's permissions, so the
                // password stays in the private "My assignment" reply.
                name: messages.forum.serverPassword,
                value: event.serverPassword?.trim()
                    ? messages.forum.passwordInAssignment
                    : messages.forum.notSet,
                inline: true,
            },
            {
                name: messages.forum.gameStart,
                value:
                    discordTimestamp(event.gameStart, "F") ??
                    formatInTimezone(
                        event.gameStart,
                        config.timezone,
                        config.defaultLanguage
                    ),
                inline: true,
            }
        )
        if (stratmapLinks.length) {
            embed.addFields({
                name: "Stratmaps",
                value: stratmapLinks.join("\n").slice(0, 1024),
                inline: false,
            })
        }
    } else {
        const meetingChannelId = event.meetingChannelId?.trim()
        embed.addFields({
            name: messages.embed.meeting,
            value: [
                discordTimestamp(event.meetingStart, "F") ??
                    formatInTimezone(
                        event.meetingStart,
                        config.timezone,
                        config.defaultLanguage
                    ),
                // A channel mention shows the channel name, never a raw ID.
                meetingChannelId ? `<#${meetingChannelId}>` : undefined,
            ]
                .filter(Boolean)
                .join(" · "),
            inline: true,
        })
    }

    return embed
}

export function buildForumInfoV2Message(
    config: DiscordConfig,
    event: EventRecord,
    stratmapLinks: string[] = []
) {
    const embed = buildForumInfoEmbed(config, event, stratmapLinks).toJSON()
    const container = new ContainerBuilder().setAccentColor(
        toDiscordColor(resolveEventCategoryColor([], event))
    )
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `# ${event.name}\n${embed.description ?? ""}`.slice(0, 4000)
        )
    )
    const details = (embed.fields ?? [])
        .map((field) => `**${field.name}:** ${field.value}`)
        .join("\n")
    if (details) {
        container.addSeparatorComponents(new SeparatorBuilder())
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(details.slice(0, 4000))
        )
    }
    if (embed.image?.url) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems({
                media: { url: embed.image.url },
                description: `${event.name} briefing`,
            })
        )
    }
    return { components: [container] }
}

/**
 * Reminder DM controls: confirm, running late, and "Can't make it", which
 * opens a short reason form. The decline button has its own prefix so an
 * older bot never treats it as a confirmation.
 */
export function buildAttendanceReminderComponents(
    eventId: string,
    language: ClanLanguage
) {
    const messages = getEventMessages(language)
    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`attendance:${eventId}:ack`)
                .setStyle(ButtonStyle.Success)
                .setLabel(messages.buttons.confirmShort),
            new ButtonBuilder()
                .setCustomId(`attendance-late:${eventId}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(messages.embed.runningLate),
            new ButtonBuilder()
                .setCustomId(`attendance-decline:${eventId}`)
                .setStyle(ButtonStyle.Danger)
                .setLabel(messages.buttons.cannotCome)
        ),
    ]
}

export { buildForumThreadName }

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
