import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  type APIEmbedField,
} from "discord.js";

import { getClanDiscordMessages } from "../../src/lib/clan-language";

import { SIGNUP_NOT_ATTENDING, TRAINING_ATTEND } from "./constants";
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
  buildRosterImageUrl,
  formatEventStatus,
  formatInTimezone,
  generateCalendarUrl,
  pickButtonStyle,
} from "./utils";

export function buildAnnouncementMessage(payload: SyncPayload, event: EventRecord) {
  const roster = payload.rosters.find((item) => item.eventId === event.id);
  return {
    embed: buildEventEmbed(payload.config, payload.groups, event, roster),
    components: buildEventComponents(payload.config, payload.groups, event, roster),
  };
}

export function buildEventEmbed(config: DiscordConfig, groups: Group[], event: EventRecord, roster?: Roster) {
  const messages = getClanDiscordMessages(config.defaultLanguage);
  const signupsByGroup = new Map<string, string[]>();
  const groupNameById = new Map(groups.map((group) => [group.id, group.name]));

  const participantSignups = event.participants.map((participant) => ({
    userId: participant.userId,
    group: participant.status === "attending" ? (participant.group ?? "ATTENDING") : SIGNUP_NOT_ATTENDING,
  }));
  const signups = participantSignups.length > 0 ? participantSignups : event.signUps;

  for (const signUp of signups) {
    const rawGroup = signUp.group ?? SIGNUP_NOT_ATTENDING;
    const key = rawGroup === SIGNUP_NOT_ATTENDING ? SIGNUP_NOT_ATTENDING : (groupNameById.get(rawGroup) ?? rawGroup);
    const list = signupsByGroup.get(key) ?? [];
    list.push(`<@${signUp.userId}>`);
    signupsByGroup.set(key, list);
  }

  const gameStartUnix = Math.floor(new Date(event.gameStart).getTime() / 1000);
  const meetingUnix = Math.floor(new Date(event.meetingStart).getTime() / 1000);
  const regEndUnix = Math.floor(new Date(event.registrationEnd).getTime() / 1000);
  const descriptionLines: string[] = [];

  if (event.kind === "match" && event.map) descriptionLines.push(`**🗺️ ${messages.embed.map}:** ${event.map}`);
  if (event.kind === "match" && event.side) descriptionLines.push(`**⚔️ ${messages.embed.side}:** ${event.side}`);
  if (event.kind === "match" && event.cap) descriptionLines.push(`**🧢 ${messages.embed.cap}:** ${event.cap}`);
  if (event.server) descriptionLines.push(`**🖥️ ${messages.embed.server}:** ${event.server}`);
  if (event.kind === "match" && event.serverPassword) {
    descriptionLines.push(`**🔑 ${messages.embed.password}:** \`${event.serverPassword}\``);
  }
  if (event.description || event.notes) {
    descriptionLines.push(`**📝 ${messages.embed.description}:** ${event.notes || event.description}`);
  }
  if (descriptionLines.length > 0) {
    descriptionLines.push("----------------------------------------");
  }

  descriptionLines.push(`**⏰ ${messages.embed.registrationEnds}:** <t:${regEndUnix}:R> (<t:${regEndUnix}:f>)`);
  descriptionLines.push(`**📢 ${messages.embed.meeting}:** <t:${meetingUnix}:t>`);
  descriptionLines.push(`**🚀 ${messages.embed.matchStart}:** <t:${gameStartUnix}:F>`);
  descriptionLines.push(`**📌 ${messages.embed.status}:** ${formatEventStatus(event.status, config.defaultLanguage)}`);

  const embed = new EmbedBuilder()
    .setTitle(`📅 ${event.name}`)
    .setDescription(descriptionLines.join("\n"))
    .setColor("#FFB000")
    .setFooter({ text: messages.embed.managedFooter });

  if (event.thumbnailUrl) {
    embed.setThumbnail(event.thumbnailUrl);
  }

  if (event.kind === "match" && shouldShowPublishedRosterImage(event, roster)) {
    embed.setImage(buildRosterImageUrl(event.id));
    return embed;
  }

  if (event.kind === "match") {
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

    return embed;
  }

  const attending = event.participants
    .filter((participant) => participant.status === "attending")
    .map((participant) => `<@${participant.userId}>`);
  const nonAttending = event.participants
    .filter((participant) => participant.status === "not_attending")
    .map((participant) => `<@${participant.userId}>`);

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

export function buildForumInfoEmbed(config: DiscordConfig, event: EventRecord) {
  const messages = getClanDiscordMessages(config.defaultLanguage);
  const embed = new EmbedBuilder()
    .setTitle(event.name)
    .setDescription(event.notes || event.description || messages.forum.matchInformation)
    .setFooter({ text: `${messages.forum.managedFooter} ${config.timezone}` });

  if (event.thumbnailUrl) {
    embed.setThumbnail(event.thumbnailUrl);
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
    .setDescription(ticketSettings.panelDescription.slice(0, 4096))
    .setColor("#3B82F6")
    .setFooter({ text: messages.panels.ticketManagedFooter });

  if (ticketSettings.panelImageUrl) {
    embed.setThumbnail(ticketSettings.panelImageUrl);
  }

  const categoryFieldValue = ticketSettings.categories
    .map((category) => {
      const heading = [category.emoji?.trim(), category.label?.trim() || category.id].filter(Boolean).join(" ");
      const description = category.description?.trim();
      return description ? `${heading}: ${description}` : heading;
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
    .setDescription(membershipSettings.panelDescription.slice(0, 4096))
    .setColor("#16A34A")
    .setFooter({ text: messages.panels.membershipManagedFooter });

  if (membershipSettings.panelImageUrl) {
    embed.setThumbnail(membershipSettings.panelImageUrl);
  }

  const categoryFieldValue = membershipSettings.categories
    .map((category) => {
      const heading = [category.emoji?.trim(), category.label?.trim() || category.id].filter(Boolean).join(" ");
      const description = category.description?.trim();
      return description ? `${heading}: ${description}` : heading;
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
  return Boolean(roster?.published && (event.status === "closed" || event.status === "starting"));
}

function isSignupOpen(event: EventRecord) {
  if (event.status === "registration") {
    return true;
  }

  if (event.kind !== "training" || event.status !== "starting") {
    return false;
  }

  const registrationEnd = new Date(event.registrationEnd).getTime();
  return Number.isFinite(registrationEnd) && Date.now() < registrationEnd;
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
