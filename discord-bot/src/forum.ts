import { ChannelType, EmbedBuilder, ForumChannel } from "discord.js";

import { getClanDiscordMessages } from "../../src/lib/clan-language";

import { buildForumInfoEmbed, buildForumThreadName } from "./message-builders";
import type { ClanLanguage, DiscordConfig, EventRecord, TopicPreset } from "./types";

export async function syncForumChannel(input: {
  config: DiscordConfig;
  event: EventRecord;
  forumCategoryId: string;
  forumChannelId?: string;
  guild: import("discord.js").Guild;
  existingTopicMessageIds?: string[];
  topicPreset?: TopicPreset;
}) {
  const { config, event, forumCategoryId, forumChannelId, guild, existingTopicMessageIds, topicPreset } = input;
  const messages = getClanDiscordMessages(config.defaultLanguage);
  const existingForumChannel = forumChannelId
    ? await guild.channels.fetch(forumChannelId).catch(() => null)
    : null;

  let channelId = forumChannelId;
  let infoMessageId: string | undefined;
  let topicMessageIds: string[] = existingTopicMessageIds ?? [];
  let stateChanged = false;

  let forumChannel: ForumChannel;
  if (existingForumChannel?.type === ChannelType.GuildForum) {
    forumChannel = existingForumChannel as ForumChannel;
    await forumChannel.edit({
      name: buildForumThreadName(config, event),
      parent: forumCategoryId,
    });
  } else {
    forumChannel = (await guild.channels.create({
      name: buildForumThreadName(config, event),
      type: ChannelType.GuildForum,
      parent: forumCategoryId,
    })) as ForumChannel;
    channelId = forumChannel.id;
    stateChanged = true;
  }

  const activePosts = await forumChannel.threads.fetchActive().catch(() => null);
  const existingPosts = activePosts?.threads ? [...activePosts.threads.values()] : [];
  const infoPostNames = [
    messages.forum.matchInformation,
    getClanDiscordMessages("en").forum.matchInformation,
    getClanDiscordMessages("cs").forum.matchInformation,
  ];
  const infoPost = existingPosts.find((post) => infoPostNames.includes(post.name));
  const infoEmbed = buildForumInfoEmbed(config, event);

  if (infoPost) {
    const starter = await infoPost.fetchStarterMessage().catch(() => null);
    if (starter) {
      await starter.edit({ embeds: [infoEmbed] });
      infoMessageId = starter.id;
    }
  } else {
    const createdPost = await forumChannel.threads.create({
      name: messages.forum.matchInformation,
      message: { embeds: [infoEmbed] },
    });
    const starter = await createdPost.fetchStarterMessage().catch(() => null);
    infoMessageId = starter?.id;
    stateChanged = true;
  }

  if (!topicMessageIds.length) {
    topicMessageIds = await ensureForumTopicPosts(forumChannel, topicPreset, config.defaultLanguage);
  }
  if (topicMessageIds.length > 0 && !existingTopicMessageIds?.length) {
    stateChanged = true;
  }

  if (event.status === "concluded") {
    await finalizeForumAfterConclusion(forumChannel, event, config.defaultLanguage);
  }

  return {
    forumChannelId: channelId,
    infoMessageId,
    stateChanged,
    topicMessageIds,
  };
}

export async function ensureForumTopicPosts(
  forumChannel: ForumChannel,
  topicPreset: TopicPreset | undefined,
  language: ClanLanguage,
) {
  const messages = getClanDiscordMessages(language);
  const topicMessages: string[] = [];

  for (const topic of topicPreset?.topics ?? []) {
    const createdPost = await forumChannel.threads.create({
      name: topic.title,
      message: {
        content: topic.attachments.length ? topic.attachments.join("\n") : undefined,
        embeds: [
          new EmbedBuilder()
            .setTitle(topic.title)
            .setDescription(topic.body || messages.forum.noExtraNotes)
            .setFooter({
              text: topic.attachments.length ? topic.attachments.join(" | ") : messages.forum.noExtraNotes,
            }),
        ],
      },
    });
    const starter = await createdPost.fetchStarterMessage().catch(() => null);
    if (starter) {
      topicMessages.push(starter.id);
    }
  }

  return topicMessages;
}

export async function finalizeForumAfterConclusion(
  forumChannel: ForumChannel,
  event: EventRecord,
  language: ClanLanguage,
) {
  const messages = getClanDiscordMessages(language);
  const activePosts = await forumChannel.threads.fetchActive().catch(() => null);
  const existingPosts = activePosts?.threads ? [...activePosts.threads.values()] : [];
  const debriefNames = [
    messages.forum.debrief,
    getClanDiscordMessages("en").forum.debrief,
    getClanDiscordMessages("cs").forum.debrief,
  ];

  let debriefPost = existingPosts.find((post) => debriefNames.includes(post.name));
  if (!debriefPost) {
    debriefPost = await forumChannel.threads.create({
      name: messages.forum.debrief,
      message: {
        embeds: [
          new EmbedBuilder()
            .setTitle(`${messages.forum.debriefTitle}: ${event.name}`)
            .setDescription(messages.forum.debriefDescription),
        ],
      },
    });
  }

  for (const post of [...existingPosts, debriefPost]) {
    if ("setPinned" in post && typeof post.setPinned === "function") {
      await post.setPinned(post.id === debriefPost.id).catch(() => null);
    }
  }
}
