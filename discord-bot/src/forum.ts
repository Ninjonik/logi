import {
    AttachmentBuilder,
    ChannelType,
    FileBuilder,
    ForumChannel,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    TextDisplayBuilder,
    type Client,
} from "discord.js"

import {
    attendanceNoticeView,
    debriefView,
    forumInfoView,
    forumTopicView,
    type ForumContext,
    type ForumEvent,
} from "../../src/domain/discord-messages/match-forum"
import {
    DISCORD_LEVEL_ZERO_ATTACHMENT_MAX_BYTES,
    DISCORD_MESSAGE_MAX_ATTACHMENTS,
    DISCORD_MESSAGE_MAX_UPLOAD_BYTES,
} from "../../src/domain/discord-sync/attachment-limits"
import {
    editPayload,
    messageKitLayoutOptions,
    messagePayload,
    renderMessageView,
    type MessageKitOptions,
} from "./ui/message-kit"
import type {
    DiscordConfig,
    EventCategory,
    EventInteractionContext,
    EventRecord,
    SyncState,
    TopicPreset,
} from "./types"
import {
    eventCategory,
    eventMapLabel,
    meetingChannelOf,
    memberNames,
} from "./events/match-context"
import {
    matchForumChannelName,
    matchTitle,
} from "../../src/domain/discord-messages/match-text"
import { resolveMatchMessageSettings } from "../../src/domain/discord-messages/notification-settings"
import type { MessageView } from "../../src/domain/discord-messages/message-view"
import { footerText } from "../../src/domain/discord-messages/message-layout"
import { getRosterMessages } from "../../src/lib/clan-language/rosters"
import { getEventMessages } from "../../src/lib/clan-language/events"
import { applicationFactionEmoji } from "./runtime/faction-emoji"
import { reportClanDiscordError } from "./error-reporting"
import { convex, references } from "./convex"
import { buildPublicMatchUrl } from "./utils"
import { env } from "./environment"
import { logWarn } from "./log"

type TopicMessage = {
    body?: string
    attachments: string[]
}

type ForumChannelCandidate = {
    id: string
    name: string
    parentId: string | null
    type: ChannelType
    createdTimestamp: number
}

/** What the forum shows besides the event (Convex `discordMatchForum`). */
export type MatchForumContext = {
    stratmaps: Array<{ id: string; title: string }>
    result: { outcome: "win" | "loss" | "draw"; score: string } | null
    provider: string | null
    publicMatch: boolean
    serverId: string | null
    clanName: string | null
    category: { label: string; color: string | null } | null
}

/**
 * A Discord write can succeed even when the later sync-state write does not.
 * Reuse the oldest matching forum in that recovery case rather than creating a
 * duplicate event forum on the next sync attempt.
 */
export function findRecoverableEventForum(
    channels: Iterable<ForumChannelCandidate>,
    parentId: string,
    name: string
) {
    return [...channels]
        .filter(
            (channel) =>
                channel.type === ChannelType.GuildForum &&
                channel.parentId === parentId &&
                channel.name === name
        )
        .sort(
            (left, right) => left.createdTimestamp - right.createdTimestamp
        )[0]
}

/** The match forum's channel name, "vlk-vs-rog-11-10" (L1-127). */
export function buildMatchForumName(
    config: Pick<DiscordConfig, "timezone">,
    event: Pick<EventRecord, "name" | "matchTeams" | "gameStart">
) {
    return matchForumChannelName(
        matchTitle(event),
        event.gameStart,
        config.timezone || "UTC"
    )
}

function attachmentFilename(url: string, index: number) {
    try {
        const filename = decodeURIComponent(
            new URL(url).pathname.split("/").pop() ?? ""
        )
        if (filename) return filename.replace(/[^a-zA-Z0-9._-]/g, "-")
    } catch {
        // The URL was validated before it reached the bot. Use a safe fallback.
    }
    return `attachment-${index + 1}`
}

