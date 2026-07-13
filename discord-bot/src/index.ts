import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

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
  GuildBasedChannel,
  GuildMember,
  TextChannel,
} from "discord.js";
import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { getClanDiscordMessages, getIntlLocaleForClanLanguage } from "../../src/lib/clan-language";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");

dotenv.config({ path: path.join(repoRoot, ".env.local") });
dotenv.config();

type DiscordConfig = {
  id: string;
  guildId: string;
  timezone: string;
  defaultLanguage: "en" | "cs";
  announcementsChannelId?: string;
  forumCategoryId?: string;
  meetingChannelId?: string;
  clanRoleId?: string;
  dashboardAdminRoleId?: string;
  updatedAt: string;
};

type Group = {
  id: string;
  name: string;
  color: string;
  discordRoleId?: string;
  discordEmoji?: string;
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
  status: "registration" | "closed" | "starting" | "concluded";
  statusUpdatedAt: string;
  concludedAt?: string;
  attendanceReminderLog: Array<{
    userId: string;
    offsetHours: number;
    sentAt: string;
  }>;
  signUps: Array<{
    userId: string;
    group?: string | null;
  }>;
  updatedAt: string;
};

type Roster = {
  id: string;
  eventId: string;
  published: boolean;
  updatedAt: string;
  squads: Array<{
    name: string;
    group: string;
    color: string;
    order: number;
    players: Array<{
      id?: string;
      ack: boolean;
      confirmed?: boolean;
      roleName?: string;
    }>;
  }>;
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
  lastRosterUpdatedAt?: string;
  lastConfigUpdatedAt?: string;
};

type SyncPayload = {
  config: DiscordConfig;
  groups: Group[];
  events: EventRecord[];
  rosters: Roster[];
  topicPresets: TopicPreset[];
  syncStates: SyncState[];
};

const SIGNUP_NOT_ATTENDING = "NOT_ATTENDING";
const ATTENDANCE_OFFSETS_HOURS = [24, 18, 12, 6];

const listSyncPayloadsReference = makeFunctionReference<"query">("discord:listSyncPayloads");
const updateEventSyncStateReference = makeFunctionReference<"mutation">("discord:updateEventSyncState");
const getEventSignupContextReference = makeFunctionReference<"query">("discord:getEventSignupContext");
const getEventInteractionContextReference = makeFunctionReference<"query">("discord:getEventInteractionContext");
const toggleSignUpReference = makeFunctionReference<"mutation">("events:toggleSignUp");
const reconcileStatusesReference = makeFunctionReference<"mutation">("events:reconcileStatuses");
const appendAttendanceReminderLogReference = makeFunctionReference<"mutation">("events:appendAttendanceReminderLog");
const acknowledgeAttendanceReference = makeFunctionReference<"mutation">("rosters:acknowledgeAttendance");
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
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildVoiceStates],
});
const appSiteUrl = process.env.SITE_URL ?? "http://localhost:3000";

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
  if (!interaction.customId.startsWith("signup:") && !interaction.customId.startsWith("attendance:")) return;

  await handleSignupInteraction(interaction);
});

async function pollLoop() {
  if (isSyncing) return;
  isSyncing = true;

  try {
    await convex.mutation(reconcileStatusesReference, {
      secret: internalSecret,
    });

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
  await processAttendanceReminders(payload);

  for (const event of payload.events) {
    const state = payload.syncStates.find((item) => item.eventId === event.id);
    const roster = payload.rosters.find((item) => item.eventId === event.id);
    const needsSync =
      !state ||
      state.lastEventUpdatedAt !== event.updatedAt ||
      state.lastRosterUpdatedAt !== roster?.updatedAt ||
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
        voiceChannelId: member.voice.channelId ?? undefined,
        isAdmin,
        hasDashboardAccess,
      };
    }),
  });
}

