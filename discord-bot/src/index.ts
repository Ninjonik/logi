import "dotenv/config";

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChannelType,
  Client,
  EmbedBuilder,
  Events,
  ForumChannel,
  GatewayIntentBits,
  GuildMember,
  TextChannel,
} from "discord.js";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

type DiscordConfig = {
  id: string;
  guildId: string;
  timezone: string;
  announcementsChannelId?: string;
  forumChannelId?: string;
  clanRoleId?: string;
  dashboardAdminRoleId?: string;
  groupLinks: Array<{
    groupId: string;
    roleId?: string;
    emoji?: string;
  }>;
  updatedAt: string;
};

type Group = {
  id: string;
  name: string;
  color: string;
};

type TopicPreset = {
  id: string;
  name: string;
  topics: Array<{
    title: string;
    body?: string;
    attachments: string[];
  }>;
};

type EventRecord = {
  id: string;
  guildId: string;
  name: string;
  description?: string;
  server?: string;
  serverPassword?: string;
  side?: string;
  map?: string;
  cap?: string;
  notes?: string;
  registrationEnd: string;
  meetingStart: string;
  gameStart: string;
  gameEnd: string;
  pingClan: boolean;
  topicPresetId?: string;
  signUps: Array<{
    userId: string;
    group?: string | null;
  }>;
  updatedAt: string;
};

type SyncState = {
  id: string;
  eventId: string;
  guildId: string;
  announcementChannelId?: string;
  announcementMessageId?: string;
  forumChannelId?: string;
  forumThreadId?: string;
  infoMessageId?: string;
  topicMessageIds: string[];
  lastSyncedAt?: string;
  lastEventUpdatedAt?: string;
  lastConfigUpdatedAt?: string;
};

type SyncPayload = {
  config: DiscordConfig;
  groups: Group[];
  events: EventRecord[];
  topicPresets: TopicPreset[];
  syncStates: SyncState[];
};

const SIGNUP_NOT_ATTENDING = "NOT_ATTENDING";

const listSyncPayloadsReference = makeFunctionReference<"query">("discord:listSyncPayloads");
const updateEventSyncStateReference = makeFunctionReference<"mutation">("discord:updateEventSyncState");
const getEventSignupContextReference = makeFunctionReference<"query">("discord:getEventSignupContext");
const toggleSignUpReference = makeFunctionReference<"mutation">("events:toggleSignUp");
const syncMemberAccessReference = makeFunctionReference<"mutation">("discord:syncMemberAccess");

const convexUrl =
  process.env.NEXT_PUBLIC_CONVEX_URL ??
  process.env.CONVEX_SELF_HOSTED_URL ??
  process.env.CONVEX_URL;
const internalSecret = process.env.INTERNAL_AUTH_SECRET;
const botToken = process.env.DISCORD_BOT_TOKEN;

if (!convexUrl || !internalSecret || !botToken) {
  throw new Error("Missing NEXT_PUBLIC_CONVEX_URL/CONVEX_SELF_HOSTED_URL, INTERNAL_AUTH_SECRET, or DISCORD_BOT_TOKEN.");
}

const convex = new ConvexHttpClient(convexUrl);
const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers],
});

const queuedEventIds = new Set<string>();
let isSyncing = false;

client.once(Events.ClientReady, async (readyClient) => {
  console.log(`Discord bot ready as ${readyClient.user.tag}`);
  void pollLoop();
  setInterval(() => {
    void pollLoop();
  }, 15000);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isButton()) return;
  if (!interaction.customId.startsWith("signup:")) return;

  await handleSignupInteraction(interaction);
});

async function pollLoop() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    const payloads = (await convex.query(listSyncPayloadsReference, {
      secret: internalSecret,
    })) as SyncPayload[];

    for (const payload of payloads) {
      await syncGuildPayload(payload);
    }
  } catch (error) {
    console.error("Discord bot sync loop failed", error);
  } finally {
    isSyncing = false;
  }
}

async function syncGuildPayload(payload: SyncPayload) {
  await syncGuildMemberAccess(payload);

  for (const event of payload.events) {
    const state = payload.syncStates.find((item) => item.eventId === event.id);
    const needsSync =
      !state ||
      state.lastEventUpdatedAt !== event.updatedAt ||
      state.lastConfigUpdatedAt !== payload.config.updatedAt ||
      queuedEventIds.has(event.id);

    if (!needsSync) continue;
    await syncEvent(payload, event, state);
    queuedEventIds.delete(event.id);
  }
}

async function syncGuildMemberAccess(payload: SyncPayload) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) return;

  const members = await guild.members.fetch().catch(() => null);
  if (!members) return;

  await convex.mutation(syncMemberAccessReference, {
    secret: internalSecret,
    guildId: payload.config.guildId,
    members: members.map((member) => {
      const roleIds = [...member.roles.cache.keys()].filter((roleId) => roleId !== guild.id);
      const isAdmin = member.permissions.has("Administrator");
      const hasDashboardAccess =
        isAdmin ||
        (payload.config.dashboardAdminRoleId ? roleIds.includes(payload.config.dashboardAdminRoleId) : false);

      return {
        userId: member.id,
        roleIds,
        isAdmin,
        hasDashboardAccess,
      };
    }),
  });
}

