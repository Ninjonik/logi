import {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ContainerBuilder,
    EmbedBuilder,
    MediaGalleryBuilder,
    MessageFlags,
    SectionBuilder,
    SeparatorBuilder,
    TextDisplayBuilder,
    ThumbnailBuilder,
    escapeMarkdown,
    type APIEmbedField,
} from "discord.js"
import { buildMembershipFlowHeader } from "./interactions/membership-flow"

import {
    discordTimestamp,
    fillTemplate,
    formatCount,
    resolveMessageAccentColor,
} from "../../src/domain/discord-messages/format"
import {
    messageLineIcon,
    type MessageLine,
} from "../../src/domain/discord-messages/message-style"
import { formatDiscordMarkdown } from "../../src/lib/discord-markdown"
import { formatHllPresetLabel } from "../../src/lib/hll-map-presets"
import { getClanDiscordMessages } from "../../src/lib/clan-language"
import { expandCalendarItems } from "../../src/lib/calendar-items"
import { canAcceptSignups } from "../../src/domain/events/status"

import type {
    ClanLanguage,
    DiscordConfig,
    EventRecord,
    Group,
    MatchTeamAssignment,
    MatchTeamSlot,
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
    formatEventStatus,
    formatInTimezone,
    generateCalendarUrl,
    buildPublicRosterUrl,
    pickButtonStyle,
} from "./utils"
import {
    SIGNUP_GENERAL,
    SIGNUP_NOT_ATTENDING,
    SIGNUP_PRIMARY_GROUP,
    TRAINING_ATTEND,
} from "./constants"

type EventEmbedOptions = {
    forumChannelId?: string
    showPublishedRosterImage?: boolean
    rosterImageUrl?: string
    hideSignupDetails?: boolean
}

type EventLink = { label: string; url: string }

export function buildAnnouncementMessage(
    payload: SyncPayload,
    event: EventRecord,
    userDisplayNames: Record<string, string> = payload.userDisplayNames,
    options?: EventEmbedOptions
) {
    const roster = payload.rosters.find((item) => item.eventId === event.id)
    return {
        embed: buildEventEmbed(
            payload.config,
            payload.groups,
            payload.guild.eventCategories,
            event,
            roster,
            userDisplayNames,
            options
        ),
        components: buildEventComponents(
            payload.config,
            payload.groups,
            event,
            roster
        ),
    }
}

