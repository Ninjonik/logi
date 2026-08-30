import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbedField,
} from "discord.js";

import { getClanDiscordMessages } from "../../src/lib/clan-language";
import { expandCalendarItems } from "../../src/lib/calendar-items";
import { formatDiscordMarkdown } from "../../src/lib/discord-markdown";
import { canAcceptSignups } from "../../src/domain/events/status";

import { SIGNUP_GENERAL, SIGNUP_NOT_ATTENDING, TRAINING_ATTEND } from "./constants";
import type {
  ClanLanguage,
  DiscordConfig,
  EventRecord,
  Group,
  MembershipApplicationThreadRecord,
  MembershipCategory,
  Roster,
  SyncPayload,
  TicketCategory,
  TicketThreadRecord,
} from "./types";
import {
  buildForumThreadName,
  getRosterImageVersion,
  buildRosterImageUrl,
  formatEventStatus,
  formatInTimezone,
  generateCalendarUrl,
  pickButtonStyle,
} from "./utils";

export function buildAnnouncementMessage(
  payload: SyncPayload,
  event: EventRecord,
  userDisplayNames: Record<string, string> = payload.userDisplayNames,
  options?: { showPublishedRosterImage?: boolean },
) {
  const roster = payload.rosters.find((item) => item.eventId === event.id);
  return {
    embed: buildEventEmbed(payload.config, payload.groups, payload.guild.eventCategories, event, roster, userDisplayNames, options),
    components: buildEventComponents(payload.config, payload.groups, event, roster),
  };
}

function escapeDisplayName(value: string) {
  return value.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, "\\$1");
}

function resolveAnnouncementDisplayName(userId: string, userDisplayNames: Record<string, string>) {
  const displayName = userDisplayNames[userId]?.trim();
  return escapeDisplayName(displayName && displayName.length > 0 ? displayName : userId);
}

function normalizeCategoryId(value?: string) {
  return value?.trim().toLowerCase() ?? "";
}

function findEventCategory(categories: SyncPayload["guild"]["eventCategories"], matchType?: string) {
  const resolvedCategories = Array.isArray(categories) ? categories : [];
  const normalizedMatchType = normalizeCategoryId(matchType);
  if (!normalizedMatchType) {
    return undefined;
  }

  return resolvedCategories.find((category) => normalizeCategoryId(category.id) === normalizedMatchType);
}

function resolveEventCategoryLabel(categories: SyncPayload["guild"]["eventCategories"], event: EventRecord) {
  if (event.kind === "training") {
    return undefined;
  }

  return findEventCategory(categories, event.matchType)?.label ?? event.matchType?.trim() ?? undefined;
}

function resolveEventCategoryColor(categories: SyncPayload["guild"]["eventCategories"], event: EventRecord) {
  return findEventCategory(categories, event.matchType)?.color ?? "#FFB000";
}

function resolveEventCategoryEmoji(categories: SyncPayload["guild"]["eventCategories"], event: EventRecord) {
  return findEventCategory(categories, event.matchType)?.emoji?.trim() || undefined;
}

function toDiscordColor(color: string) {
  const normalized = color.trim();
  if (/^#[\da-f]{6}$/i.test(normalized)) {
    return Number.parseInt(normalized.slice(1), 16);
  }

  return Number.parseInt("FFB000", 16);
}

function buildInlineSignupFields(name: string, members: string[], emptyLabel: string): APIEmbedField[] {
  if (!members.length) {
    return [{ name, value: emptyLabel, inline: true }];
  }

  const columnCount = Math.min(3, members.length);
  const columns = Array.from({ length: columnCount }, () => [] as string[]);
  for (let index = 0; index < members.length; index += 1) {
    columns[index % columnCount]!.push(members[index]!);
  }

  return columns.map((columnMembers, index) => ({
    name: index === 0 ? name : "\u200B",
    value: columnMembers.join("\n"),
    inline: true,
  }));
}