async function buildDiscordAttachments(message: TopicMessage) {
    if (message.attachments.length > DISCORD_MESSAGE_MAX_ATTACHMENTS) {
        throw new Error(
            `A Discord message can have at most ${DISCORD_MESSAGE_MAX_ATTACHMENTS} attachments.`
        )
    }

    const files: AttachmentBuilder[] = []
    let totalSize = 0
    for (const [index, sourceUrl] of message.attachments.entries()) {
        const response = await fetch(sourceUrl)
        if (!response.ok) {
            throw new Error(
                `Unable to download attachment (${response.status}).`
            )
        }
        const contentLength = Number(response.headers.get("content-length"))
        if (
            Number.isFinite(contentLength) &&
            contentLength > DISCORD_LEVEL_ZERO_ATTACHMENT_MAX_BYTES
        ) {
            throw new Error(
                "Attachment exceeds Discord's 20 MiB level-0 limit."
            )
        }

        const content = Buffer.from(await response.arrayBuffer())
        if (content.byteLength > DISCORD_LEVEL_ZERO_ATTACHMENT_MAX_BYTES) {
            throw new Error(
                "Attachment exceeds Discord's 20 MiB level-0 limit."
            )
        }
        totalSize += content.byteLength
        if (totalSize > DISCORD_MESSAGE_MAX_UPLOAD_BYTES) {
            throw new Error(
                "Attachments exceed Discord's 25 MiB message upload limit."
            )
        }
        files.push(
            new AttachmentBuilder(content, {
                name: attachmentFilename(sourceUrl, index),
                description: attachmentFilename(sourceUrl, index),
            })
        )
    }
    return files
}

async function sendForumMessage(
    thread: import("discord.js").ThreadChannel,
    message: TopicMessage
) {
    // Sends are deliberately sequential. discord.js queues REST routes and
    // honors Discord's 429 retry headers, preventing a large briefing burst.
    return await thread.send({
        content: message.body || undefined,
        files: await buildDiscordAttachments(message),
    })
}

const IMAGE_FILE = /\.(png|jpe?g|gif|webp)$/i

/**
 * A topic card with its attachments inside it: pictures as a gallery,
 * other files (a PDF) as file cards, then the footer. Components V2 show
 * only the files a component references.
 */
export function buildTopicMessage(
    view: MessageView,
    files: readonly { name: string }[],
    options: MessageKitOptions
) {
    const { footer, ...body } = view
    const { container } = renderMessageView(body, options)
    const images = files.filter((file) => IMAGE_FILE.test(file.name))
    const others = files.filter((file) => !IMAGE_FILE.test(file.name))
    if (images.length)
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                images
                    .slice(0, 10)
                    .map((file) =>
                        new MediaGalleryItemBuilder().setURL(
                            `attachment://${file.name}`
                        )
                    )
            )
        )
    for (const file of others)
        container.addFileComponents(
            new FileBuilder().setURL(`attachment://${file.name}`)
        )
    if (footer)
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `-# ${footerText(footer, messageKitLayoutOptions(options).copy)}`
            )
        )
    return container
}

function kitOptions(config: DiscordConfig): MessageKitOptions {
    return { language: config.defaultLanguage, style: config.messageStyle }
}

function forumContextOf(
    config: DiscordConfig,
    emoji?: ForumContext["emoji"]
): ForumContext {
    return {
        copy: getRosterMessages(config.defaultLanguage),
        timeZone: config.timezone || "UTC",
        emoji,
    }
}

function forumEventOf(
    config: DiscordConfig,
    event: EventRecord,
    categories?: readonly EventCategory[]
): ForumEvent {
    return {
        id: event.id,
        title: matchTitle(event),
        category: eventCategory(event, categories),
        teams: event.matchTeams,
        side: event.side,
        mapLabel: eventMapLabel(event, config.defaultLanguage),
        meetingStart: event.meetingStart,
        gameStart: event.gameStart,
        meetingChannelId: meetingChannelOf(event, config),
        server: event.server,
        hasPassword: Boolean(event.serverPassword?.trim()),
        notes: event.notes,
        description: event.description,
        imageUrl: event.kind === "match" ? event.imageUrl : undefined,
    }
}

export async function loadForumContext(eventId: string) {
    return (await convex
        .query(references.getMatchForumContext, {
            secret: env.internalSecret,
            eventId,
        })
        .catch(() => null)) as MatchForumContext | null
}