export function buildAnnouncementV2Message(
    payload: SyncPayload,
    event: EventRecord,
    userDisplayNames: Record<string, string> = payload.userDisplayNames,
    options?: EventEmbedOptions & {
        pingRoleIds?: string[]
        eventLinks?: EventLink[]
        /** Adds one logo section per assigned team (event information cards). */
        matchTeamCards?: boolean
    }
) {
    const legacy = buildAnnouncementMessage(
        payload,
        event,
        userDisplayNames,
        options
    )
    const embed = legacy.embed.toJSON()
    const container = new ContainerBuilder().setAccentColor(
        embed.color ?? 0xffb000
    )
    const roleMentions = options?.pingRoleIds
        ?.map((roleId) => `<@&${roleId}>`)
        .join(" ")
    if (roleMentions) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(roleMentions)
        )
    }
    const descriptionBlocks = (embed.description ?? "")
        .split(/\n?-{20,}\n?/)
        .map((block) => block.trim())
        .filter(Boolean)
    const publishedRoster = payload.rosters.find(
        (item) => item.eventId === event.id && item.published
    )
    const messages = getClanDiscordMessages(payload.config.defaultLanguage)
    // The event information card turns into the roster card once the roster
    // is published: roster title, meeting, squads and reserves.
    const rosterSummary =
        options?.showPublishedRosterImage && publishedRoster
            ? buildRosterSummaryText(
                  payload.config,
                  event,
                  publishedRoster,
                  userDisplayNames
              )
            : undefined
    const title = embed.title ?? event.name
    const heading = [
        `# ${
            rosterSummary === undefined
                ? title
                : fillTemplate(messages.rosterSummary.title, { event: title })
        }`,
        descriptionBlocks.shift(),
    ]
        .filter(Boolean)
        .join("\n")
        .slice(0, 4000)
    const thumbnailUrl = embed.thumbnail?.url
    if (thumbnailUrl) {
        container.addSectionComponents(
            new SectionBuilder()
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(heading)
                )
                .setThumbnailAccessory(
                    new ThumbnailBuilder({
                        media: { url: thumbnailUrl },
                        description: `${event.name} thumbnail`,
                    })
                )
        )
    } else {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(heading)
        )
    }
    if (rosterSummary) {
        container.addSeparatorComponents(new SeparatorBuilder())
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(rosterSummary.slice(0, 4000))
        )
    }
    for (const block of descriptionBlocks) {
        container.addSeparatorComponents(new SeparatorBuilder())
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(block.slice(0, 4000))
        )
    }

    // Components V2 messages cannot carry embeds, so the per-team logo cards
    // are sections with a thumbnail inside the event card.
    const teamSections = options?.matchTeamCards
        ? buildMatchTeamV2Sections(event)
        : []
    if (teamSections.length) {
        container.addSeparatorComponents(new SeparatorBuilder())
        container.addSectionComponents(...teamSections)
    }

    if (options?.eventLinks?.length) {
        container.addSeparatorComponents(new SeparatorBuilder())
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                options.eventLinks
                    .map((link) => `[${link.label}](${link.url})`)
                    .join(" • ")
                    .slice(0, 4000)
            )
        )
    }

    // The roster card lists squads instead of the sign-up names.
    const signupText =
        rosterSummary === undefined
            ? buildCompactV2FieldText(embed.fields ?? [])
            : ""
    if (signupText) {
        container.addSeparatorComponents(new SeparatorBuilder())
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(signupText.slice(0, 4000))
        )
    }

    const generatedRosterImageUrl = publishedRoster
        ? buildRosterImageUrl(
              event.id,
              getRosterImageVersion(event, publishedRoster.updatedAt)
          )
        : undefined
    const publishedRosterImageUrl =
        publishedRoster &&
        (options?.showPublishedRosterImage ||
            shouldShowPublishedRosterImage(event, publishedRoster))
            ? (options?.rosterImageUrl ?? generatedRosterImageUrl)
            : undefined
    // Legacy embeds have only one full-size image slot, which is why the
    // roster used to replace the event artwork. Components V2 media galleries
    // support several images, so retain the artwork and append the roster.
    const galleryImageUrls = [
        event.kind === "match" ? event.imageUrl : undefined,
        embed.image?.url === generatedRosterImageUrl
            ? undefined
            : embed.image?.url,
        publishedRosterImageUrl,
    ].filter(
        (url, index, urls): url is string =>
            Boolean(url) && urls.indexOf(url) === index
    )
    if (galleryImageUrls.length) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                galleryImageUrls.map((url) => ({
                    media: { url },
                    description:
                        url === publishedRosterImageUrl
                            ? `${event.name} roster`
                            : `${event.name} image`,
                }))
            )
        )
    }
    const v2Controls =
        options?.showPublishedRosterImage && publishedRoster
            ? [
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
                          ),
                      new ButtonBuilder()
                          .setStyle(ButtonStyle.Link)
                          .setLabel(messages.buttons.addToCalendar)
                          .setURL(
                              generateCalendarUrl(
                                  event,
                                  payload.config.defaultLanguage
                              )
                          )
                  ),
              ]
            : isSignupOpen(event) && event.kind === "match"
              ? [
                    new ActionRowBuilder<ButtonBuilder>().addComponents(
                        new ButtonBuilder()
                            .setCustomId(
                                `signup:${event.id}:${SIGNUP_PRIMARY_GROUP}:${payload.config.guildId}`
                            )
                            .setStyle(ButtonStyle.Success)
                            .setLabel(
                                getClanDiscordMessages(
                                    payload.config.defaultLanguage
                                ).embed.chooseSignup
                            ),
                        new ButtonBuilder()
                            .setCustomId(
                                `check-signup:${event.id}:${payload.config.guildId}`
                            )
                            .setStyle(ButtonStyle.Secondary)
                            .setLabel(
                                getClanDiscordMessages(
                                    payload.config.defaultLanguage
                                ).buttons.checkSignup
                            ),
                        new ButtonBuilder()
                            .setCustomId(
                                `signup:${event.id}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}:${payload.config.guildId}`
                            )
                            .setStyle(ButtonStyle.Danger)
                            .setLabel(
                                getClanDiscordMessages(
                                    payload.config.defaultLanguage
                                ).buttons.decline
                            ),
                        new ButtonBuilder()
                            .setStyle(ButtonStyle.Link)
                            .setLabel(
                                getClanDiscordMessages(
                                    payload.config.defaultLanguage
                                ).buttons.addToCalendar
                            )
                            .setURL(
                                generateCalendarUrl(
                                    event,
                                    payload.config.defaultLanguage
                                )
                            )
                    ),
                ]
              : legacy.components
    for (const row of v2Controls) {
        container.addActionRowComponents(row)
    }

    return { components: [container] }
}