function buildInlineFieldPadding(fieldCount: number): APIEmbedField[] {
  const remainder = fieldCount % 3;
  if (remainder === 0) {
    return [];
  }

  return Array.from({ length: 3 - remainder }, () => ({
    name: "\u200B",
    value: "\u200B",
    inline: true,
  }));
}

export function buildEventEmbed(
  config: DiscordConfig,
  groups: Group[],
  categories: SyncPayload["guild"]["eventCategories"],
  event: EventRecord,
  roster?: Roster,
  userDisplayNames: Record<string, string> = {},
  options?: { showPublishedRosterImage?: boolean },
) {
  const messages = getClanDiscordMessages(config.defaultLanguage);
  const signupsByGroup = new Map<string, string[]>();
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  const participantSignups = event.participants.map((participant) => ({
    userId: participant.userId,
    group: participant.status === "attending" ? (participant.group ?? "ATTENDING") : SIGNUP_NOT_ATTENDING,
  }));
  const signups = participantSignups.length > 0 ? participantSignups : event.signUps;

  for (const signUp of signups) {
    const rawGroup = signUp.group ?? "ATTENDING";
    const key = rawGroup === SIGNUP_NOT_ATTENDING ? SIGNUP_NOT_ATTENDING : (groupNameById.get(rawGroup) ?? rawGroup);
    const list = signupsByGroup.get(key) ?? [];
    list.push(resolveAnnouncementDisplayName(signUp.userId, userDisplayNames));
    signupsByGroup.set(key, list);
  }

  const gameStartUnix = Math.floor(new Date(event.gameStart).getTime() / 1000);
  const meetingUnix = Math.floor(new Date(event.meetingStart).getTime() / 1000);
  const regEndUnix = Math.floor(new Date(event.registrationEnd).getTime() / 1000);
  const descriptionLines: string[] = [];

  if (event.kind === "match") {
    descriptionLines.push(`**📢 ${messages.embed.headcountStart}:** <t:${meetingUnix}:F>`);
    descriptionLines.push(`**🚀 ${messages.embed.briefingStart}:** <t:${gameStartUnix}:F>`);
    descriptionLines.push(`**⏰ ${messages.embed.registrationEnds}:** <t:${regEndUnix}:F>`);
    descriptionLines.push("----------------------------------------");
  }

  if (event.kind === "match" && event.map) descriptionLines.push(`**🗺️ ${messages.embed.map}:** ${event.map}`);
  if (event.kind === "match" && event.side) descriptionLines.push(`**⚔️ ${messages.embed.side}:** ${event.side}`);
  if (event.kind === "match" && event.cap) descriptionLines.push(`**🧢 ${messages.embed.cap}:** ${event.cap}`);
  if (event.server) descriptionLines.push(`**🖥️ ${messages.embed.server}:** ${event.server}`);
  if (event.kind === "match" && event.serverPassword) {
    descriptionLines.push(`**🔑 ${messages.embed.password}:** \`${event.serverPassword}\``);
  }
  if (event.description || event.notes) {
    descriptionLines.push(`**📝 ${messages.embed.description}:** ${formatDiscordMarkdown(event.notes || event.description)}`);
  }
  if (descriptionLines.length > 0) {
    descriptionLines.push("----------------------------------------");
  }

  if (event.kind === "training") {
    descriptionLines.push(`**⏰ ${messages.embed.registrationEnds}:** <t:${regEndUnix}:R> (<t:${regEndUnix}:f>)`);
    descriptionLines.push(`**📢 ${messages.embed.meeting}:** <t:${meetingUnix}:t>`);
    descriptionLines.push(`**🚀 ${messages.embed.trainingStart}:** <t:${gameStartUnix}:F>`);
  }
  const categoryLabel = resolveEventCategoryLabel(categories, event);
  if (categoryLabel) {
    descriptionLines.push(`**🏷️ ${messages.calendar.matchLabel}:** ${categoryLabel}`);
  }
  descriptionLines.push(`**📌 ${messages.embed.status}:** ${formatEventStatus(event.status, config.defaultLanguage)}`);

  const embed = new EmbedBuilder()
    .setTitle(`📅 ${event.name}`)
    .setDescription(formatDiscordMarkdown(descriptionLines.join("\n")))
    .setColor(toDiscordColor(resolveEventCategoryColor(categories, event)))
    .setFooter({ text: messages.embed.managedFooter });

  if (event.thumbnailUrl) {
    embed.setThumbnail(event.thumbnailUrl);
  }

  if (event.kind === "match" && roster?.published && (options?.showPublishedRosterImage || shouldShowPublishedRosterImage(event, roster))) {
    embed.setImage(buildRosterImageUrl(event.id, getRosterImageVersion(event, roster?.updatedAt)));
    return embed;
  }

  if (event.kind === "match" && event.imageUrl) {
    embed.setImage(event.imageUrl);
  }

  if (event.kind === "match") {
    const configuredGroupIds = event.signupGroupIds ? new Set(event.signupGroupIds) : null;
    const visibleGroups = configuredGroupIds ? groups.filter((group) => configuredGroupIds.has(group.id)) : groups;
    const signupSections: APIEmbedField[][] = [];

    for (const group of visibleGroups) {
      const members = signupsByGroup.get(group.name) ?? [];
      signupSections.push(
        buildInlineSignupFields(
          `${group.discordEmoji ?? "👥"} ${group.name} (${members.length})`,
          members,
          messages.embed.nobodyYet,
        ),
      );
    }

    const generalAttending = signupsByGroup.get("ATTENDING") ?? [];
    if (generalAttending.length > 0) {
      signupSections.push(
        buildInlineSignupFields(
          `✅ ${messages.embed.attending} (${generalAttending.length})`,
          generalAttending,
          messages.embed.nobodyYet,
        ),
      );
    }

    const nonAttending = signupsByGroup.get(SIGNUP_NOT_ATTENDING) ?? [];
    signupSections.push(
      buildInlineSignupFields(
        `❌ ${messages.embed.notAttending} (${nonAttending.length})`,
        nonAttending,
        messages.embed.nobodyYet,
      ),
    );

    signupSections.forEach((sectionFields, index) => {
      embed.addFields(...sectionFields);
      if (index < signupSections.length - 1) {
        embed.addFields(...buildInlineFieldPadding(sectionFields.length));
      }
    });

    return embed;
  }

  const attending = event.participants
    .filter((participant) => participant.status === "attending")
    .map((participant) => resolveAnnouncementDisplayName(participant.userId, userDisplayNames));
  const nonAttending = event.participants
    .filter((participant) => participant.status === "not_attending")
    .map((participant) => resolveAnnouncementDisplayName(participant.userId, userDisplayNames));

  embed.addFields(
    {
      name: `✅ ${messages.embed.attending} (${attending.length})`,
      value: attending.length ? attending.join(", ") : messages.embed.nobodyYet,
      inline: false,
    },
    {
      name: `❌ ${messages.embed.notAttending} (${nonAttending.length})`,
      value: nonAttending.length ? nonAttending.join(", ") : messages.embed.nobodyYet,
      inline: false,
    },
  );

  return embed;
}