const infoPostNames = () => [
    ...new Set(
        (["en", "cs", "de"] as const).flatMap((language) => [
            getRosterMessages(language).forum.info,
            getEventMessages(language).forum.matchInformation,
        ])
    ),
]

const debriefPostNames = () => [
    ...new Set(
        (["en", "cs", "de"] as const).flatMap((language) => [
            getRosterMessages(language).forum.debrief,
            getEventMessages(language).forum.debrief,
        ])
    ),
]

export async function syncForumChannel(input: {
    config: DiscordConfig
    event: EventRecord
    forumCategoryId: string
    forumChannelId?: string
    guild: import("discord.js").Guild
    existingTopicMessageIds?: string[]
    topicPreset?: TopicPreset
    attendeeRoleId?: string
    reserveRoleId?: string
    /** The clan's event categories, for the category chip. */
    categories?: readonly EventCategory[]
}) {
    const {
        config,
        event,
        forumCategoryId,
        forumChannelId,
        guild,
        existingTopicMessageIds,
        topicPreset,
        attendeeRoleId,
        reserveRoleId,
    } = input
    const copy = getRosterMessages(config.defaultLanguage)
    const forumName = buildMatchForumName(config, event)
    const existingForumChannel = forumChannelId
        ? await guild.channels.fetch(forumChannelId).catch(() => null)
        : null
    const guildChannels = existingForumChannel
        ? null
        : await guild.channels.fetch().catch(() => null)
    const recoveredForumChannel = existingForumChannel
        ? null
        : findRecoverableEventForum(
              [...(guildChannels?.values() ?? [])].flatMap((channel) =>
                  channel
                      ? [
                            {
                                id: channel.id,
                                name: channel.name,
                                parentId: channel.parentId,
                                type: channel.type,
                                createdTimestamp: channel.createdTimestamp,
                            },
                        ]
                      : []
              ),
              forumCategoryId,
              forumName
          )

    let channelId = forumChannelId
    let infoMessageId: string | undefined
    let topicMessageIds: string[] = existingTopicMessageIds ?? []
    let stateChanged = false

    let forumChannel: ForumChannel | null = null
    const reusableForumChannel =
        existingForumChannel?.type === ChannelType.GuildForum
            ? existingForumChannel
            : recoveredForumChannel
    if (reusableForumChannel) {
        forumChannel = reusableForumChannel as ForumChannel
        channelId = forumChannel.id
        stateChanged ||= channelId !== forumChannelId
        if (recoveredForumChannel) {
            logWarn("forum", "Recovered an unrecorded event forum channel", {
                guildId: guild.id,
                eventId: event.id,
                forumChannelId: forumChannel.id,
                forumCategoryId,
            })
        }
        await forumChannel
            .edit({
                name: forumName,
                parent: forumCategoryId,
            })
            .catch((error) => {
                logWarn("forum", "Failed to update forum channel", {
                    guildId: guild.id,
                    forumChannelId: forumChannelId ?? reusableForumChannel.id,
                    error,
                })
                void reportClanDiscordError({
                    client: guild.client,
                    guildId: guild.id,
                    error,
                    action: `Update the forum channel for "${event.name}"`,
                    location: "Forum channels",
                    scope: "forum",
                    target: forumChannel?.name ?? forumChannelId ?? event.name,
                    details: {
                        eventId: event.id,
                        forumCategoryId,
                    },
                })
                return null
            })
    } else {
        forumChannel = (await guild.channels
            .create({
                name: forumName,
                type: ChannelType.GuildForum,
                parent: forumCategoryId,
                permissionOverwrites: [attendeeRoleId, reserveRoleId]
                    .filter((id): id is string => Boolean(id))
                    .map((id) => ({
                        id,
                        allow: [
                            "ViewChannel",
                            "SendMessages",
                            "SendMessagesInThreads",
                        ],
                    })),
            })
            .catch((error) => {
                logWarn("forum", "Failed to create forum channel", {
                    guildId: guild.id,
                    forumCategoryId,
                    error,
                })
                void reportClanDiscordError({
                    client: guild.client,
                    guildId: guild.id,
                    error,
                    action: `Create a forum channel for "${event.name}"`,
                    location: "Forum channels",
                    scope: "forum",
                    target: event.name,
                    details: {
                        eventId: event.id,
                        forumCategoryId,
                    },
                })
                return null
            })) as ForumChannel | null
        if (!forumChannel) {
            return {
                forumChannelId,
                infoMessageId,
                stateChanged,
                topicMessageIds,
            }
        }
        channelId = forumChannel.id
        stateChanged = true
    }
    if (!forumChannel) {
        return {
            forumChannelId: channelId,
            infoMessageId,
            stateChanged,
            topicMessageIds,
        }
    }

    for (const roleId of [attendeeRoleId, reserveRoleId].filter(
        (id): id is string => Boolean(id)
    )) {
        await forumChannel.permissionOverwrites
            .edit(roleId, {
                ViewChannel: true,
                SendMessages: true,
                SendMessagesInThreads: true,
            })
            .catch((error) => {
                void reportClanDiscordError({
                    client: guild.client,
                    guildId: guild.id,
                    error,
                    action: `Grant forum access for "${event.name}"`,
                    location: "Forum channels",
                    scope: "forum",
                    target: forumChannel!.name,
                    details: {
                        eventId: event.id,
                        forumChannelId: forumChannel!.id,
                        roleId,
                    },
                })
            })
    }

    const activePosts = await forumChannel.threads
        .fetchActive()
        .catch(() => null)
    const existingPosts = activePosts?.threads
        ? [...activePosts.threads.values()]
        : []
    const infoNames = infoPostNames()
    const infoPost = existingPosts.find((post) => infoNames.includes(post.name))
    const forumContext = await loadForumContext(event.id)
    const stratmaps = (event.stratmapIds ?? []).map((stratmapId) => ({
        title: forumContext?.stratmaps.find((map) => map.id === stratmapId)
            ?.title,
        url: `${env.appSiteUrl}/${config.defaultLanguage}/stratmaps/${stratmapId}`,
    }))
    const options = kitOptions(config)
    const infoView = forumInfoView({
        event: forumEventOf(config, event, input.categories),
        stratmaps,
        context: forumContextOf(
            config,
            await applicationFactionEmoji(guild.client)
        ),
    })

    if (infoPost) {
        const starter = await infoPost.fetchStarterMessage().catch(() => null)
        if (starter) {
            await starter
                .edit(editPayload(infoView, options))
                .catch((error) => {
                    logWarn(
                        "forum",
                        "Failed to edit forum info starter message",
                        {
                            guildId: guild.id,
                            forumChannelId: forumChannel.id,
                            threadId: infoPost.id,
                            error,
                        }
                    )
                    void reportClanDiscordError({
                        client: guild.client,
                        guildId: guild.id,
                        error,
                        action: `Update the forum info post for "${event.name}"`,
                        location: "Forum channels",
                        scope: "forum",
                        target: infoPost.name,
                        details: {
                            eventId: event.id,
                            forumChannelId: forumChannel.id,
                            threadId: infoPost.id,
                        },
                    })
                    return null
                })
            infoMessageId = starter.id
        }
    } else {
        const createdPost = await forumChannel.threads
            .create({
                name: copy.forum.info,
                message: messagePayload(infoView, options),
            })
            .catch((error) => {
                logWarn("forum", "Failed to create forum info post", {
                    guildId: guild.id,
                    forumChannelId: forumChannel.id,
                    error,
                })
                void reportClanDiscordError({
                    client: guild.client,
                    guildId: guild.id,
                    error,
                    action: `Create the forum info post for "${event.name}"`,
                    location: "Forum channels",
                    scope: "forum",
                    target: forumChannel.name,
                    details: {
                        eventId: event.id,
                        forumChannelId: forumChannel.id,
                    },
                })
                return null
            })
        if (!createdPost) {
            return {
                forumChannelId: channelId,
                infoMessageId,
                stateChanged,
                topicMessageIds,
            }
        }
        const starter = await createdPost
            .fetchStarterMessage()
            .catch(() => null)
        infoMessageId = starter?.id
        stateChanged = true
    }

    const syncedTopicMessageIds = await ensureForumTopicPosts(
        forumChannel,
        topicPreset,
        topicMessageIds,
        config
    )
    if (syncedTopicMessageIds.join(",") !== topicMessageIds.join(",")) {
        stateChanged = true
    }
    topicMessageIds = syncedTopicMessageIds

    if (event.status === "concluded") {
        await finalizeForumAfterConclusion(forumChannel, event, config, {
            categories: input.categories,
            forumContext,
        })
    }

    return {
        forumChannelId: channelId,
        infoMessageId,
        stateChanged,
        topicMessageIds,
    }
}