async function syncEvent(payload: SyncPayload, event: EventRecord, state?: SyncState) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) return;
  const roster = payload.rosters.find((item) => item.eventId === event.id);

  let announcementMessageId = state?.announcementMessageId;
  let forumChannelId = state?.forumChannelId;
  let forumThreadId = state?.forumThreadId;
  let infoMessageId = state?.infoMessageId;
  let topicMessageIds = state?.topicMessageIds ?? [];

  let stateNeedsMutationUpdate = false;

  if (payload.config.announcementsChannelId) {
    const channel = await guild.channels.fetch(payload.config.announcementsChannelId).catch(() => null);
    if (channel?.isTextBased() && channel.type === ChannelType.GuildText) {
      const textChannel = channel as TextChannel;
      const { embed, components } = buildAnnouncementMessage(payload, event);

      // Try to find the existing tracking message
      const existingMessage = announcementMessageId
        ? await textChannel.messages.fetch(announcementMessageId).catch(() => null)
        : null;

      if (event.status === "concluded") {
        if (existingMessage) {
          await existingMessage.delete().catch(() => null);
          announcementMessageId = undefined;
          stateNeedsMutationUpdate = true;
        }
      } else if (existingMessage) {
        await existingMessage.edit({ embeds: [embed], components });
      } else {
        const created = await textChannel.send({ embeds: [embed], components });
        announcementMessageId = created.id;
        stateNeedsMutationUpdate = true;
      }
    }
  }

  if (payload.config.forumCategoryId) {
    const messages = getClanDiscordMessages(payload.config.defaultLanguage);
    const topicPreset = payload.topicPresets.find((preset) => preset.id === event.topicPresetId);
    const existingForumChannel = forumChannelId
      ? await guild.channels.fetch(forumChannelId).catch(() => null)
      : null;
    const infoEmbed = buildForumInfoEmbed(payload.config, event);

    let forumChannel: ForumChannel | null = null;
    if (existingForumChannel?.type === ChannelType.GuildForum) {
      forumChannel = existingForumChannel as ForumChannel;
      await forumChannel.edit({
        name: buildForumThreadName(payload.config, event),
        parent: payload.config.forumCategoryId,
      });
    } else {
      forumChannel = (await guild.channels.create({
        name: buildForumThreadName(payload.config, event),
        type: ChannelType.GuildForum,
        parent: payload.config.forumCategoryId,
      })) as ForumChannel;
      forumChannelId = forumChannel.id;
      stateNeedsMutationUpdate = true;
    }

    const activePosts = await forumChannel.threads.fetchActive().catch(() => null);
    const existingPosts = activePosts?.threads ? [...activePosts.threads.values()] : [];
    const matchInformationPost = existingPosts.find((post) =>
      [messages.forum.matchInformation, getClanDiscordMessages("en").forum.matchInformation, getClanDiscordMessages("cs").forum.matchInformation].includes(post.name),
    );

    if (matchInformationPost) {
      const starter = await matchInformationPost.fetchStarterMessage().catch(() => null);
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
      stateNeedsMutationUpdate = true;
    }

    if (!topicMessageIds.length) {
      topicMessageIds = await ensureForumTopicPosts(forumChannel, topicPreset, payload.config.defaultLanguage);
      stateNeedsMutationUpdate = true;
    }

    if (event.status === "concluded") {
      await finalizeForumAfterConclusion(forumChannel, event, payload.config.defaultLanguage);
    }
  }

  // Always update Convex if something changed, OR if a new ID was generated
  // to ensure the DB knows about the Discord message identities instantly.
  await convex.mutation(updateEventSyncStateReference, {
    secret: internalSecret,
    eventId: event.id as never,
    guildId: payload.config.guildId,
    announcementChannelId: payload.config.announcementsChannelId,
    announcementMessageId,
    forumChannelId,
    forumThreadId,
    infoMessageId,
    topicMessageIds,
    lastEventUpdatedAt: event.updatedAt,
    lastRosterUpdatedAt: roster?.updatedAt,
    lastConfigUpdatedAt: payload.config.updatedAt,
    lastSyncedAt: new Date().toISOString(),
  });
}

