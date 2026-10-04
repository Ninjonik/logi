import {
    AttachmentBuilder,
    ChannelType,
    MessageFlags,
    type Client,
    type Guild,
    type TextChannel,
} from "discord.js"

import {
    cancelScheduledDiscordEvent,
    deriveScheduledEventLifecycle,
    getStoredScheduledEventStatus,
    syncScheduledDiscordEvent,
} from "../scheduled-events"
import {
    buildAnnouncementMessage,
    buildAnnouncementV2Message,
    buildMatchTeamLogoEmbeds,
} from "../message-builders"
import {
    buildRosterImageUrl,
    getRosterImageVersion,
    warmRosterImage,
    withTimeout,
} from "../utils"
import { isRegistrationAnnouncementDue } from "../../../src/domain/events/registration-announcement"
import { eventMessageIdentity } from "../../../src/domain/discord-publications/legacy-bindings"
import { eventInfoMessageRenderVersion } from "../../../src/domain/discord-sync/render-version"
import { shouldSyncEvent, shouldWriteMinimalConcludedSyncState } from "./rules"
import type { EventRecord, Roster, SyncPayload, SyncState } from "../types"
import { publishManagedMessage, isUnknownMessage } from "./publication"
import { reportClanDiscordError } from "../error-reporting"
import { logError, logInfo, logWarn } from "../log"
import { syncEventRoles } from "../event-roles"
import { getCalendarSyncVersion } from "./work"
import { convex, references } from "../convex"
import { syncForumChannel } from "../forum"
import { env } from "../environment"

// One event can legitimately include role reconciliation, two message writes,
// a scheduled Discord event and forum provisioning. Discord rate limits make
// the previous 20-second aggregate deadline too short for that valid work.
const EVENT_SYNC_TIMEOUT_MS = 60_000

function shouldShowPublishedRosterImage(
    event: EventRecord,
    rosterUpdatedAt?: string
) {
    return Boolean(
        rosterUpdatedAt &&
        (event.status === "closed" || event.status === "starting")
    )
}

async function buildPublishedRosterImageAttachment(
    event: EventRecord,
    roster: Roster
) {
    const attachmentName = `published-roster-${Buffer.from(
        `${event.id}:${roster.updatedAt}`
    ).toString("base64url")}.png`
    const publicUrl = new URL(
        buildRosterImageUrl(
            event.id,
            getRosterImageVersion(event, roster.updatedAt)
        )
    )
    const internalOrigin = new URL(env.internalAppSiteUrl)
    const imageUrl = new URL(
        `${publicUrl.pathname}${publicUrl.search}`,
        internalOrigin
    )
    const response = await withTimeout(
        fetch(imageUrl),
        45_000,
        `Roster image attachment for ${event.id}`
    )
    if (
        !response.ok ||
        !response.headers.get("content-type")?.startsWith("image/png")
    ) {
        throw new Error(`Unable to render roster image (${response.status}).`)
    }

    return {
        attachment: new AttachmentBuilder(
            Buffer.from(await response.arrayBuffer()),
            {
                name: attachmentName,
                description: `${event.name} roster`,
            }
        ),
        mediaUrl: `attachment://${attachmentName}`,
    }
}

export function getAnnouncementPingRoleIds(
    payload: SyncPayload,
    event: EventRecord
) {
    const roleIds =
        event.pingMode === "roles"
            ? (event.pingRoleIds ?? [])
            : event.pingMode === "clan" ||
                (event.pingMode === undefined && event.pingClan)
              ? payload.config.clanRoleId
                  ? [payload.config.clanRoleId]
                  : []
              : []

    return [...new Set(roleIds.map((roleId) => roleId.trim()).filter(Boolean))]
}

