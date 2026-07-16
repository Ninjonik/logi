import { ButtonStyle } from "discord.js";

import { getClanDiscordMessages, getIntlLocaleForClanLanguage } from "../../src/lib/clan-language";

import { env } from "./environment";
import type { ClanLanguage, DiscordConfig, EventRecord } from "./types";

export function generateCalendarUrl(event: EventRecord, language: ClanLanguage): string {
  const base = "https://calendar.google.com/calendar/render?action=TEMPLATE";
  const title = encodeURIComponent(event.name);
  const messages = getClanDiscordMessages(language);
  const formatTime = (isoStr: string) => new Date(isoStr).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const dates = `${formatTime(event.gameStart)}/${formatTime(event.gameEnd)}`;
  const details = encodeURIComponent(event.description || messages.calendar.fallbackDetails);
  const location = encodeURIComponent(event.server ?? event.meetingChannelId ?? messages.calendar.fallbackLocation);

  return `${base}&text=${title}&dates=${dates}&details=${details}&location=${location}`;
}

export function buildDiscordMessageLink(guildId: string, channelId?: string, messageId?: string) {
  if (!channelId) return null;
  return messageId
    ? `https://discord.com/channels/${guildId}/${channelId}/${messageId}`
    : `https://discord.com/channels/${guildId}/${channelId}`;
}

export function formatEventStatus(status: EventRecord["status"], language: ClanLanguage) {
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

export function buildRosterImageUrl(eventId: string) {
  const url = new URL(`/api/discord/roster-image/${eventId}`, env.appSiteUrl);
  url.searchParams.set("secret", env.internalSecret);
  return url.toString();
}

export async function revalidateRosterImage(eventId: string) {
  await fetch(new URL("/api/cache/roster-image", env.appSiteUrl), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ eventId, secret: env.internalSecret }),
  }).catch(() => null);
}

export function pickButtonStyle(color: string) {
  const hex = color.replace(/^#/, "").trim();
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return ButtonStyle.Secondary;
  }

  const targets = {
    [ButtonStyle.Danger]: { r: 220, g: 38, b: 38 },
    [ButtonStyle.Success]: { r: 22, g: 163, b: 74 },
    [ButtonStyle.Primary]: { r: 37, g: 99, b: 235 },
  };

  let closestStyle = ButtonStyle.Secondary;
  let minDistance = Infinity;

  for (const [styleStr, target] of Object.entries(targets)) {
    const style = Number(styleStr) as ButtonStyle;
    const distance = Math.sqrt(
      Math.pow(r - target.r, 2) +
      Math.pow(g - target.g, 2) +
      Math.pow(b - target.b, 2),
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestStyle = style;
    }
  }

  const maxRGB = Math.max(r, g, b);
  const minRGB = Math.min(r, g, b);
  const saturation = maxRGB - minRGB;

  if (saturation < 30 || minDistance > 160) {
    return ButtonStyle.Secondary;
  }

  return closestStyle;
}

export function formatInTimezone(timestamp: string, timezone: string, language: ClanLanguage) {
  return new Intl.DateTimeFormat(getIntlLocaleForClanLanguage(language), {
    timeZone: timezone,
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function formatShortDate(timestamp: string, timezone: string, language: ClanLanguage) {
  return new Intl.DateTimeFormat(getIntlLocaleForClanLanguage(language), {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .format(new Date(timestamp))
    .replace(/\//g, "-");
}

export function buildForumThreadName(config: DiscordConfig, event: EventRecord) {
  return `${event.name} ${formatShortDate(event.gameStart, config.timezone, config.defaultLanguage)}`.slice(0, 100);
}

export function slugifyTicketLabel(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized || "ticket";
}