async function ensureForumTopicPosts(forumChannel: ForumChannel, topicPreset: TopicPreset | undefined, language: "en" | "cs") {
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

async function finalizeForumAfterConclusion(forumChannel: ForumChannel, event: EventRecord, language: "en" | "cs") {
  const messages = getClanDiscordMessages(language);
  const activePosts = await forumChannel.threads.fetchActive().catch(() => null);
  const existingPosts = activePosts?.threads ? [...activePosts.threads.values()] : [];
  let debriefPost = existingPosts.find((post) =>
    [messages.forum.debrief, getClanDiscordMessages("en").forum.debrief, getClanDiscordMessages("cs").forum.debrief].includes(post.name),
  );

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

async function handleSignupInteraction(interaction: ButtonInteraction) {
  const [, eventId, encodedGroupId] = interaction.customId.split(":");
  const groupId = decodeURIComponent(encodedGroupId ?? "");

  if (interaction.customId.startsWith("attendance:")) {
    const context = (await convex.query(getEventInteractionContextReference, {
      secret: internalSecret,
      eventId: eventId as never,
    })) as { config: DiscordConfig; event: EventRecord; groups: Group[]; roster: Roster | null } | null;

    if (!context) {
      await interaction.reply({ content: getClanDiscordMessages("en").interaction.unableToLoadEventContext, ephemeral: true });
      return;
    }

    await handleAttendanceInteraction(interaction, context);
    return;
  }

  if (!interaction.guildId) {
    await interaction.reply({ content: getClanDiscordMessages("en").interaction.signupServerOnly, ephemeral: true });
    return;
  }

  const context = (await convex.query(getEventSignupContextReference, {
    secret: internalSecret,
    guildId: interaction.guildId,
    eventId: eventId as never,
  })) as { config: DiscordConfig; event: EventRecord; groups: Group[]; roster: Roster | null } | null;

  if (!context) {
    await interaction.reply({ content: getClanDiscordMessages("en").interaction.unableToLoadEventContext, ephemeral: true });
    return;
  }

  if (context.event.status !== "registration") {
    await interaction.reply({ content: getClanDiscordMessages(context.config.defaultLanguage).interaction.registrationClosed, ephemeral: true });
    return;
  }

  const member = interaction.member as GuildMember | null;
  const selectedGroup = groupId === SIGNUP_NOT_ATTENDING ? null : context.groups.find((group) => group.id === groupId);
  if (!selectedGroup && groupId !== SIGNUP_NOT_ATTENDING) {
    await interaction.reply({ content: getClanDiscordMessages(context.config.defaultLanguage).interaction.invalidSignupButton, ephemeral: true });
    return;
  }
  if (!member) {
    await interaction.reply({ content: getClanDiscordMessages(context.config.defaultLanguage).interaction.unableToResolveMembership, ephemeral: true });
    return;
  }

  if (selectedGroup && selectedGroup.discordRoleId && !member.roles.cache.has(selectedGroup.discordRoleId)) {
    await interaction.reply({ content: getClanDiscordMessages(context.config.defaultLanguage).interaction.missingRequiredRole, ephemeral: true });
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
  }, 2000);

  await interaction.reply({
    content: selectedGroup
      ? getClanDiscordMessages(context.config.defaultLanguage).interaction.signupUpdated
      : getClanDiscordMessages(context.config.defaultLanguage).interaction.markedNotAttending,
    ephemeral: true,
  });
}

async function handleAttendanceInteraction(
  interaction: ButtonInteraction,
  context: { config: DiscordConfig; event: EventRecord; groups: Group[]; roster: Roster | null },
) {
  const replyOptions = { ephemeral: Boolean(interaction.guildId) };
  const messages = getClanDiscordMessages(context.config.defaultLanguage);

  if (context.event.status !== "starting") {
    await interaction.reply({ content: messages.interaction.attendanceNotOpen, ...replyOptions });
    return;
  }

  if (!context.roster?.published) {
    await interaction.reply({ content: messages.interaction.rosterNotPublished, ...replyOptions });
    return;
  }

  const isOnRoster = context.roster.squads.some((squad) =>
    squad.players.some((player) => player.id === interaction.user.id),
  );

  if (!isOnRoster) {
    await interaction.reply({ content: messages.interaction.notOnRoster, ...replyOptions });
    return;
  }

  await convex.mutation(acknowledgeAttendanceReference, {
    eventId: context.event.id as never,
    userId: interaction.user.id,
  });
  await revalidateRosterImage(context.event.id);

  queuedEventIds.add(context.event.id);
  setTimeout(() => {
    void pollLoop();
  }, 2000);

  await interaction.reply({ content: messages.interaction.attendanceAcknowledged, ...replyOptions });
}

// Helper to generate a Google Calendar link from event times
function generateCalendarUrl(event: EventRecord, language: "en" | "cs"): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const title = encodeURIComponent(event.name);
  const messages = getClanDiscordMessages(language);

  // Format ISO strings to Google's preferred compact format (YYYYMMDDTHHmmSSZ)
  const formatTime = (isoStr: string) => new Date(isoStr).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const dates = `${formatTime(event.gameStart)}/${formatTime(event.gameEnd)}`;
  const details = encodeURIComponent(event.description || messages.calendar.fallbackDetails);
  const location = encodeURIComponent(event.server ?? messages.calendar.fallbackLocation);

  return `${base}&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

function buildAnnouncementMessage(payload: SyncPayload, event: EventRecord) {
  const roster = payload.rosters.find((item) => item.eventId === event.id);
  const embed = buildEventEmbed(payload.config, payload.groups, event, roster);
  const components = buildEventComponents(payload.config, payload.groups, event, roster);
  return { embed, components };
}

function buildEventEmbed(config: DiscordConfig, groups: Group[], event: EventRecord, roster?: Roster) {
  const messages = getClanDiscordMessages(config.defaultLanguage);
  const signupsByGroup = new Map<string, string[]>();
  for (const signUp of event.signUps) {
    const key = signUp.group ?? SIGNUP_NOT_ATTENDING;
    const list = signupsByGroup.get(key) ?? [];
    list.push(`<@${signUp.userId}>`);
    signupsByGroup.set(key, list);
  }

  // Convert your ISO strings to Unix timestamps for Discord's clean dynamic timers
  const gameStartUnix = Math.floor(new Date(event.gameStart).getTime() / 1000);
  const meetingUnix = Math.floor(new Date(event.meetingStart).getTime() / 1000);
  const regEndUnix = Math.floor(new Date(event.registrationEnd).getTime() / 1000);

  const descriptionLines: string[] = [];

  // --- Conditional Core Info ---
  if (event.map) descriptionLines.push(`**🗺️ ${messages.embed.map}:** ${event.map}`);
  if (event.side) descriptionLines.push(`**⚔️ ${messages.embed.side}:** ${event.side}`);
  if (event.cap) descriptionLines.push(`**🧢 ${messages.embed.cap}:** ${event.cap}`);
  if (event.server) descriptionLines.push(`**🖥️ ${messages.embed.server}:** ${event.server}`);
  if (event.serverPassword) descriptionLines.push(`**🔑 ${messages.embed.password}:** \`${event.serverPassword}\``);

  if (event.description || event.notes) {
    descriptionLines.push(`**📝 ${messages.embed.description}:** ${event.notes || event.description}`);
  }

  // Add a clean divider if we actually printed any details above
  if (descriptionLines.length > 0) {
    descriptionLines.push(`----------------------------------------`);
  }

  // --- Schedule (Always Included) ---
  descriptionLines.push(`**⏰ ${messages.embed.registrationEnds}:** <t:${regEndUnix}:R> (<t:${regEndUnix}:f>)`);
  descriptionLines.push(`**📢 ${messages.embed.meeting}:** <t:${meetingUnix}:t>`);
  descriptionLines.push(`**🚀 ${messages.embed.matchStart}:** <t:${gameStartUnix}:F>`);
  descriptionLines.push(`**📌 ${messages.embed.status}:** ${formatEventStatus(event.status, config.defaultLanguage)}`);

  const embed = new EmbedBuilder()
    .setTitle(`📅 ${event.name}`)
    .setDescription(descriptionLines.join("\n"))
    .setColor("#FFB000")
    .setFooter({ text: messages.embed.managedFooter });

  if (shouldShowPublishedRosterImage(event, roster)) {
    embed.setImage(buildRosterImageUrl(event.id));
  } else {
    for (const group of groups) {
      const members = signupsByGroup.get(group.name) ?? [];
      embed.addFields({
        name: `${group.discordEmoji ?? "👥"} ${group.name} (${members.length})`,
        value: members.length ? members.join(", ") : messages.embed.nobodyYet,
        inline: false,
      });
    }

    const nonAttending = signupsByGroup.get(SIGNUP_NOT_ATTENDING) ?? [];
    embed.addFields({
      name: `❌ ${messages.embed.notAttending} (${nonAttending.length})`,
      value: nonAttending.length ? nonAttending.join(", ") : messages.embed.nobodyYet,
      inline: false,
    });
  }

  return embed;
}

