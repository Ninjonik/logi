import type { Client } from "discord.js";

import { getClanDiscordMessages } from "../../../src/lib/clan-language";
import { ATTENDANCE_OFFSETS_HOURS } from "../constants";
import { convex, references } from "../convex";
import { env } from "../environment";
import { logInfo, logWarn } from "../log";
import { buildAttendanceReminderComponents } from "../message-builders";
import type { SyncPayload } from "../types";
import { buildDiscordMessageLink } from "../utils";

export async function processAttendanceReminders(client: Client, queuedEventIds: Set<string>, payload: SyncPayload) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) {
    logWarn("attendance-reminders", "Skipping attendance reminders because guild could not be fetched", {
      guildId: payload.config.guildId,
    });
    return;
  }

  for (const event of payload.events) {
    if (event.status !== "starting") continue;

    const roster = payload.rosters.find((item) => item.eventId === event.id && item.published);
    if (!roster) {
      logInfo("attendance-reminders", "Skipping reminders because no published roster exists", {
        eventId: event.id,
        guildId: payload.config.guildId,
      });
      continue;
    }

    const syncState = payload.syncStates.find((item) => item.eventId === event.id);
    const meetingStartMs = new Date(event.meetingStart).getTime();
    if (!Number.isFinite(meetingStartMs)) {
      logWarn("attendance-reminders", "Skipping reminders because meeting start is invalid", {
        eventId: event.id,
        guildId: payload.config.guildId,
        meetingStart: event.meetingStart,
      });
      continue;
    }

    const unacknowledgedUserIds = new Set(
      roster.squads.flatMap((squad) =>
        squad.players.filter((player) => player.id && !player.ack).map((player) => player.id!),
      ),
    );
    if (!unacknowledgedUserIds.size) {
      logInfo("attendance-reminders", "Skipping reminders because everyone already acknowledged attendance", {
        eventId: event.id,
        guildId: payload.config.guildId,
      });
      continue;
    }

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
          buildDiscordMessageLink(
            payload.config.guildId,
            syncState?.announcementChannelId,
            syncState?.announcementMessageId,
          ) ??
          buildDiscordMessageLink(
            payload.config.guildId,
            syncState?.forumChannelId,
            syncState?.infoMessageId,
          );
        const messages = getClanDiscordMessages(payload.config.defaultLanguage);
        const message = [
          `${messages.reminders.title} **${event.name}**.`,
          messages.reminders.body,
          `${messages.reminders.meeting}: <t:${Math.floor(meetingStartMs / 1000)}:F>`,
          eventMessageUrl
            ? `${messages.reminders.eventThread}: [${messages.reminders.openInDiscord}](${eventMessageUrl})`
            : null,
        ]
          .filter((line): line is string => Boolean(line))
          .join("\n");

        try {
          await user.send({
            content: message,
            components: buildAttendanceReminderComponents(event.id, payload.config.defaultLanguage),
          });
          logInfo("attendance-reminders", "Sent attendance reminder", {
            eventId: event.id,
            guildId: payload.config.guildId,
            userId,
            offsetHours,
          });
        } catch {
          continue;
        }

        remindersToLog.push({ userId, offsetHours, sentAt });
      }
    }

    if (remindersToLog.length) {
      await convex.mutation(references.appendAttendanceReminderLog, {
        secret: env.internalSecret,
        eventId: event.id as never,
        reminders: remindersToLog,
      });
      queuedEventIds.add(event.id);
      logInfo("attendance-reminders", "Logged attendance reminders and re-queued event", {
        eventId: event.id,
        guildId: payload.config.guildId,
        reminderCount: remindersToLog.length,
      });
    }
  }
}