export function buildEventComponents(config: DiscordConfig, groups: Group[], event: EventRecord, roster?: Roster) {
  const messages = getClanDiscordMessages(config.defaultLanguage);

  if (isSignupOpen(event)) {
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

export function buildForumInfoEmbed(config: DiscordConfig, event: EventRecord, stratmapLinks: string[] = []) {
  const messages = getClanDiscordMessages(config.defaultLanguage);
  const embed = new EmbedBuilder()
    .setTitle(event.name)
    .setDescription(formatDiscordMarkdown(event.notes || event.description || messages.forum.matchInformation))
    .setFooter({ text: `${messages.forum.managedFooter} ${config.timezone}` });

  if (event.thumbnailUrl) {
    embed.setThumbnail(event.thumbnailUrl);
  }

  if (event.kind === "match" && event.imageUrl) {
    embed.setImage(event.imageUrl);
  }

  if (event.kind === "match") {
    embed.addFields(
      { name: messages.forum.map, value: event.map ?? messages.forum.notSet, inline: true },
      { name: messages.forum.side, value: event.side ?? messages.forum.notSet, inline: true },
      { name: messages.forum.cap, value: event.cap ?? messages.forum.notSet, inline: true },
      { name: messages.forum.server, value: event.server ?? messages.forum.notSet, inline: true },
      { name: messages.forum.serverPassword, value: event.serverPassword ?? messages.forum.notSet, inline: true },
      {
        name: messages.forum.gameStart,
        value: formatInTimezone(event.gameStart, config.timezone, config.defaultLanguage),
        inline: true,
      },
    );
    if (stratmapLinks.length) {
      embed.addFields({
        name: "Stratmaps",
        value: stratmapLinks.join("\n").slice(0, 1024),
        inline: false,
      });
    }
  } else {
    embed.addFields(
      {
        name: messages.embed.meeting,
        value: formatInTimezone(event.meetingStart, config.timezone, config.defaultLanguage),
        inline: true,
      },
      { name: messages.forum.server, value: event.meetingChannelId ?? messages.forum.notSet, inline: true },
    );
  }

  return embed;
}

export function buildAttendanceReminderComponents(eventId: string, language: ClanLanguage) {
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

export { buildForumThreadName };

export function buildTicketPanelEmbed(config: DiscordConfig) {
  const ticketSettings = config.ticketSettings;
  if (!ticketSettings) {
    return null;
  }

  const messages = getClanDiscordMessages(config.defaultLanguage);
  const embed = new EmbedBuilder()
    .setTitle(ticketSettings.panelTitle.slice(0, 256))
    .setDescription(formatDiscordMarkdown(ticketSettings.panelDescription, 4096))
    .setColor("#3B82F6")
    .setFooter({ text: messages.panels.ticketManagedFooter });

  if (ticketSettings.panelImageUrl) {
    embed.setThumbnail(ticketSettings.panelImageUrl);
  }

  const categoryFieldValue = ticketSettings.categories
    .map((category) => {
      const heading = [category.emoji?.trim(), category.label?.trim() || category.id].filter(Boolean).join(" ");
      const description = category.description?.trim();
      return description ? `${heading}: ${formatDiscordMarkdown(description)}` : heading;
    })
    .join("\n")
    .slice(0, 1024);

  const fields: APIEmbedField[] = [];
  if (categoryFieldValue) {
    fields.push({
      name: messages.panels.ticketCategories,
      value: categoryFieldValue,
      inline: false,
    });
  }

  if (fields.length) {
    embed.addFields(fields);
  }

  return embed;
}

export function buildTicketPanelComponents(config: DiscordConfig) {
  const ticketSettings = config.ticketSettings;
  if (!ticketSettings?.categories.length) {
    return [];
  }

  const buttons = ticketSettings.categories.map((category) => {
    const button = new ButtonBuilder()
      .setCustomId(`ticket:${category.id}`)
      .setStyle(ButtonStyle.Primary);

    const label = category.label?.trim();
    const emoji = category.emoji?.trim();

    if (emoji) {
      button.setEmoji(emoji);
    }
    if (label) {
      button.setLabel(label.slice(0, 80));
    } else if (!emoji) {
      button.setLabel(category.id.slice(0, 80));
    }

    return button;
  });

  const rows: Array<ActionRowBuilder<ButtonBuilder>> = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(index, index + 5)));
  }

  return rows;
}