function buildEventComponents(config: DiscordConfig, groups: Group[], event: EventRecord, roster?: Roster) {
  const messages = getClanDiscordMessages(config.defaultLanguage);
  if (event.status === "registration") {
    return buildSignupButtons(config, groups, event.id, event);
  }

  if (event.status === "starting" && roster?.published) {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`attendance:${event.id}:ack`)
          .setStyle(ButtonStyle.Success)
          .setLabel(messages.buttons.acknowledgeAttendance),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(messages.buttons.addToCalendar)
          .setEmoji("➕")
          .setURL(generateCalendarUrl(event, config.defaultLanguage)),
      ),
    ];
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setStyle(ButtonStyle.Link)
        .setLabel(messages.buttons.addToCalendar)
        .setEmoji("➕")
        .setURL(generateCalendarUrl(event, config.defaultLanguage)),
    ),
  ];
}

function shouldShowPublishedRosterImage(event: EventRecord, roster?: Roster) {
  return Boolean(roster?.published && (event.status === "closed" || event.status === "starting"));
}

function buildSignupButtons(config: DiscordConfig, groups: Group[], eventId: string, event: EventRecord) {
  const messages = getClanDiscordMessages(config.defaultLanguage);
  const allButtons = [
    ...groups.map((group) => {
      const button = new ButtonBuilder()
        .setCustomId(`signup:${eventId}:${encodeURIComponent(group.id)}`)
        .setStyle(pickButtonStyle(group.color));
      if (group.discordEmoji) {
        button.setEmoji(group.discordEmoji);
      } else {
        button.setLabel(group.name.slice(0, 20));
      }
      return button;
    }),

    // Decline button
    new ButtonBuilder()
      .setCustomId(`signup:${eventId}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}`)
      .setStyle(ButtonStyle.Danger)
      .setLabel(messages.buttons.decline),

    // Add to Calendar Link Button
    new ButtonBuilder()
      .setStyle(ButtonStyle.Link)
      .setLabel(messages.buttons.addToCalendar)
      .setEmoji("➕")
      .setURL(generateCalendarUrl(event, config.defaultLanguage)),
  ];

  const rows: Array<ActionRowBuilder<ButtonBuilder>> = [];
  for (let index = 0; index < allButtons.length; index += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(allButtons.slice(index, index + 5)));
  }
  return rows;
}

