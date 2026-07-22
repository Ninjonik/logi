import { getClanDiscordMessages } from "@/lib/clan-language";
import type { ClanLanguage, EventRecord } from "../../../discord-bot/src/types";

export function buildScheduledEventDescription(event: EventRecord, language: ClanLanguage) {
  const messages = getClanDiscordMessages(language);
  const lines = [
    event.description?.trim(),
    event.notes?.trim(),
    event.kind === "match" && event.map ? `${messages.scheduledEvent.map}: ${event.map}` : null,
    event.kind === "match" && event.side ? `${messages.scheduledEvent.side}: ${event.side}` : null,
    event.kind === "match" && event.cap ? `${messages.scheduledEvent.cap}: ${event.cap}` : null,
    event.server ? `${messages.scheduledEvent.server}: ${event.server}` : null,
    event.kind === "match" && event.serverPassword ? `${messages.scheduledEvent.password}: ${event.serverPassword}` : null,
  ].filter((line): line is string => Boolean(line));

  return lines.join("\n").slice(0, 1000) || messages.scheduledEvent.managedFallback;
}

export function resolveScheduledEventEndTime(event: Pick<EventRecord, "meetingStart" | "gameEnd">) {
  const scheduledStartTime = new Date(event.meetingStart);
  const scheduledEndTime = new Date(event.gameEnd);

  if (
    Number.isFinite(scheduledStartTime.getTime()) &&
    Number.isFinite(scheduledEndTime.getTime()) &&
    scheduledEndTime.getTime() > scheduledStartTime.getTime()
  ) {
    return scheduledEndTime;
  }

  return new Date(scheduledStartTime.getTime() + 90 * 60 * 1000);
}