export function buildMembershipPanelEmbed(config: DiscordConfig) {
  const membershipSettings = config.membershipSettings;
  if (!membershipSettings) {
    return null;
  }

  const messages = getClanDiscordMessages(config.defaultLanguage);
  const embed = new EmbedBuilder()
    .setTitle(membershipSettings.panelTitle.slice(0, 256))
    .setDescription(formatDiscordMarkdown(membershipSettings.panelDescription, 4096))
    .setColor("#16A34A")
    .setFooter({ text: messages.panels.membershipManagedFooter });

  if (membershipSettings.panelImageUrl) {
    embed.setThumbnail(membershipSettings.panelImageUrl);
  }

  const categoryFieldValue = membershipSettings.categories
    .map((category) => {
      const heading = [category.emoji?.trim(), category.label?.trim() || category.id].filter(Boolean).join(" ");
      const description = category.description?.trim();
      return description ? `${heading}: ${formatDiscordMarkdown(description)}` : heading;
    })
    .join("\n")
    .slice(0, 1024);

  if (categoryFieldValue) {
    embed.addFields({
      name: messages.panels.membershipApplications,
      value: categoryFieldValue,
      inline: false,
    });
  }

  return embed;
}

export function buildMembershipPanelComponents(config: DiscordConfig) {
  const membershipSettings = config.membershipSettings;
  if (!membershipSettings?.categories.length) {
    return [];
  }

  const buttons = membershipSettings.categories.map((category) => {
    const button = new ButtonBuilder()
      .setCustomId(`membership:${category.id}`)
      .setStyle(ButtonStyle.Success);

    const label = category.label?.trim();
    const emoji = category.emoji?.trim();

    if (emoji) {
      button.setEmoji(emoji);
    }
    if (label) {
      button.setLabel(label.slice(0, 80));
    } else if (!emoji) {
      button.setLabel(category.id.slice(0, 80));
    }

    return button;
  });

  const rows: Array<ActionRowBuilder<ButtonBuilder>> = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(index, index + 5)));
  }

  return rows;
}

