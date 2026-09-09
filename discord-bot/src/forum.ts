import {
    AttachmentBuilder,
    ChannelType,
    EmbedBuilder,
    ForumChannel,
    MessageFlags,
} from "discord.js"

import { getClanDiscordMessages } from "../../src/lib/clan-language"

import {
    DISCORD_LEVEL_ZERO_ATTACHMENT_MAX_BYTES,
    DISCORD_MESSAGE_MAX_ATTACHMENTS,
    DISCORD_MESSAGE_MAX_UPLOAD_BYTES,
} from "../../src/domain/discord-sync/attachment-limits"
import {
    buildForumInfoEmbed,
    buildForumInfoV2Message,
    buildForumThreadName,
} from "./message-builders"
import type {
    ClanLanguage,
    DiscordConfig,
    EventRecord,
    TopicPreset,
} from "./types"
import { reportClanDiscordError } from "./error-reporting"
import { env } from "./environment"
import { logWarn } from "./log"

type TopicMessage = {
    body?: string
    attachments: string[]
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
    const messages = getClanDiscordMessages(config.defaultLanguage)
    const existingForumChannel = forumChannelId
        ? await guild.channels.fetch(forumChannelId).catch(() => null)
        : null

    let channelId = forumChannelId
    let infoMessageId: string | undefined
    let topicMessageIds: string[] = existingTopicMessageIds ?? []
    let stateChanged = false

    let forumChannel: ForumChannel | null = null
    if (existingForumChannel?.type === ChannelType.GuildForum) {
        forumChannel = existingForumChannel as ForumChannel
        await forumChannel
            .edit({
                name: buildForumThreadName(config, event),
                parent: forumCategoryId,
            })
            .catch((error) => {
                logWarn("forum", "Failed to update forum channel", {
                    guildId: guild.id,
                    forumChannelId: forumChannelId ?? existingForumChannel.id,
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
                name: buildForumThreadName(config, event),
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
    const infoPostNames = [
        messages.forum.matchInformation,
        getClanDiscordMessages("en").forum.matchInformation,
        getClanDiscordMessages("cs").forum.matchInformation,
        getClanDiscordMessages("de").forum.matchInformation,
    ]
    const infoPost = existingPosts.find((post) =>
        infoPostNames.includes(post.name)
    )
    const stratmapLinks = (event.stratmapIds ?? []).map(
        (stratmapId) =>
            `${env.appSiteUrl}/${config.defaultLanguage}/stratmaps/${stratmapId}`
    )
    const infoEmbed = buildForumInfoEmbed(config, event, stratmapLinks)
    const infoV2Message = buildForumInfoV2Message(config, event, stratmapLinks)

    if (infoPost) {
        const starter = await infoPost.fetchStarterMessage().catch(() => null)
        if (starter) {
            await starter
                .edit(
                    starter.flags.has(MessageFlags.IsComponentsV2)
                        ? infoV2Message
                        : { embeds: [infoEmbed] }
                )
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
                name: messages.forum.matchInformation,
                message: {
                    ...infoV2Message,
                    flags: MessageFlags.IsComponentsV2,
                },
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
        topicMessageIds
    )
    if (syncedTopicMessageIds.join(",") !== topicMessageIds.join(",")) {
        stateChanged = true
    }
    topicMessageIds = syncedTopicMessageIds

    if (event.status === "concluded") {
        await finalizeForumAfterConclusion(
            forumChannel,
            event,
            config.defaultLanguage
        )
    }

    return {
        forumChannelId: channelId,
        infoMessageId,
        stateChanged,
        topicMessageIds,
    }
}

export async function ensureForumTopicPosts(
    forumChannel: ForumChannel,
    topicPreset: TopicPreset | undefined,
    existingTopicMessageIds: string[] = []
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
                await starter
                    .edit({
                        content: firstMessage.body || undefined,
                        attachments: [],
                        files: await buildDiscordAttachments(firstMessage),
                        embeds: [],
                    })
                    .catch(() => null)
                topicMessages.push(starter.id)
                continue
            }
        }

        const createdPost = await forumChannel.threads.create({
            name: topic.title,
            message: {
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

export async function finalizeForumAfterConclusion(
    forumChannel: ForumChannel,
    event: EventRecord,
    language: ClanLanguage
) {
    const messages = getClanDiscordMessages(language)
    const activePosts = await forumChannel.threads
        .fetchActive()
        .catch(() => null)
    const existingPosts = activePosts?.threads
        ? [...activePosts.threads.values()]
        : []
    const debriefNames = [
        messages.forum.debrief,
        getClanDiscordMessages("en").forum.debrief,
        getClanDiscordMessages("cs").forum.debrief,
        getClanDiscordMessages("de").forum.debrief,
    ]

    let debriefPost = existingPosts.find((post) =>
        debriefNames.includes(post.name)
    )
    if (!debriefPost) {
        debriefPost = await forumChannel.threads.create({
            name: messages.forum.debrief,
            message: {
                embeds: [
                    new EmbedBuilder()
                        .setTitle(
                            `${messages.forum.debriefTitle}: ${event.name}`
                        )
                        .setDescription(messages.forum.debriefDescription),
                ],
            },
        })
    }

    for (const post of [...existingPosts, debriefPost]) {
        if ("setPinned" in post && typeof post.setPinned === "function") {
            await post.setPinned(post.id === debriefPost.id).catch(() => null)
        }
    }
}