export async function resolveAnnouncementDisplayNames(
    payload: SyncPayload,
    event: EventRecord,
    guild: Guild
) {
    const userIds = new Set<string>()

    for (const signUp of event.signUps) {
        userIds.add(signUp.userId)
    }

    for (const participant of event.participants) {
        userIds.add(participant.userId)
    }

    if (userIds.size === 0) {
        return payload.userDisplayNames
    }

    const resolvedDisplayNames = { ...payload.userDisplayNames }
    const members = await guild.members
        .fetch({ user: [...userIds] })
        .catch(() => null)

    if (members) {
        for (const [userId, member] of members) {
            const displayName = member.displayName?.trim()
            if (displayName) {
                resolvedDisplayNames[userId] = displayName
            }
        }
    }

    return resolvedDisplayNames
}

/**
 * Content of a split-channel event message. Legacy embed messages stay legacy
 * so their identity survives edits; new messages use Components V2. The event
 * information card (`includeSignup === false`) also carries one logo card per
 * assigned match team; events without assignments render exactly as before.
 */
export function buildEventMessageContent(input: {
    payload: SyncPayload
    event: EventRecord
    userDisplayNames: Record<string, string>
    legacyEmbeds: boolean
    includeSignup: boolean
    forumChannelId?: string
    pingRoleIds: string[]
}) {
    const { payload, event, includeSignup, forumChannelId } = input
    if (input.legacyEmbeds) {
        const { embed, components } = buildAnnouncementMessage(
            payload,
            event,
            input.userDisplayNames,
            {
                showPublishedRosterImage: !includeSignup,
                forumChannelId,
            }
        )
        return {
            embeds: includeSignup
                ? [embed]
                : [embed, ...buildMatchTeamLogoEmbeds(event, embed.data.color)],
            components: includeSignup ? components : [],
        }
    }
    return {
        ...buildAnnouncementV2Message(payload, event, input.userDisplayNames, {
            showPublishedRosterImage: !includeSignup,
            forumChannelId,
            pingRoleIds: input.pingRoleIds,
            matchTeamCards: !includeSignup,
        }),
        flags: MessageFlags.IsComponentsV2 as const,
    }
}

async function syncEventMessage(
    channel: TextChannel,
    messageId: string | undefined,
    payload: SyncPayload,
    event: EventRecord,
    roster: Roster | undefined,
    guild: Guild,
    includeSignup = true,
    forumChannelId?: string,
    storedAnnouncementChannelId?: string
) {
    const identity = eventMessageIdentity({
        eventId: event.id,
        kind: includeSignup ? "announcement" : "info",
        destination: channel.id,
        messageId,
        storedAnnouncementChannelId,
    })
    if (event.status === "concluded") {
        await retireEventMessage(
            guild.client,
            payload,
            event,
            includeSignup ? "announcement" : "info",
            identity.legacyChannelId,
            messageId
        )
        return undefined
    }
    const existing = messageId
        ? await channel.messages
              .fetch({ message: messageId, force: true, cache: false })
              .catch((error) => {
                  if (isUnknownMessage(error)) return null
                  throw error
              })
        : null
    if (
        !includeSignup &&
        shouldShowPublishedRosterImage(event, roster?.updatedAt)
    ) {
        // Warming the image cache is an optimization. The image URL is still
        // rendered in the announcement and can complete independently, so a
        // slow warm-up must not turn an otherwise successful event sync into
        // a Discord error-channel report.
        try {
            const warmed = await warmRosterImage(
                event.id,
                getRosterImageVersion(event, roster?.updatedAt)
            )
            if (!warmed) {
                logWarn("event-sync", "Roster image warm-up was unsuccessful", {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                    status: event.status,
                })
            }
        } catch (error) {
            logWarn("event-sync", "Roster image warm-up timed out or failed", {
                eventId: event.id,
                guildId: payload.config.guildId,
                status: event.status,
                error,
            })
        }
    }
    const displayEvent =
        !includeSignup && !roster?.published
            ? { ...event, participants: [], signUps: [] }
            : event
    const displayPayload =
        displayEvent === event
            ? payload
            : {
                  ...payload,
                  events: payload.events.map((item) =>
                      item.id === event.id ? displayEvent : item
                  ),
              }
    const names = await resolveAnnouncementDisplayNames(
        displayPayload,
        displayEvent,
        guild
    )
    const pingRoleIds = includeSignup
        ? getAnnouncementPingRoleIds(payload, event)
        : []
    const message = buildEventMessageContent({
        payload: displayPayload,
        event: displayEvent,
        userDisplayNames: names,
        legacyEmbeds: Boolean(
            existing && !existing.flags.has(MessageFlags.IsComponentsV2)
        ),
        includeSignup,
        forumChannelId,
        pingRoleIds,
    })
    return (
        (await publishManagedMessage(guild.client, {
            guildId: guild.id,
            ...identity,
            revision: Math.max(
                Date.parse(payload.config.updatedAt),
                Date.parse(event.updatedAt)
            ),
            channelId: channel.id,
            message: {
                ...message,
                allowedMentions: { roles: pingRoleIds, parse: [] },
            },
        })) ?? messageId
    )
}