function resolveCalendarEventLabel(
  config: DiscordConfig,
  categories: SyncPayload["guild"]["eventCategories"],
  event: EventRecord,
) {
  const messages = getClanDiscordMessages(config.defaultLanguage);
  if (event.kind === "training") {
    return messages.calendar.trainingLabel;
  }

  return findEventCategory(categories, event.matchType)?.label
    ?? event.matchType?.trim()
    ?? messages.calendar.matchLabel;
}

function formatCalendarDate(timestamp: string, timezone: string, language: ClanLanguage) {
  return new Intl.DateTimeFormat(configureLocale(language), {
    timeZone: timezone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(timestamp));
}

function formatCalendarTime(timestamp: string, timezone: string, language: ClanLanguage) {
  return new Intl.DateTimeFormat(configureLocale(language), {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(timestamp));
}

function configureLocale(language: ClanLanguage) {
  return language === "cs" ? "cs-CZ" : "en-GB";
}

function getCalendarAllDayLabel(language: ClanLanguage) {
  return language === "cs" ? "Celý den" : "All day";
}

function getColorChipEmoji(color?: string) {
  const normalized = color?.trim() ?? "";
  const hex = /^#[\da-f]{6}$/i.test(normalized) ? normalized.slice(1) : "FFB000";
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
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
  ];

  let closest = palette[0]!;
  let closestDistance = Number.POSITIVE_INFINITY;
  for (const candidate of palette) {
    const distance = ((red - candidate.red) ** 2) + ((green - candidate.green) ** 2) + ((blue - candidate.blue) ** 2);
    if (distance < closestDistance) {
      closest = candidate;
      closestDistance = distance;
    }
  }

  return closest.emoji;
}

function escapeDiscordLinkLabel(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\]/g, "\\]");
}

function toDiscordTimestamp(timestamp: string, style: "t" | "f" | "F" | "R") {
  return `<t:${Math.floor(new Date(timestamp).getTime() / 1000)}:${style}>`;
}