/** A topic's first message as the clan card with its attachments. */
async function topicMessage(
    topic: TopicPreset["topics"][number],
    first: TopicMessage,
    presetName: string | undefined,
    config: DiscordConfig
) {
    const files = await buildDiscordAttachments(first)
    const options = kitOptions(config)
    const container = buildTopicMessage(
        forumTopicView({
            title: topic.title,
            body: first.body,
            presetName,
            copy: getRosterMessages(config.defaultLanguage),
        }),
        files.map((file) => ({ name: file.name ?? "" })),
        options
    )
    return {
        components: [container],
        files,
        flags: MessageFlags.IsComponentsV2 as const,
        allowedMentions: { parse: [] as never[] },
    }
}

export async function ensureForumTopicPosts(
    forumChannel: ForumChannel,
    topicPreset: TopicPreset | undefined,
    existingTopicMessageIds: string[] = [],
    config?: DiscordConfig
) {
    const topicMessages: string[] = []

    for (const [index, topic] of (topicPreset?.topics ?? []).entries()) {
        const messageBlocks = topic.messages?.length
            ? topic.messages
            : [
                  {
                      id: topic.id ?? `legacy-${index}`,
                      body: topic.body,
                      attachments: topic.attachments,
                  },
              ]
        const firstMessage = messageBlocks[0]
        if (!firstMessage) continue
        const existingTopicId = existingTopicMessageIds[index]
        const existingThread = existingTopicId
            ? await forumChannel.threads
                  .fetch(existingTopicId)
                  .catch(() => null)
            : null
        if (existingThread) {
            await existingThread.edit({ name: topic.title }).catch(() => null)
            const starter = await existingThread
                .fetchStarterMessage()
                .catch(() => null)
            if (starter) {
                const card = config
                    ? await topicMessage(
                          topic,
                          firstMessage,
                          topicPreset?.name,
                          config
                      )
                    : null
                await starter
                    .edit(
                        card
                            ? {
                                  content: null,
                                  embeds: [],
                                  attachments: [],
                                  ...card,
                              }
                            : {
                                  content: firstMessage.body || undefined,
                                  attachments: [],
                                  files: await buildDiscordAttachments(
                                      firstMessage
                                  ),
                                  embeds: [],
                              }
                    )
                    .catch(() => null)
                topicMessages.push(starter.id)
                continue
            }
        }

        const createdPost = await forumChannel.threads.create({
            name: topic.title,
            message: config
                ? await topicMessage(
                      topic,
                      firstMessage,
                      topicPreset?.name,
                      config
                  )
                : {
                      content: firstMessage.body || undefined,
                      files: await buildDiscordAttachments(firstMessage),
                  },
        })
        const starter = await createdPost
            .fetchStarterMessage()
            .catch(() => null)
        if (starter) {
            topicMessages.push(starter.id)
        }
        for (const message of messageBlocks.slice(1)) {
            await sendForumMessage(createdPost, message)
        }
    }

    for (const staleTopicId of existingTopicMessageIds.slice(
        topicMessages.length
    )) {
        const staleThread = await forumChannel.threads
            .fetch(staleTopicId)
            .catch(() => null)
        await staleThread
            ?.delete("Topic template was resynchronized")
            .catch(() => null)
    }

    return topicMessages
}

