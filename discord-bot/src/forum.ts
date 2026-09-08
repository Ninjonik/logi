import {
    ChannelType,
    EmbedBuilder,
    ForumChannel,
    MessageFlags,
} from "discord.js"

import { getClanDiscordMessages } from "../../src/lib/clan-language"

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
        config.defaultLanguage,
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
    language: ClanLanguage,
    existingTopicMessageIds: string[] = []
) {
    const messages = getClanDiscordMessages(language)
    const topicMessages: string[] = []

    for (const [index, topic] of (topicPreset?.topics ?? []).entries()) {
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
                        content: topic.attachments.length
                            ? topic.attachments.join("\n")
                            : undefined,
                        embeds: [
                            new EmbedBuilder()
                                .setTitle(topic.title)
                                .setDescription(
                                    topic.body || messages.forum.noExtraNotes
                                )
                                .setFooter({
                                    text: topic.attachments.length
                                        ? topic.attachments.join(" | ")
                                        : messages.forum.noExtraNotes,
                                }),
                        ],
                    })
                    .catch(() => null)
                topicMessages.push(starter.id)
                continue
            }
        }

        const createdPost = await forumChannel.threads.create({
            name: topic.title,
            message: {
                content: topic.attachments.length
                    ? topic.attachments.join("\n")
                    : undefined,
                embeds: [
                    new EmbedBuilder()
                        .setTitle(topic.title)
                        .setDescription(
                            topic.body || messages.forum.noExtraNotes
                        )
                        .setFooter({
                            text: topic.attachments.length
                                ? topic.attachments.join(" | ")
                                : messages.forum.noExtraNotes,
                        }),
                ],
            },
        })
        const starter = await createdPost
            .fetchStarterMessage()
            .catch(() => null)
        if (starter) {
            topicMessages.push(starter.id)
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