export function buildCalendarPanelEmbed(
  config: DiscordConfig,
  categories: SyncPayload["guild"]["eventCategories"],
  events: EventRecord[],
  calendarItems: SyncPayload["calendarItems"] = [],
) {
  const resolvedCategories = Array.isArray(categories) ? categories : [];
  const resolvedEvents = Array.isArray(events) ? events : [];
  const resolvedCalendarItems = Array.isArray(calendarItems) ? calendarItems : [];
  const messages = getClanDiscordMessages(config.defaultLanguage);
  const now = Date.now();
  const upcomingEvents = [...resolvedEvents]
    .filter((event) => new Date(event.gameEnd).getTime() >= now && event.status !== "concluded")
    .sort((left, right) => new Date(left.meetingStart).getTime() - new Date(right.meetingStart).getTime())
    .slice(0, 20);
  const manualOccurrences = expandCalendarItems(
    resolvedCalendarItems as never,
    new Date(now - 24 * 60 * 60 * 1000),
    new Date(now + 366 * 24 * 60 * 60 * 1000),
  ).filter((item) => new Date(item.endAt).getTime() >= now);

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
    .sort((left, right) => new Date(left.startAt).getTime() - new Date(right.startAt).getTime())
    .slice(0, 20);

  const allDayLabel = getCalendarAllDayLabel(config.defaultLanguage);
  const panelColor = upcomingEntries[0]?.color ?? "#2563EB";
  const embed = new EmbedBuilder()
    .setTitle(`📅 ${messages.calendar.panelTitle}`)
    .setColor(toDiscordColor(panelColor))
    .setFooter({ text: `${messages.embed.managedFooter} • ${config.timezone}` });

  if (!upcomingEntries.length) {
    if (!resolvedCategories.length) {
      embed.setDescription(messages.calendar.panelEmpty);
    }
    return embed;
  }

  const legendEntries = new Map<string, string>();
  const descriptionLines: string[] = [];

  for (const entry of upcomingEntries) {
    if (!entry.label) {
      continue;
    }

    const chip = getColorChipEmoji(entry.color);
    const categoryEmoji = entry.emoji?.trim();
    const legendParts = [chip, categoryEmoji === chip ? undefined : categoryEmoji, entry.label.trim()].filter(Boolean);
    legendEntries.set(`${entry.label.trim().toLowerCase()}:${entry.color}:${entry.emoji?.trim() ?? ""}`, legendParts.join(" "));
  }

  if (legendEntries.size) {
    descriptionLines.push(`**${messages.calendar.panelCategories}**`);
    descriptionLines.push(...legendEntries.values());
    descriptionLines.push("");
  }

  let currentDateLabel = "";
  for (const entry of upcomingEntries) {
    const dateLabel = formatCalendarDate(entry.dateKey, config.timezone, config.defaultLanguage);
    if (dateLabel !== currentDateLabel) {
      if (descriptionLines.length && descriptionLines[descriptionLines.length - 1] !== "") {
        descriptionLines.push("");
      }
      descriptionLines.push(`**${dateLabel}**`);
      currentDateLabel = dateLabel;
    }

    const timeLabel = entry.allDay
      ? allDayLabel
      : `${toDiscordTimestamp(entry.startAt, "t")} - ${toDiscordTimestamp(entry.endAt, "t")}`;
    const chip = getColorChipEmoji(entry.color);
    const title = formatDiscordMarkdown(entry.title).replace(/\n+/g, " ").trim();
    const linkedTitle = entry.url
      ? `[${escapeDiscordLinkLabel(title)}](${entry.url})`
      : title;
    const rowParts = [chip, linkedTitle, timeLabel];
    descriptionLines.push(rowParts.join(" "));
  }

  embed.setDescription(descriptionLines.join("\n").slice(0, 4096));

  return embed;
}

export function buildTicketThreadEmbed(input: {
  language: ClanLanguage;
  category: TicketCategory;
  ticket: Pick<TicketThreadRecord, "ticketNumber" | "categoryLabel" | "creatorId">;
  answers: Array<{ label: string; value: string }>;
  creatorTag: string;
}) {
  const messages = getClanDiscordMessages(input.language);
  const embed = new EmbedBuilder()
    .setTitle(messages.ticket.threadTitle.replace("{number}", String(input.ticket.ticketNumber)))
    .setDescription(
      `${messages.ticket.category}: ${input.ticket.categoryLabel}\n${messages.ticket.createdBy}: <@${input.ticket.creatorId}>`,
    )
    .setColor("#F59E0B");

  if (input.answers.length) {
    embed.addFields(
      input.answers.slice(0, 25).map((answer) => ({
        name: answer.label.slice(0, 256),
        value: answer.value.slice(0, 1024) || "-",
        inline: false,
      })),
    );
  }

  embed.setFooter({ text: messages.ticket.openedBy.replace("{creatorTag}", input.creatorTag) });
  return embed;
}