async function retireEventMessage(
    client: Client,
    payload: SyncPayload,
    event: EventRecord,
    kind: "announcement" | "info",
    legacyChannelId?: string,
    legacyMessageId?: string
) {
    await publishManagedMessage(client, {
        guildId: payload.config.guildId,
        key: `event:${event.id}:${kind}`,
        revision: Math.max(
            Date.parse(payload.config.updatedAt),
            Date.parse(event.updatedAt)
        ),
        channelId: null,
        legacyChannelId,
        legacyMessageId,
        message: {},
    })
}

async function syncSquadVoiceChannels(
    guild: Guild,
    event: EventRecord,
    roster: Roster | undefined,
    defaultCategoryId: string | undefined,
    existingIds: string[]
) {
    if (event.status === "concluded") {
        await Promise.all(
            existingIds.map(async (id) => {
                const channel = await guild.channels.fetch(id).catch(() => null)
                await channel
                    ?.delete(`Event concluded: ${event.name}`)
                    .catch(() => null)
            })
        )
        return []
    }

    const categoryId = event.squadVoiceCategoryId ?? defaultCategoryId
    const meetingStart = new Date(event.meetingStart).getTime()
    if (
        !event.createSquadVoiceChannels ||
        !categoryId ||
        !Number.isFinite(meetingStart) ||
        Date.now() < meetingStart ||
        !roster
    ) {
        return existingIds
    }

    const createdIds = [...existingIds]
    for (const squad of roster.squads.filter(
        (squad) => squad.players.length > 0
    )) {
        const alreadyExists = await Promise.all(
            createdIds.map((id) => guild.channels.fetch(id).catch(() => null))
        ).then((channels) =>
            channels.some((channel) => channel?.name === squad.name)
        )
        if (alreadyExists) continue
        const channel = await guild.channels.create({
            name: squad.name,
            type: ChannelType.GuildVoice,
            parent: categoryId,
            reason: `Squad voice channel for ${event.name}`,
        })
        createdIds.push(channel.id)
    }
    return createdIds
}