export function buildCompactV2FieldText(fields: APIEmbedField[]) {
    const sections: Array<{ name: string; values: string[] }> = []

    for (const field of fields) {
        if (field.name !== "\u200B") {
            sections.push({ name: field.name, values: [field.value] })
            continue
        }

        if (field.value !== "\u200B") {
            sections[sections.length - 1]?.values.push(field.value)
        }
    }

    return sections
        .map((section) => {
            const columns = section.values.map((value) =>
                value
                    .split("\n")
                    .filter((name) => name.trim() && name !== "\u200B")
            )
            // Legacy fields are filled across each row; undo that layout for V2.
            const members: string[] = []
            const rowCount = Math.max(
                0,
                ...columns.map((column) => column.length)
            )
            for (let row = 0; row < rowCount; row++)
                for (const column of columns)
                    if (column[row]) members.push(column[row])
            return `**${section.name}**\n${members.join(", ")}`
        })
        .join("\n\n")
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
    const messages = getClanDiscordMessages(config.defaultLanguage)
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

function resolveEventCategoryLabel(
    categories: SyncPayload["guild"]["eventCategories"],
    event: EventRecord
) {
    if (event.kind === "training") {
        return undefined
    }

    return (
        findEventCategory(categories, event.matchType)?.label ??
        event.matchType?.trim() ??
        undefined
    )
}

function resolveEventCategoryColor(
    categories: SyncPayload["guild"]["eventCategories"],
    event: EventRecord
) {
    return findEventCategory(categories, event.matchType)?.color ?? "#FFB000"
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

    return Number.parseInt("FFB000", 16)
}

function buildInlineSignupFields(
    name: string,
    members: string[],
    emptyLabel: string
): APIEmbedField[] {
    if (!members.length) {
        return [{ name, value: emptyLabel, inline: true }]
    }

    const columnCount = Math.min(3, members.length)
    const columns = Array.from({ length: columnCount }, () => [] as string[])
    for (let index = 0; index < members.length; index += 1) {
        columns[index % columnCount]!.push(members[index]!)
    }

    return columns.map((columnMembers, index) => ({
        name: index === 0 ? name : "\u200B",
        value: columnMembers.join("\n"),
        inline: true,
    }))
}

function buildInlineFieldPadding(fieldCount: number): APIEmbedField[] {
    const remainder = fieldCount % 3
    if (remainder === 0) {
        return []
    }

    return Array.from({ length: 3 - remainder }, () => ({
        name: "\u200B",
        value: "\u200B",
        inline: true,
    }))
}

/** Separates the header, notes and status blocks (also splits V2 cards). */
const DESCRIPTION_BLOCK_SEPARATOR = "----------------------------------------"
const DISCORD_EMBED_TITLE_LIMIT = 256
const DISCORD_EMBED_DESCRIPTION_LIMIT = 4096

/** "Name · Category"; trainings and uncategorised events keep the name. */
export function formatEventTitle(
    categories: SyncPayload["guild"]["eventCategories"],
    event: EventRecord
) {
    const categoryLabel = resolveEventCategoryLabel(categories, event)?.trim()
    return truncateUtf16(
        categoryLabel && categoryLabel !== event.name.trim()
            ? `${event.name} · ${categoryLabel}`
            : event.name,
        DISCORD_EMBED_TITLE_LIMIT
    )
}

/**
 * Public event card text in the clan language. Times are Discord timestamps,
 * so every reader sees them in their own zone. A match server and its password
 * never appear here: rostered players see both under "My assignment".
 */
function buildEventDescription(
    config: DiscordConfig,
    event: EventRecord,
    options: { signedUpCount?: number; forumChannelId?: string }
) {
    const messages = getClanDiscordMessages(config.defaultLanguage)
    const density = config.messageStyle?.iconDensity
    const icon = (line: MessageLine) => messageLineIcon(line, density)
    const header: string[] = []
    if (event.kind === "match" && event.side) {
        header.push(`**${icon("side")}${messages.embed.side}:** ${event.side}`)
    }
    const matchTeamsSummary = formatMatchTeamsSummary(event)
    if (matchTeamsSummary) {
        header.push(
            `**${icon("teams")}${messages.embed.teams}:** ${matchTeamsSummary}`
        )
    }
    const start = discordTimestamp(event.gameStart, "F")
    if (start) {
        header.push(
            `**${icon("start")}${event.kind === "training" ? messages.embed.trainingStart : messages.embed.matchStart}:** ${start}`
        )
    }
    const meeting = discordTimestamp(event.meetingStart, "t")
    // A closed registration is shown by the status, not a past deadline.
    const registrationEnd = isSignupOpen(event)
        ? discordTimestamp(event.registrationEnd, "R")
        : undefined
    const facts = [
        event.kind === "match" && event.map
            ? (formatHllPresetLabel(event.map) ?? event.map)
            : undefined,
        event.kind === "match" && event.cap
            ? `${messages.embed.cap} ${event.cap}`
            : undefined,
        meeting
            ? fillTemplate(messages.embed.meetingAt, { time: meeting })
            : undefined,
        registrationEnd
            ? fillTemplate(messages.embed.registrationCloses, {
                  time: registrationEnd,
              })
            : undefined,
    ].filter((fact): fact is string => Boolean(fact))
    if (facts.length) header.push(`${icon("details")}${facts.join(" · ")}`)
    // Trainings have no roster assignment to carry the server privately.
    if (event.kind === "training" && event.server) {
        header.push(
            `**${icon("server")}${messages.embed.server}:** ${event.server}`
        )
    }

    const notes = formatDiscordMarkdown(event.notes || event.description)
    const status = [
        options.signedUpCount === undefined
            ? undefined
            : `**${fillTemplate(messages.embed.signedUpTotal, {
                  count: String(options.signedUpCount),
              })}**`,
        `${messages.embed.status}: ${formatEventStatus(event.status, config.defaultLanguage)}`,
    ]
        .filter(Boolean)
        .join(" · ")
    const footer = [
        `${icon("status")}${status}`,
        options.forumChannelId
            ? `${icon("forum")}${messages.embed.eventForum}: <#${options.forumChannelId}>`
            : undefined,
    ].filter(Boolean)

    return [header.join("\n"), notes, footer.join("\n")]
        .filter(Boolean)
        .join(`\n${DESCRIPTION_BLOCK_SEPARATOR}\n`)
        .slice(0, DISCORD_EMBED_DESCRIPTION_LIMIT)
}

export function buildEventEmbed(
    config: DiscordConfig,
    groups: Group[],
    categories: SyncPayload["guild"]["eventCategories"],
    event: EventRecord,
    roster?: Roster,
    userDisplayNames: Record<string, string> = {},
    options?: EventEmbedOptions
) {
    const messages = getClanDiscordMessages(config.defaultLanguage)
    const signupsByGroup = new Map<string, string[]>()
    const groupNameById = new Map(groups.map((group) => [group.id, group.name]))

    const participantSignups = event.participants.map((participant) => ({
        userId: participant.userId,
        group:
            participant.status === "attending"
                ? (participant.group ?? "ATTENDING")
                : SIGNUP_NOT_ATTENDING,
    }))
    const signups =
        participantSignups.length > 0 ? participantSignups : event.signUps

    for (const signUp of signups) {
        const rawGroup = signUp.group ?? "ATTENDING"
        const key =
            rawGroup === SIGNUP_NOT_ATTENDING
                ? SIGNUP_NOT_ATTENDING
                : (groupNameById.get(rawGroup) ?? rawGroup)
        const list = signupsByGroup.get(key) ?? []
        list.push(
            resolveAnnouncementDisplayName(signUp.userId, userDisplayNames)
        )
        signupsByGroup.set(key, list)
    }

    for (const members of signupsByGroup.values()) {
        members.sort((left, right) =>
            left.localeCompare(right, config.defaultLanguage, {
                sensitivity: "base",
            })
        )
    }

    const signedUpCount = signups.filter(
        (signUp) => signUp.group !== SIGNUP_NOT_ATTENDING
    ).length
    const embed = new EmbedBuilder()
        .setTitle(formatEventTitle(categories, event))
        .setDescription(
            buildEventDescription(config, event, {
                signedUpCount: options?.hideSignupDetails
                    ? undefined
                    : signedUpCount,
                forumChannelId: options?.forumChannelId,
            })
        )
        .setColor(
            resolveMessageAccentColor({
                categoryColor: findEventCategory(categories, event.matchType)
                    ?.color,
                messageStyle: config.messageStyle,
            })
        )
        .setFooter({ text: messages.embed.managedFooter })

    if (event.thumbnailUrl) {
        embed.setThumbnail(event.thumbnailUrl)
    }

    if (
        event.kind === "match" &&
        roster?.published &&
        (options?.showPublishedRosterImage ||
            shouldShowPublishedRosterImage(event, roster))
    ) {
        embed.setImage(
            buildRosterImageUrl(
                event.id,
                getRosterImageVersion(event, roster?.updatedAt)
            )
        )
        if (!isSignupOpen(event)) {
            return embed
        }
    }

    if (event.kind === "match" && event.imageUrl) {
        embed.setImage(event.imageUrl)
    }

    if (event.kind === "match" && !options?.hideSignupDetails) {
        const configuredGroupIds = event.signupGroupIds
            ? new Set(event.signupGroupIds)
            : null
        const visibleGroups = configuredGroupIds
            ? groups.filter((group) => configuredGroupIds.has(group.id))
            : groups
        const signupSections: APIEmbedField[][] = []

        for (const group of visibleGroups) {
            const members = signupsByGroup.get(group.name) ?? []
            signupSections.push(
                buildInlineSignupFields(
                    `${group.discordEmoji ? `${group.discordEmoji} ` : ""}${group.name} (${members.length})`,
                    members,
                    messages.embed.nobodyYet
                )
            )
        }

        const generalAttending = signupsByGroup.get("ATTENDING") ?? []
        if (generalAttending.length > 0) {
            signupSections.push(
                buildInlineSignupFields(
                    `✅ ${messages.embed.attending} (${generalAttending.length})`,
                    generalAttending,
                    messages.embed.nobodyYet
                )
            )
        }

        const nonAttending = signupsByGroup.get(SIGNUP_NOT_ATTENDING) ?? []
        signupSections.push(
            buildInlineSignupFields(
                `❌ ${messages.embed.notAttending} (${nonAttending.length})`,
                nonAttending,
                messages.embed.nobodyYet
            )
        )

        signupSections.forEach((sectionFields, index) => {
            embed.addFields(...sectionFields)
            if (index < signupSections.length - 1) {
                embed.addFields(
                    ...buildInlineFieldPadding(sectionFields.length)
                )
            }
        })

        return embed
    }

    const attending = event.participants
        .filter((participant) => participant.status === "attending")
        .map((participant) =>
            resolveAnnouncementDisplayName(participant.userId, userDisplayNames)
        )
    const nonAttending = event.participants
        .filter((participant) => participant.status === "not_attending")
        .map((participant) =>
            resolveAnnouncementDisplayName(participant.userId, userDisplayNames)
        )

    if (options?.hideSignupDetails) {
        return embed
    }

    embed.addFields(
        {
            name: `✅ ${messages.embed.attending} (${attending.length})`,
            value: attending.length
                ? attending.join(", ")
                : messages.embed.nobodyYet,
            inline: false,
        },
        {
            name: `❌ ${messages.embed.notAttending} (${nonAttending.length})`,
            value: nonAttending.length
                ? nonAttending.join(", ")
                : messages.embed.nobodyYet,
            inline: false,
        }
    )

    return embed
}

const MATCH_TEAM_SLOT_ORDER: Record<MatchTeamSlot, number> = {
    a: 0,
    b: 1,
    c: 2,
}
/** Discord rejects messages with more than ten embeds. */
const DISCORD_MAX_EMBEDS = 10
const DISCORD_EMBED_AUTHOR_NAME_LIMIT = 256
const DISCORD_THUMBNAIL_DESCRIPTION_LIMIT = 1024

function sortMatchTeams(event: EventRecord) {
    return [...(event.matchTeams ?? [])].sort(
        (left, right) =>
            MATCH_TEAM_SLOT_ORDER[left.slot] - MATCH_TEAM_SLOT_ORDER[right.slot]
    )
}

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

/**
 * Makes user-supplied text render literally instead of as a mention, channel,
 * emoji, timestamp or command reference: every `@` and every `<@`, `<#`, `<:`,
 * `</` or `<t:`-style opener is broken with a zero-width space.
 */
export function neutralizeDiscordMentions(value: string) {
    return value
        .replace(/@/g, "@\u200B")
        .replace(/<(?=[@#:&/]|[a-z]+:)/gi, "<\u200B")
}

/** Breaks `://` with a zero-width space so text never becomes a URL. */
function breakUrlSchemes(value: string) {
    return value.replace(/:\/\//g, ":\u200B//")
}

/**
 * Escapes stored team text for Discord surfaces that render Markdown. Brackets
 * and parentheses are escaped so labels cannot form masked links, and `://` is
 * broken so a label never becomes a clickable URL. Every `-` is escaped (which
 * also covers bulleted lists) so stored text can never contain the `-{20,}`
 * run that splits Components V2 cards into separate blocks.
 */
export function escapeMatchTeamText(value: string) {
    const escaped = escapeMarkdown(toSingleLine(value), {
        heading: true,
        numberedList: true,
    })
        .replace(/[[\]()-]/g, "\\$&")
        .replace(/^>/, "\\>")
    return breakUrlSchemes(neutralizeDiscordMentions(escaped))
}

/** Plain-text label for Discord fields that do not render Markdown. */
function plainMatchTeamLabel(assignment: MatchTeamAssignment) {
    const name = toSingleLine(assignment.snapshot.name)
    const code = toSingleLine(assignment.snapshot.shortCode ?? "")
    return breakUrlSchemes(
        neutralizeDiscordMentions(code ? `${name} [${code}]` : name)
    )
}

function formatMatchTeamLabel(
    assignment: MatchTeamAssignment,
    includeSide: boolean
) {
    const parts = [escapeMatchTeamText(assignment.snapshot.name)]
    const code = assignment.snapshot.shortCode?.trim()
    if (code) parts.push(`[${escapeMatchTeamText(code)}]`)
    const side = assignment.side?.trim()
    if (includeSide && side) parts.push(`(${escapeMatchTeamText(side)})`)
    return parts.join(" ")
}

/** "Name [CODE] (Side) vs …" ordered by slot; undefined without assignments. */
export function formatMatchTeamsSummary(event: EventRecord) {
    if (event.kind !== "match") return undefined
    const teams = sortMatchTeams(event)
    if (!teams.length) return undefined
    return teams
        .map((assignment) => formatMatchTeamLabel(assignment, true))
        .join(" vs ")
}

/** Two teams play an HLL match; Wardogs matches have up to three. */
export function getMatchTeamLogoLimit(event: Pick<EventRecord, "gameId">) {
    return event.gameId === "wardogs" ? 3 : 2
}

function parseHttpUrl(value: string | null) {
    if (!value) return undefined
    try {
        const url = new URL(value)
        return url.protocol === "http:" || url.protocol === "https:"
            ? url.href
            : undefined
    } catch {
        return undefined
    }
}

function listMatchTeamLogos(event: EventRecord) {
    if (event.kind !== "match") return []
    return sortMatchTeams(event)
        .flatMap((assignment) => {
            const logoUrl = parseHttpUrl(assignment.snapshot.logoUrl)
            return logoUrl ? [{ assignment, logoUrl }] : []
        })
        .slice(0, getMatchTeamLogoLimit(event))
}

/**
 * One small embed per assigned team with a usable logo, for legacy (non
 * Components V2) event information messages. Never exceeds Discord's ten
 * embed limit together with `existingEmbedCount`.
 */
export function buildMatchTeamLogoEmbeds(
    event: EventRecord,
    color: number | undefined,
    existingEmbedCount = 1
) {
    const available = Math.max(0, DISCORD_MAX_EMBEDS - existingEmbedCount)
    return listMatchTeamLogos(event)
        .slice(0, available)
        .map(({ assignment, logoUrl }) => {
            // Embed author names render as plain text, so Markdown escaping
            // would show literal backslashes; mentions are still neutralized.
            const embed = new EmbedBuilder().setAuthor({
                name: truncateUtf16(
                    plainMatchTeamLabel(assignment),
                    DISCORD_EMBED_AUTHOR_NAME_LIMIT
                ),
                iconURL: logoUrl,
            })
            if (color !== undefined) embed.setColor(color)
            const side = assignment.side?.trim()
            if (side) embed.setDescription(escapeMatchTeamText(side))
            return embed
        })
}

/** Components V2 equivalent of {@link buildMatchTeamLogoEmbeds}. */
export function buildMatchTeamV2Sections(event: EventRecord) {
    return listMatchTeamLogos(event).map(({ assignment, logoUrl }) => {
        const side = assignment.side?.trim()
        const content = [
            `**${formatMatchTeamLabel(assignment, false)}**`,
            side ? escapeMatchTeamText(side) : undefined,
        ]
            .filter(Boolean)
            .join("\n")
        return new SectionBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(content)
            )
            .setThumbnailAccessory(
                new ThumbnailBuilder({
                    media: { url: logoUrl },
                    description: truncateUtf16(
                        plainMatchTeamLabel(assignment),
                        DISCORD_THUMBNAIL_DESCRIPTION_LIMIT
                    ),
                })
            )
    })
}

export function buildEventComponents(
    config: DiscordConfig,
    groups: Group[],
    event: EventRecord,
    roster?: Roster
) {
    const messages = getClanDiscordMessages(config.defaultLanguage)

    if (isSignupOpen(event)) {
        return buildSignupButtons(config, groups, event.id, event)
    }

    if (event.status === "starting" && roster?.published) {
        return [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`attendance:${event.id}:ack`)
                    .setStyle(ButtonStyle.Success)
                    .setLabel(messages.buttons.acknowledgeAttendance),
                new ButtonBuilder()
                    .setCustomId(`attendance-late:${event.id}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(messages.embed.runningLate),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel(messages.buttons.addToCalendar)
                    .setURL(generateCalendarUrl(event, config.defaultLanguage))
            ),
        ]
    }

    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Link)
                .setLabel(messages.buttons.addToCalendar)
                .setURL(generateCalendarUrl(event, config.defaultLanguage))
        ),
    ]
}

export function buildForumInfoEmbed(
    config: DiscordConfig,
    event: EventRecord,
    stratmapLinks: string[] = []
) {
    const messages = getClanDiscordMessages(config.defaultLanguage)
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

export function buildAttendanceReminderComponents(
    eventId: string,
    language: ClanLanguage
) {
    const messages = getClanDiscordMessages(language)
    return [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`attendance:${eventId}:ack`)
                .setStyle(ButtonStyle.Success)
                .setLabel(messages.buttons.acknowledgeAttendance),
            new ButtonBuilder()
                .setCustomId(`attendance-late:${eventId}`)
                .setStyle(ButtonStyle.Secondary)
                .setLabel(messages.embed.runningLate)
        ),
    ]
}

export { buildForumThreadName }

export function buildTicketPanelEmbed(config: DiscordConfig) {
    const ticketSettings = config.ticketSettings
    if (!ticketSettings) {
        return null
    }

    const messages = getClanDiscordMessages(config.defaultLanguage)
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

    const messages = getClanDiscordMessages(config.defaultLanguage)
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
                    getClanDiscordMessages(config.defaultLanguage).panels
                        .membershipApply
                )
                .setStyle(ButtonStyle.Success)
        ),
    ]
}

export function buildMembershipPanelMessage(config: DiscordConfig) {
    const membershipSettings = config.membershipSettings
    if (!membershipSettings?.categories.length) {
        return null
    }

    const messages = getClanDiscordMessages(config.defaultLanguage)
    const container = new ContainerBuilder().setAccentColor(0x16a34a)
    if (membershipSettings.panelImageUrl) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems({
                media: { url: membershipSettings.panelImageUrl },
                description: membershipSettings.panelTitle.slice(0, 1024),
            })
        )
    }
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            [
                `# ${membershipSettings.panelTitle.slice(0, 256)}`,
                formatDiscordMarkdown(
                    membershipSettings.panelDescription,
                    4000
                ),
            ]
                .filter(Boolean)
                .join("\n")
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
    const messages = getClanDiscordMessages(input.config.defaultLanguage)
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
    const messages = getClanDiscordMessages(config.defaultLanguage)
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
        : "FFB000"
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
    const messages = getClanDiscordMessages(config.defaultLanguage)
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
            text: `${messages.embed.managedFooter} • ${config.timezone}`,
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
    const messages = getClanDiscordMessages(input.language)
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
    const messages = getClanDiscordMessages(input.language)
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

function shouldShowPublishedRosterImage(event: EventRecord, roster?: Roster) {
    return Boolean(event.kind === "match" && roster?.published)
}

function isSignupOpen(event: EventRecord) {
    return canAcceptSignups(event, new Date(Date.now()))
}

function buildSignupButtons(
    config: DiscordConfig,
    groups: Group[],
    eventId: string,
    event: EventRecord
) {
    const messages = getClanDiscordMessages(config.defaultLanguage)

    if (event.kind === "training") {
        return [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(
                        `signup:${eventId}:${encodeURIComponent(TRAINING_ATTEND)}`
                    )
                    .setStyle(ButtonStyle.Success)
                    .setLabel(messages.buttons.attend),
                new ButtonBuilder()
                    .setCustomId(`check-signup:${eventId}`)
                    .setStyle(ButtonStyle.Secondary)
                    .setLabel(messages.buttons.checkSignup),
                new ButtonBuilder()
                    .setCustomId(
                        `signup:${eventId}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}`
                    )
                    .setStyle(ButtonStyle.Danger)
                    .setLabel(messages.buttons.decline),
                new ButtonBuilder()
                    .setStyle(ButtonStyle.Link)
                    .setLabel(messages.buttons.addToCalendar)
                    .setURL(generateCalendarUrl(event, config.defaultLanguage))
            ),
        ]
    }

    const configuredGroupIds = event.signupGroupIds
        ? new Set(event.signupGroupIds)
        : null
    const visibleGroups = configuredGroupIds
        ? groups.filter((group) => configuredGroupIds.has(group.id))
        : groups
    const allButtons = [
        ...(event.useGeneralSignup
            ? [
                  new ButtonBuilder()
                      .setCustomId(
                          `signup:${eventId}:${encodeURIComponent(SIGNUP_GENERAL)}`
                      )
                      .setStyle(ButtonStyle.Success)
                      .setLabel(messages.buttons.generalSignup),
              ]
            : []),
        ...visibleGroups.map((group) => {
            const button = new ButtonBuilder()
                .setCustomId(
                    `signup:${eventId}:${encodeURIComponent(group.id)}`
                )
                .setStyle(pickButtonStyle(group.color))

            if (group.discordEmoji) {
                button.setEmoji(group.discordEmoji)
            } else {
                button.setLabel(group.name.slice(0, 20))
            }

            return button
        }),
        new ButtonBuilder()
            .setCustomId(`check-signup:${eventId}`)
            .setStyle(ButtonStyle.Secondary)
            .setLabel(messages.buttons.checkSignup),
        new ButtonBuilder()
            .setCustomId(
                `signup:${eventId}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}`
            )
            .setStyle(ButtonStyle.Danger)
            .setLabel(messages.buttons.decline),
        new ButtonBuilder()
            .setStyle(ButtonStyle.Link)
            .setLabel(messages.buttons.addToCalendar)
            .setURL(generateCalendarUrl(event, config.defaultLanguage)),
    ]

    const rows: Array<ActionRowBuilder<ButtonBuilder>> = []
    for (let index = 0; index < allButtons.length; index += 5) {
        rows.push(
            new ActionRowBuilder<ButtonBuilder>().addComponents(
                allButtons.slice(index, index + 5)
            )
        )
    }

    return rows
}