/**
 * After the match: the Debrief post, pinned so it stays on top, as the clan
 * card. Every later sync edits it, so the confirmed result and the match
 * link appear once the leaders confirm the result (L1-137).
 */
export async function finalizeForumAfterConclusion(
    forumChannel: ForumChannel,
    event: EventRecord,
    config: DiscordConfig,
    extra: {
        categories?: readonly EventCategory[]
        forumContext?: MatchForumContext | null
    } = {}
) {
    const copy = getRosterMessages(config.defaultLanguage)
    const activePosts = await forumChannel.threads
        .fetchActive()
        .catch(() => null)
    const existingPosts = activePosts?.threads
        ? [...activePosts.threads.values()]
        : []
    const names = debriefPostNames()
    const forumContext =
        extra.forumContext === undefined
            ? await loadForumContext(event.id)
            : extra.forumContext
    const view = debriefView({
        event: forumEventOf(config, event, extra.categories),
        result: forumContext?.result
            ? {
                  ...forumContext.result,
                  matchUrl: forumContext.publicMatch
                      ? buildPublicMatchUrl(event.id, config.defaultLanguage)
                      : undefined,
              }
            : null,
        context: forumContextOf(config),
    })
    const options = kitOptions(config)

    let debriefPost = existingPosts.find((post) => names.includes(post.name))
    if (debriefPost) {
        const starter = await debriefPost
            .fetchStarterMessage()
            .catch(() => null)
        await starter?.edit(editPayload(view, options)).catch((error) =>
            logWarn("forum", "Failed to edit the debrief post", {
                eventId: event.id,
                threadId: debriefPost?.id,
                error,
            })
        )
    } else {
        debriefPost = await forumChannel.threads.create({
            name: copy.forum.debrief,
            message: messagePayload(view, options),
        })
    }

    for (const post of [...existingPosts, debriefPost]) {
        if ("setPinned" in post && typeof post.setPinned === "function") {
            await post.setPinned(post.id === debriefPost.id).catch(() => null)
        }
    }
}