export async function syncPayloadEvents(
    client: Client,
    queuedEventIds: Set<string>,
    payload: SyncPayload,
    options: { syncRoles: boolean } = { syncRoles: true }
) {
    for (const event of payload.events) {
        const state = payload.syncStates.find(
            (item) => item.eventId === event.id
        )
        const roster = payload.rosters.find((item) => item.eventId === event.id)
        const desiredScheduledEventStatus = payload.config.meetingChannelId
            ? getStoredScheduledEventStatus(
                  deriveScheduledEventLifecycle(event)
              )
            : undefined
        const queued = queuedEventIds.has(event.id)

        if (shouldWriteMinimalConcludedSyncState({ event, state, queued })) {
            logInfo(
                "event-sync",
                "Writing minimal sync state for concluded event without prior state",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                }
            )
            await convex.mutation(references.updateEventSyncState, {
                secret: env.internalSecret,
                eventId: event.id as never,
                guildId: payload.config.guildId,
                announcementChannelId: payload.config.announcementsChannelId,
                announcementMessageId: undefined,
                eventInfoMessageId: undefined,
                eventInfoMessageRenderVersion: undefined,
                scheduledEventId: undefined,
                scheduledEventStatus: desiredScheduledEventStatus,
                forumChannelId: undefined,
                forumThreadId: undefined,
                infoMessageId: undefined,
                topicMessageIds: [],
                lastEventUpdatedAt: event.updatedAt,
                lastRosterUpdatedAt: roster?.updatedAt,
                lastConfigUpdatedAt: payload.config.updatedAt,
                lastCalendarSyncVersion: getCalendarSyncVersion(event),
                lastSyncedAt: new Date().toISOString(),
            })
            continue
        }

        const needsSync = shouldSyncEvent({
            event,
            rosterUpdatedAt: roster?.updatedAt,
            configUpdatedAt: payload.config.updatedAt,
            state,
            desiredScheduledEventStatus,
            meetingChannelConfigured: Boolean(payload.config.meetingChannelId),
            eventInfoChannelConfigured:
                event.kind === "match" &&
                Boolean(
                    payload.config.announcementsChannelId &&
                    payload.config.eventInfoChannelId
                ),
            eventInfoMessageRequired:
                event.kind === "match" &&
                Boolean(
                    payload.config.announcementsChannelId &&
                    payload.config.eventInfoChannelId
                ),
            queued,
        })

        if (!needsSync) {
            logInfo(
                "event-sync",
                "Skipping event because no sync changes were detected",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                    status: event.status,
                }
            )
            continue
        }

        try {
            logInfo("event-sync", "Syncing event", {
                eventId: event.id,
                guildId: payload.config.guildId,
                status: event.status,
                hasState: Boolean(state),
                hasRoster: Boolean(roster),
            })
            await withTimeout(
                syncEvent(client, payload, event, state, options),
                EVENT_SYNC_TIMEOUT_MS,
                `event sync ${event.id}`
            )
        } catch (error) {
            logError("event-sync", "Discord bot event sync failed", {
                eventId: event.id,
                guildId: payload.config.guildId,
                error,
            })
            await reportClanDiscordError({
                client,
                guildId: payload.config.guildId,
                error,
                action: `Sync event "${event.name}"`,
                location: "Event sync",
                scope: "event-sync",
                target: event.name,
                details: {
                    eventId: event.id,
                    status: event.status,
                },
            })
        }
    }
}