async function syncEvent(payload: SyncPayload, event: EventRecord, state?: SyncState) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) return;

  let announcementMessageId = state?.announcementMessageId;
  let forumThreadId = state?.forumThreadId;
  let infoMessageId = state?.infoMessageId;
  let topicMessageIds = state?.topicMessageIds ?? [];

  if (payload.config.announcementsChannelId) {
    const channel = await guild.channels.fetch(payload.config.announcementsChannelId).catch(() => null);
    if (channel?.isTextBased() && channel.type === ChannelType.GuildText) {
      const textChannel = channel as TextChannel;
      const { embed, components } = buildAnnouncementMessage(payload, event);
      const existingMessage = announcementMessageId
        ? await textChannel.messages.fetch(announcementMessageId).catch(() => null)
        : null;

      if (existingMessage) {
        await existingMessage.edit({ embeds: [embed], components });
      } else {
        const created = await textChannel.send({ embeds: [embed], components });
        announcementMessageId = created.id;
      }
    }
  }

  if (payload.config.forumChannelId) {
    const channel = await guild.channels.fetch(payload.config.forumChannelId).catch(() => null);
    if (channel?.type === ChannelType.GuildForum) {
      const forumChannel = channel as ForumChannel;
      const topicPreset = payload.topicPresets.find((preset) => preset.id === event.topicPresetId);
      const thread = forumThreadId
        ? await guild.channels.fetch(forumThreadId).catch(() => null)
        : null;
      const infoEmbed = buildForumInfoEmbed(payload.config, event);

      if (thread?.isThread()) {
        await thread.edit({ name: buildForumThreadName(payload.config, event) });
        const starter = await thread.fetchStarterMessage().catch(() => null);
        if (starter) {
          await starter.edit({ embeds: [infoEmbed] });
          infoMessageId = starter.id;
        }
        if (!topicMessageIds.length) {
          topicMessageIds = await ensureTopicMessages(thread, topicPreset);
        }
      } else {
        const created = await forumChannel.threads.create({
          name: buildForumThreadName(payload.config, event),
          message: {
            embeds: [infoEmbed],
          },
        });
        forumThreadId = created.id;
        const starter = await created.fetchStarterMessage().catch(() => null);
        infoMessageId = starter?.id;
        topicMessageIds = await ensureTopicMessages(created, topicPreset);
      }
    }
  }

  await convex.mutation(updateEventSyncStateReference, {
    secret: internalSecret,
    eventId: event.id as never,
    guildId: payload.config.guildId,
    announcementChannelId: payload.config.announcementsChannelId,
    announcementMessageId,
    forumChannelId: payload.config.forumChannelId,
    forumThreadId,
    infoMessageId,
    topicMessageIds,
    lastEventUpdatedAt: event.updatedAt,
    lastConfigUpdatedAt: payload.config.updatedAt,
    lastSyncedAt: new Date().toISOString(),
  });
}

async function ensureTopicMessages(thread: any, topicPreset?: TopicPreset) {
  const topicMessages: string[] = [];
  const matchInformation = await thread.send({
    embeds: [
      new EmbedBuilder()
        .setTitle("Match information")
        .setDescription("This channel stays in sync with the dashboard event settings."),
    ],
  });
  topicMessages.push(matchInformation.id);

  for (const topic of topicPreset?.topics ?? []) {
    const message = await thread.send({
      embeds: [
        new EmbedBuilder()
          .setTitle(topic.title)
          .setDescription(topic.body || "No extra notes yet.")
          .setFooter({
            text: topic.attachments.length ? topic.attachments.join(" | ") : "No attachments",
          }),
      ],
    });
    topicMessages.push(message.id);
  }

  return topicMessages;
}