function buildDiscordMessageLink(guildId: string, channelId?: string, messageId?: string) {
  if (!channelId) return null;
  return messageId
    ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}`
    : `https://discord.com/channels/${guildId}/${channelId}`;
}

function buildAttendanceReminderComponents(eventId: string, language: "en" | "cs") {
  const messages = getClanDiscordMessages(language);
  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`attendance:${eventId}:ack`)
        .setStyle(ButtonStyle.Success)
        .setLabel(messages.buttons.acknowledgeAttendance),
    ),
  ];
}

async function processAttendanceReminders(payload: SyncPayload) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) return;

  for (const event of payload.events) {
    if (event.status !== "starting") continue;

    const roster = payload.rosters.find((item) => item.eventId === event.id && item.published);
    if (!roster) continue;
    const syncState = payload.syncStates.find((item) => item.eventId === event.id);

    const meetingStartMs = new Date(event.meetingStart).getTime();
    if (!Number.isFinite(meetingStartMs)) continue;

    const unacknowledgedUserIds = new Set(
      roster.squads.flatMap((squad) =>
        squad.players.filter((player) => player.id && !player.ack).map((player) => player.id!),
      ),
    );

    if (!unacknowledgedUserIds.size) continue;

    const now = Date.now();
    const remindersToLog: Array<{ userId: string; offsetHours: number; sentAt: string }> = [];

    for (const offsetHours of ATTENDANCE_OFFSETS_HOURS) {
      const triggerTime = meetingStartMs - offsetHours * 60 * 60 * 1000;
      if (now < triggerTime) continue;

      for (const userId of unacknowledgedUserIds) {
        const alreadySent = event.attendanceReminderLog.some(
          (entry) => entry.userId === userId && entry.offsetHours === offsetHours,
        );
        if (alreadySent) continue;

        const user = await client.users.fetch(userId).catch(() => null);
        if (!user) continue;

        const sentAt = new Date().toISOString();
        const eventMessageUrl =
          buildDiscordMessageLink(payload.config.guildId, syncState?.announcementChannelId, syncState?.announcementMessageId) ??
          buildDiscordMessageLink(payload.config.guildId, syncState?.forumChannelId, syncState?.infoMessageId);
        const messages = getClanDiscordMessages(payload.config.defaultLanguage);
        const message = [
          `${messages.reminders.title} **${event.name}**.`,
          messages.reminders.body,
          `${messages.reminders.meeting}: <t:${Math.floor(meetingStartMs / 1000)}:F>`,
          eventMessageUrl ? `${messages.reminders.eventThread}: [${messages.reminders.openInDiscord}](${eventMessageUrl})` : null,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n");

        const components = buildAttendanceReminderComponents(event.id, payload.config.defaultLanguage);

        try {
          await user.send({ content: message, components });
        } catch {
          continue;
        }

        remindersToLog.push({ userId, offsetHours, sentAt });
      }
    }

    if (remindersToLog.length) {
      await convex.mutation(appendAttendanceReminderLogReference, {
        secret: internalSecret,
        eventId: event.id as never,
        reminders: remindersToLog,
      });
      queuedEventIds.add(event.id);
    }
  }
}