async function syncEvent(
    client: Client,
    payload: SyncPayload,
    event: EventRecord,
    state?: SyncState,
    options: { syncRoles: boolean } = { syncRoles: true }
) {
    const guild = await client.guilds
        .fetch(payload.config.guildId)
        .catch(() => null)
    if (!guild) {
        logWarn(
            "event-sync",
            "Skipping event sync because guild could not be fetched",
            {
                eventId: event.id,
                guildId: payload.config.guildId,
            }
        )
        return
    }

    const roster = payload.rosters.find((item) => item.eventId === event.id)
    const eventRoles = options.syncRoles
        ? await syncEventRoles(guild, event, roster ?? null)
        : {
              attendeeRoleId: event.attendeeRoleId,
              reserveRoleId: event.reserveRoleId,
          }
    let announcementMessageId = state?.announcementMessageId
    let eventInfoMessageId = state?.eventInfoMessageId
    let scheduledEventId = state?.scheduledEventId
    let scheduledEventStatus = state?.scheduledEventStatus
    let forumChannelId = state?.forumChannelId
    const forumThreadId = state?.forumThreadId
    let infoMessageId = state?.infoMessageId
    let topicMessageIds = state?.topicMessageIds ?? []
    let squadVoiceChannelIds = state?.squadVoiceChannelIds ?? []
    squadVoiceChannelIds = await syncSquadVoiceChannels(
        guild,
        event,
        roster,
        payload.config.squadVoiceCategoryId,
        squadVoiceChannelIds
    )

    const registrationAnnouncementDue = isRegistrationAnnouncementDue(event)

    if (
        registrationAnnouncementDue &&
        event.createForumChannel &&
        payload.config.forumCategoryId &&
        !(event.status === "concluded" && !forumChannelId)
    ) {
        try {
            const topicPreset = payload.topicPresets.find(
                (preset) => preset.id === event.topicPresetId
            )
            const forumSyncResult = await syncForumChannel({
                config: payload.config,
                event,
                forumCategoryId: payload.config.forumCategoryId,
                forumChannelId,
                guild,
                existingTopicMessageIds: topicMessageIds,
                topicPreset,
                attendeeRoleId: eventRoles.attendeeRoleId,
                reserveRoleId: eventRoles.reserveRoleId,
            })

            forumChannelId = forumSyncResult.forumChannelId
            infoMessageId = forumSyncResult.infoMessageId
            if (
                !topicMessageIds.length &&
                forumSyncResult.topicMessageIds.length
            ) {
                topicMessageIds = forumSyncResult.topicMessageIds
            }
            logInfo("forum", "Forum sync completed", {
                eventId: event.id,
                guildId: payload.config.guildId,
                forumChannelId,
                infoMessageId,
                topicMessageCount: topicMessageIds.length,
            })
        } catch (error) {
            logError("forum", "Discord bot forum sync failed", {
                eventId: event.id,
                guildId: payload.config.guildId,
                forumChannelId,
                error,
            })
        }
    } else {
        logInfo("forum", "Skipping forum sync", {
            eventId: event.id,
            guildId: payload.config.guildId,
            reason: !event.createForumChannel
                ? "event-forum-creation-disabled"
                : !payload.config.forumCategoryId
                  ? "forum-category-not-configured"
                  : "concluded-without-existing-forum",
        })
    }

    logInfo("event-sync", "Event sync started", {
        eventId: event.id,
        guildId: payload.config.guildId,
        eventStatus: event.status,
        announcementChannelId: payload.config.announcementsChannelId,
        eventInfoChannelId: payload.config.eventInfoChannelId,
        meetingChannelId: payload.config.meetingChannelId,
        forumCategoryId: payload.config.forumCategoryId,
        createForumChannel: event.createForumChannel,
    })

    // New events snapshot their routing; records created before this field was
    // introduced intentionally retain the central-setting fallback.
    const announcementChannelId =
        event.announcementChannelId ?? payload.config.announcementsChannelId
    const eventInfoChannelId =
        event.eventInfoChannelId ?? payload.config.eventInfoChannelId
    const splitChannels =
        event.kind === "match" &&
        Boolean(announcementChannelId && eventInfoChannelId)
    logInfo("event-sync", "Resolved event message channels", {
        eventId: event.id,
        eventKind: event.kind,
        registrationChannelId: announcementChannelId,
        eventInfoChannelId,
        splitChannels,
        rosterPublished: Boolean(roster?.published),
    })
    const registrationChannel = announcementChannelId
        ? await guild.channels.fetch(announcementChannelId).catch(() => null)
        : null
    const infoChannel =
        splitChannels && eventInfoChannelId
            ? await guild.channels.fetch(eventInfoChannelId).catch(() => null)
            : null
    if (!registrationAnnouncementDue) {
        await retireEventMessage(
            client,
            payload,
            event,
            "announcement",
            state?.announcementChannelId ?? announcementChannelId,
            announcementMessageId
        )
        await retireEventMessage(
            client,
            payload,
            event,
            "info",
            eventInfoChannelId,
            eventInfoMessageId
        )
        announcementMessageId = undefined
        eventInfoMessageId = undefined
    }
    if (
        splitChannels &&
        registrationAnnouncementDue &&
        registrationChannel?.isTextBased() &&
        infoChannel?.isTextBased() &&
        registrationChannel.type !== ChannelType.GuildVoice &&
        infoChannel.type !== ChannelType.GuildVoice
    ) {
        const registrationText = registrationChannel as TextChannel
        const infoText = infoChannel as TextChannel
        if (roster?.published) {
            eventInfoMessageId = await syncEventMessage(
                infoText,
                eventInfoMessageId,
                payload,
                event,
                roster,
                guild,
                false,
                forumChannelId
            )
        } else {
            await retireEventMessage(
                client,
                payload,
                event,
                "info",
                infoText.id,
                eventInfoMessageId
            )
            eventInfoMessageId = undefined
        }
        logInfo("event-sync", "Synchronized event info message", {
            eventId: event.id,
            guildId: payload.config.guildId,
            messageId: eventInfoMessageId,
            rosterImageAttached: Boolean(
                event.kind === "match" && roster?.published
            ),
        })
        if (event.status === "registration") {
            announcementMessageId = await syncEventMessage(
                registrationText,
                announcementMessageId,
                payload,
                event,
                roster,
                guild,
                true,
                forumChannelId,
                state?.announcementChannelId
            )
        } else {
            await retireEventMessage(
                client,
                payload,
                event,
                "announcement",
                state?.announcementChannelId ?? registrationText.id,
                announcementMessageId
            )
            announcementMessageId = undefined
        }
    }
    const displayChannelId = splitChannels ? undefined : announcementChannelId
    if (!splitChannels && registrationAnnouncementDue) {
        await retireEventMessage(
            client,
            payload,
            event,
            "info",
            eventInfoChannelId,
            eventInfoMessageId
        )
        eventInfoMessageId = undefined
    }
    if (!splitChannels && event.status === "concluded") {
        await retireEventMessage(
            client,
            payload,
            event,
            "announcement",
            state?.announcementChannelId ?? announcementChannelId,
            announcementMessageId
        )
        announcementMessageId = undefined
    }
    // Discord's media gallery can be unreliable when it has to fetch a
    // generated image from our public URL. Upload the PNG with the message so
    // Discord renders an attachment it already owns instead.
    let rosterImageAttachment:
        | Awaited<ReturnType<typeof buildPublishedRosterImageAttachment>>
        | undefined
    if (!splitChannels && roster?.published && roster.updatedAt) {
        try {
            rosterImageAttachment = await buildPublishedRosterImageAttachment(
                event,
                roster
            )
        } catch (error) {
            logWarn("event-sync", "Roster image attachment failed", {
                eventId: event.id,
                guildId: payload.config.guildId,
                status: event.status,
                error,
            })
        }
    }
    if (
        displayChannelId &&
        registrationAnnouncementDue &&
        !(event.status === "concluded" && !announcementMessageId)
    ) {
        const channel = await guild.channels
            .fetch(displayChannelId)
            .catch(() => null)
        if (
            channel?.isTextBased() &&
            (channel.type === ChannelType.GuildText ||
                channel.type === ChannelType.GuildAnnouncement)
        ) {
            const textChannel = channel as TextChannel
            const userDisplayNames = await resolveAnnouncementDisplayNames(
                payload,
                event,
                guild
            )
            const pingRoleIds = getAnnouncementPingRoleIds(payload, event)
            const result = await publishManagedMessage(client, {
                guildId: guild.id,
                key: `event:${event.id}:announcement`,
                revision: Math.max(
                    Date.parse(payload.config.updatedAt),
                    Date.parse(event.updatedAt)
                ),
                channelId: event.status === "concluded" ? null : textChannel.id,
                legacyChannelId: state?.announcementChannelId ?? textChannel.id,
                legacyMessageId: announcementMessageId,
                message: {
                    ...buildAnnouncementV2Message(
                        payload,
                        event,
                        userDisplayNames,
                        {
                            forumChannelId,
                            pingRoleIds,
                            rosterImageUrl: rosterImageAttachment?.mediaUrl,
                            // Without a separate event-info room this single
                            // message is the event information card.
                            matchTeamCards: true,
                        }
                    ),
                    files: rosterImageAttachment
                        ? [rosterImageAttachment.attachment]
                        : [],
                    allowedMentions: { roles: pingRoleIds, parse: [] },
                    flags: MessageFlags.IsComponentsV2,
                },
            })
            if (result) announcementMessageId = result
            if (event.status === "concluded") announcementMessageId = undefined
        } else {
            logWarn(
                "announcement",
                "Announcement channel is unavailable or not a text channel",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                    channelId: announcementChannelId,
                }
            )
        }
    } else {
        logInfo("announcement", "Skipping announcement sync", {
            eventId: event.id,
            guildId: payload.config.guildId,
            reason: announcementChannelId
                ? "concluded-without-existing-message"
                : "announcements-channel-not-configured",
        })
    }

    const scheduledLifecycle = deriveScheduledEventLifecycle(event)
    if (payload.config.meetingChannelId) {
        try {
            const meetingChannel = await guild.channels
                .fetch(payload.config.meetingChannelId)
                .catch(() => null)
            const scheduledSyncResult = await syncScheduledDiscordEvent({
                guild,
                event,
                language: payload.config.defaultLanguage,
                meetingChannel,
                scheduledEventId,
                desiredLifecycle: scheduledLifecycle,
            })

            scheduledEventId = scheduledSyncResult.scheduledEventId
            scheduledEventStatus = scheduledSyncResult.scheduledEventStatus
            logInfo("scheduled-event", "Scheduled event sync completed", {
                eventId: event.id,
                guildId: payload.config.guildId,
                scheduledEventId,
                scheduledEventStatus,
                desiredLifecycle: scheduledLifecycle,
            })
        } catch (error) {
            logError(
                "scheduled-event",
                "Discord bot scheduled event sync failed",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                    scheduledEventId,
                    error,
                }
            )
        }
    } else if (scheduledEventId) {
        const canceled = await cancelScheduledDiscordEvent(
            guild,
            scheduledEventId
        )
        scheduledEventId = undefined
        scheduledEventStatus = canceled ? "canceled" : undefined
        logInfo(
            "scheduled-event",
            "Canceled scheduled event because meeting channel is no longer configured",
            {
                eventId: event.id,
                guildId: payload.config.guildId,
                canceled,
            }
        )
    } else {
        logInfo(
            "scheduled-event",
            "Skipping scheduled event sync because meeting channel is not configured",
            {
                eventId: event.id,
                guildId: payload.config.guildId,
            }
        )
    }

    await convex.mutation(references.updateEventSyncState, {
        secret: env.internalSecret,
        eventId: event.id as never,
        guildId: payload.config.guildId,
        announcementChannelId: displayChannelId,
        announcementMessageId,
        eventInfoMessageId,
        eventInfoMessageRenderVersion,
        scheduledEventId,
        scheduledEventStatus,
        forumChannelId,
        forumThreadId,
        infoMessageId,
        topicMessageIds,
        lastEventUpdatedAt: event.updatedAt,
        lastRosterUpdatedAt: roster?.updatedAt,
        lastConfigUpdatedAt: payload.config.updatedAt,
        lastCalendarSyncVersion: getCalendarSyncVersion(event),
        squadVoiceChannelIds,
        lastSyncedAt: new Date().toISOString(),
    })
    logInfo("event-sync", "Persisted event sync state", {
        eventId: event.id,
        guildId: payload.config.guildId,
        announcementMessageId,
        scheduledEventId,
        scheduledEventStatus,
        forumChannelId,
        infoMessageId,
        topicMessageCount: topicMessageIds.length,
    })
}