async function handleSignupInteraction(interaction: ButtonInteraction) {
  const [, eventId, encodedGroupId] = interaction.customId.split(":");
  const groupId = decodeURIComponent(encodedGroupId);

  const context = (await convex.query(getEventSignupContextReference, {
    secret: internalSecret,
    guildId: interaction.guildId!,
    eventId: eventId as never,
  })) as { config: DiscordConfig; event: EventRecord; groups: Group[] } | null;

  if (!context || !interaction.guildId) {
    await interaction.reply({ content: "Unable to load event context.", ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember | null;
  const selectedGroup = groupId === SIGNUP_NOT_ATTENDING ? null : context.groups.find((group) => group.id === groupId);
  if (!selectedGroup && groupId !== SIGNUP_NOT_ATTENDING) {
    await interaction.reply({ content: "That signup button is no longer valid.", ephemeral: true });
    return;
  }
  if (!member) {
    await interaction.reply({ content: "Unable to resolve your server membership.", ephemeral: true });
    return;
  }

  const roleLink = context.config.groupLinks.find((link) => link.groupId === groupId);
  if (selectedGroup && roleLink?.roleId && !member.roles.cache.has(roleLink.roleId)) {
    await interaction.reply({ content: "You do not have the required Discord role for this signup.", ephemeral: true });
    return;
  }

  await convex.mutation(toggleSignUpReference, {
    secret: internalSecret,
    eventId: eventId as never,
    userId: interaction.user.id,
    group: selectedGroup ? selectedGroup.name : SIGNUP_NOT_ATTENDING,
  });

  queuedEventIds.add(eventId);
  setTimeout(() => {
    void pollLoop();
  }, 5000);

  await interaction.reply({
    content: selectedGroup
      ? `Signup updated to ${selectedGroup.name}.`
      : "Marked as not attending.",
    ephemeral: true,
  });
}

function buildAnnouncementMessage(payload: SyncPayload, event: EventRecord) {
  const embed = buildEventEmbed(payload.config, payload.groups, event);
  const signupButtons = buildSignupButtons(payload.config, payload.groups, event.id);
  return { embed, components: signupButtons };
}

function buildEventEmbed(config: DiscordConfig, groups: Group[], event: EventRecord) {
  const signupsByGroup = new Map<string, string[]>();
  for (const signUp of event.signUps) {
    const key = signUp.group ?? SIGNUP_NOT_ATTENDING;
    const list = signupsByGroup.get(key) ?? [];
    list.push(`<@${signUp.userId}>`);
    signupsByGroup.set(key, list);
  }

  const fields = [
    { name: "Map", value: event.map ?? "Not set", inline: true },
    { name: "Side", value: event.side ?? "Not set", inline: true },
    { name: "Start", value: formatInTimezone(event.gameStart, config.timezone), inline: true },
    { name: "Meeting", value: formatInTimezone(event.meetingStart, config.timezone), inline: true },
    { name: "Registration", value: formatInTimezone(event.registrationEnd, config.timezone), inline: true },
  ];

  for (const group of groups) {
    const members = signupsByGroup.get(group.name) ?? [];
    fields.push({
      name: group.name,
      value: members.length ? members.join("\n") : "No signups yet",
      inline: false,
    });
  }

  fields.push({
    name: "Not attending",
    value: (signupsByGroup.get(SIGNUP_NOT_ATTENDING) ?? []).join("\n") || "Nobody yet",
    inline: false,
  });

  return new EmbedBuilder()
    .setTitle(event.name)
    .setDescription(event.description || "Operation briefing from Logi.")
    .addFields(fields)
    .setFooter({ text: `Timezone: ${config.timezone}` });
}

function buildForumInfoEmbed(config: DiscordConfig, event: EventRecord) {
  return new EmbedBuilder()
    .setTitle(event.name)
    .setDescription(event.notes || event.description || "Match information")
    .addFields(
      { name: "Map", value: event.map ?? "Not set", inline: true },
      { name: "Side", value: event.side ?? "Not set", inline: true },
      { name: "Cap", value: event.cap ?? "Not set", inline: true },
      { name: "Server", value: event.server ?? "Not set", inline: true },
      { name: "Server password", value: event.serverPassword ?? "Not set", inline: true },
      { name: "Game start", value: formatInTimezone(event.gameStart, config.timezone), inline: true },
    )
    .setFooter({ text: `Managed from Logi in ${config.timezone}` });
}

function buildForumThreadName(config: DiscordConfig, event: EventRecord) {
  return `${event.name} ${formatShortDate(event.gameStart, config.timezone)}`.slice(0, 100);
}

function buildSignupButtons(config: DiscordConfig, groups: Group[], eventId: string) {
  const allButtons = [
    ...groups.map((group) => {
      const link = config.groupLinks.find((item) => item.groupId === group.id);
      const button = new ButtonBuilder()
        .setCustomId(`signup:${eventId}:${encodeURIComponent(group.id)}`)
        .setStyle(pickButtonStyle(group.color));
      if (link?.emoji) {
        button.setEmoji(link.emoji);
      } else {
        button.setLabel(group.name.slice(0, 20));
      }
      return button;
    }),
    new ButtonBuilder()
      .setCustomId(`signup:${eventId}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}`)
      .setStyle(ButtonStyle.Secondary)
      .setLabel("NA"),
  ];

  const rows: Array<ActionRowBuilder<ButtonBuilder>> = [];
  for (let index = 0; index < allButtons.length; index += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(allButtons.slice(index, index + 5)));
  }
  return rows;
}

function pickButtonStyle(color: string) {
  const normalized = color.toLowerCase();
  if (normalized.includes("dc2626") || normalized.includes("ef4444")) return ButtonStyle.Danger;
  if (normalized.includes("16a34a") || normalized.includes("22c55e")) return ButtonStyle.Success;
  if (normalized.includes("2563eb") || normalized.includes("0f766e")) return ButtonStyle.Primary;
  return ButtonStyle.Secondary;
}

function formatInTimezone(timestamp: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatShortDate(timestamp: string, timezone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(timestamp))
    .replace(/\//g, "-");
}

void client.login(botToken);