function formatEventStatus(status: EventRecord["status"], language: "en" | "cs") {
  const messages = getClanDiscordMessages(language);
  switch (status) {
    case "registration":
      return messages.statuses.registration;
    case "closed":
      return messages.statuses.closed;
    case "starting":
      return messages.statuses.starting;
    case "concluded":
      return messages.statuses.concluded;
  }
}

function buildForumInfoEmbed(config: DiscordConfig, event: EventRecord) {
  const messages = getClanDiscordMessages(config.defaultLanguage);
  return new EmbedBuilder()
    .setTitle(event.name)
    .setDescription(event.notes || event.description || messages.forum.matchInformation)
    .addFields(
      { name: messages.forum.map, value: event.map ?? messages.forum.notSet, inline: true },
      { name: messages.forum.side, value: event.side ?? messages.forum.notSet, inline: true },
      { name: messages.forum.cap, value: event.cap ?? messages.forum.notSet, inline: true },
      { name: messages.forum.server, value: event.server ?? messages.forum.notSet, inline: true },
      { name: messages.forum.serverPassword, value: event.serverPassword ?? messages.forum.notSet, inline: true },
      { name: messages.forum.gameStart, value: formatInTimezone(event.gameStart, config.timezone, config.defaultLanguage), inline: true },
    )
    .setFooter({ text: `${messages.forum.managedFooter} ${config.timezone}` });
}

function buildForumThreadName(config: DiscordConfig, event: EventRecord) {
  return `${event.name} ${formatShortDate(event.gameStart, config.timezone, config.defaultLanguage)}`.slice(0, 100);
}

function buildRosterImageUrl(eventId: string) {
  const url = new URL(`/api/discord/roster-image/${eventId}`, appSiteUrl);
  url.searchParams.set("secret", internalSecret as string);
  return url.toString();
}

async function revalidateRosterImage(eventId: string) {
  await fetch(new URL("/api/cache/roster-image", appSiteUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventId, secret: internalSecret }),
  }).catch(() => null);
}

function pickButtonStyle(color: string) {
  // Clean the hex string (remove '#' if present)
  const hex = color.replace(/^#/, "").trim();

  // Parse RGB components
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  // Fallback to Secondary if the hex string isn't valid
  if (isNaN(r) || isNaN(g) || isNaN(b)) {
    return ButtonStyle.Secondary;
  }

  // Define target RGBs for Discord's native button colors
  // Danger (Red), Success (Green), Primary (Blurple/Blue)
  const targets = {
    [ButtonStyle.Danger]:  { r: 220, g: 38,  b: 38  }, // #dc2626
    [ButtonStyle.Success]: { r: 22,  g: 163, b: 74  }, // #16a34a
    [ButtonStyle.Primary]: { r: 37,  g: 99,  b: 235 }, // #2563eb
  };

  let closestStyle = ButtonStyle.Secondary;
  let minDistance = Infinity;

  // Calculate the distance to each standard button color
  for (const [styleStr, target] of Object.entries(targets)) {
    const style = Number(styleStr) as ButtonStyle;

    // Standard Euclidean distance formula in 3D color space
    const distance = Math.sqrt(
      Math.pow(r - target.r, 2) +
      Math.pow(g - target.g, 2) +
      Math.pow(b - target.b, 2)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestStyle = style;
    }
  }

  // If the color is a heavy neutral tone (gray/black/white)
  // or just too far from all targets, keep it clean with Secondary (Gray)
  const maxRGB = Math.max(r, g, b);
  const minRGB = Math.min(r, g, b);
  const saturation = maxRGB - minRGB;

  if (saturation < 30 || minDistance > 160) {
    return ButtonStyle.Secondary;
  }

  return closestStyle;
}

function formatInTimezone(timestamp: string, timezone: string, language: "en" | "cs") {
  return new Intl.DateTimeFormat(getIntlLocaleForClanLanguage(language), {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

function formatShortDate(timestamp: string, timezone: string, language: "en" | "cs") {
  return new Intl.DateTimeFormat(getIntlLocaleForClanLanguage(language), {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(timestamp))
    .replace(/\//g, "-");
}

void client.login(botToken);