export function buildMembershipApplicationThreadEmbed(input: {
  language: ClanLanguage;
  category: MembershipCategory;
  application: Pick<MembershipApplicationThreadRecord, "applicationNumber" | "categoryLabel" | "creatorId" | "assignmentType">;
  answers: Array<{ label: string; value: string }>;
  creatorTag: string;
  assignmentStatus: "pending" | "recruit" | "active";
}) {
  const messages = getClanDiscordMessages(input.language);
  const resolvedStatus = input.assignmentStatus === "pending"
    ? messages.membership.statusPending
    : input.assignmentStatus === "recruit"
      ? messages.membership.statusRecruit
      : input.application.assignmentType === "mercenary"
        ? messages.membership.statusMercenary
        : messages.membership.statusMember;

  const embed = new EmbedBuilder()
    .setTitle(messages.membership.threadTitle.replace("{number}", String(input.application.applicationNumber)))
    .setDescription(
      `${messages.membership.category}: ${input.application.categoryLabel}\n${messages.membership.createdBy}: <@${input.application.creatorId}>\n${messages.membership.initialStatus}: ${resolvedStatus}`,
    )
    .setColor("#16A34A");

  if (input.answers.length) {
    embed.addFields(
      input.answers.slice(0, 25).map((answer) => ({
        name: answer.label.slice(0, 256),
        value: answer.value.slice(0, 1024) || "-",
        inline: false,
      })),
    );
  }

  embed.setFooter({ text: messages.membership.openedBy.replace("{creatorTag}", input.creatorTag) });
  return embed;
}

function shouldShowPublishedRosterImage(event: EventRecord, roster?: Roster) {
  return Boolean(event.kind === "match" && roster?.published);
}

function isSignupOpen(event: EventRecord) {
  return canAcceptSignups(event, new Date(Date.now()));
}

function buildSignupButtons(config: DiscordConfig, groups: Group[], eventId: string, event: EventRecord) {
  const messages = getClanDiscordMessages(config.defaultLanguage);

  if (event.kind === "training") {
    return [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`signup:${eventId}:${encodeURIComponent(TRAINING_ATTEND)}`)
          .setStyle(ButtonStyle.Primary)
          .setLabel(messages.buttons.attend),
        new ButtonBuilder()
          .setCustomId(`signup:${eventId}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}`)
          .setStyle(ButtonStyle.Danger)
          .setLabel(messages.buttons.decline),
        new ButtonBuilder()
          .setStyle(ButtonStyle.Link)
          .setLabel(messages.buttons.addToCalendar)
          .setEmoji("➕")
          .setURL(generateCalendarUrl(event, config.defaultLanguage)),
      ),
    ];
  }

  const configuredGroupIds = event.signupGroupIds ? new Set(event.signupGroupIds) : null;
  const visibleGroups = configuredGroupIds ? groups.filter((group) => configuredGroupIds.has(group.id)) : groups;
  const allButtons = [
    ...(event.useGeneralSignup ? [
      new ButtonBuilder()
        .setCustomId(`signup:${eventId}:${encodeURIComponent(SIGNUP_GENERAL)}`)
        .setStyle(ButtonStyle.Success)
        .setEmoji("✅")
        .setLabel(messages.buttons.generalSignup),
    ] : []),
    ...visibleGroups.map((group) => {
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
    new ButtonBuilder()
      .setCustomId(`signup:${eventId}:${encodeURIComponent(SIGNUP_NOT_ATTENDING)}`)
      .setStyle(ButtonStyle.Danger)
      .setLabel(messages.buttons.decline),
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