/**
 * The optional attendance post in the match thread (board L5-43, N1-15):
 * after "Přijdu později", "Nemůžu" or /notice, when the clan turned it on,
 * the match's "Informace o zápasu" thread gets who is late or not coming,
 * with their place and never the reason. Failures are logged only: the
 * player's own reply never depends on it.
 */
export async function postAttendanceNotice(
    client: Client,
    input: {
        context: Pick<EventInteractionContext, "config" | "event" | "roster">
        userId: string
        kind: "late" | "absent"
    }
) {
    const { config, event, roster } = input.context
    if (!resolveMatchMessageSettings(config).attendanceNoticesInThread) return
    try {
        const sync = (await convex.query(references.getEventSyncContext, {
            secret: env.internalSecret,
            eventId: event.id as never,
        })) as { syncState: SyncState | null } | null
        // A forum post's thread has the ID of its starter message.
        const threadId = sync?.syncState?.infoMessageId
        if (!threadId) return
        const thread = await client.channels.fetch(threadId).catch(() => null)
        if (!thread?.isThread()) return
        const guild = await client.guilds.fetch(event.guildId).catch(() => null)
        const names = await memberNames(guild, [input.userId])
        const user = names[input.userId]
            ? null
            : await client.users.fetch(input.userId).catch(() => null)
        const name =
            names[input.userId] ?? user?.globalName ?? user?.username ?? null
        // Never an ID in a public post: without a name there is no post.
        if (!name) return
        const squad = roster?.squads.find((item) =>
            item.players.some((player) => player.id === input.userId)
        )
        const role = squad?.players
            .find((player) => player.id === input.userId)
            ?.roleName?.trim()
        const forumContext = await loadForumContext(event.id)
        const language = config.defaultLanguage
        const attendanceUrl = forumContext?.serverId
            ? new URL(
                  `/${language}/dashboard/servers/${forumContext.serverId}/${event.kind === "training" ? "events" : "matches"}/${event.id}?tab=attendance`,
                  env.appSiteUrl
              ).toString()
            : undefined
        await thread.send(
            messagePayload(
                attendanceNoticeView({
                    kind: input.kind,
                    name,
                    event: {
                        title: matchTitle(event),
                        gameStart: event.gameStart,
                    },
                    place: squad
                        ? { squad: squad.name, ...(role ? { role } : {}) }
                        : undefined,
                    attendanceUrl,
                    context: forumContextOf(config),
                }),
                kitOptions(config)
            )
        )
    } catch (error) {
        logWarn("forum", "Failed to post an attendance notice", {
            eventId: event.id,
            guildId: event.guildId,
            error,
        })
    }
}
