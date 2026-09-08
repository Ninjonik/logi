import type { Client } from "discord.js";

import { getClanDiscordMessages } from "../../../src/lib/clan-language";
import { ATTENDANCE_OFFSETS_HOURS } from "../constants";
import { convex, references } from "../convex";
import { env } from "../environment";
import { logInfo, logWarn } from "../log";
import { buildAttendanceReminderComponents } from "../message-builders";
import type { SyncPayload } from "../types";
import { buildDiscordMessageLink } from "../utils";

type RosterAssignment = {
  squadName: string;
  roleName?: string;
  note?: string;
};

export function buildAttendanceReminderMessage(input: {
  eventName: string;
  meetingStartMs: number;
  eventMessageUrl?: string;
  assignment?: RosterAssignment;
  messages: ReturnType<typeof getClanDiscordMessages>;
}) {
  const assignment = input.assignment
    ? [input.assignment.squadName, input.assignment.roleName].filter(Boolean).join(" — ")
    : null;

  return [
    `${input.messages.reminders.title} **${input.eventName}**.`,
    input.messages.reminders.body,
    `${input.messages.reminders.meeting}: <t:${Math.floor(input.meetingStartMs / 1000)}:F>`,
    assignment ? `${input.messages.reminders.assignment}: **${assignment}**` : null,
    input.assignment?.note?.trim() ? `${input.messages.reminders.notes}: ${input.assignment.note.trim()}` : null,
    input.eventMessageUrl
      ? `${input.messages.reminders.eventThread}: [${input.messages.reminders.openInDiscord}](${input.eventMessageUrl})`
      : null,
  ]
    .filter((line): line is string => Boolean(line))
    .join("\n");
}

export async function processAttendanceReminders(
  client: Client,
  queuedEventIds: Set<string>,
  payload: SyncPayload,
  dueEventIds: ReadonlySet<string>,
) {
  const guild = await client.guilds.fetch(payload.config.guildId).catch(() => null);
  if (!guild) {
    logWarn("attendance-reminders", "Skipping attendance reminders because guild could not be fetched", {
      guildId: payload.config.guildId,
    });
    return;
  }

  for (const event of payload.events) {
    if (!dueEventIds.has(event.id)) continue;
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

    const messages = getClanDiscordMessages(payload.config.defaultLanguage);
    const assignmentsByUserId = new Map<string, RosterAssignment>();
    for (const squad of roster.squads) {
      for (const player of squad.players) {
        if (player.id && !player.ack) {
          assignmentsByUserId.set(player.id, {
            squadName: squad.name,
            roleName: player.roleName,
            note: player.note,
          });
        }
      }
    }
    const reserveAttendanceByUserId = new Map(
      (roster.reserveAttendances ?? []).map((attendance) => [attendance.userId, attendance]),
    );
    for (const userId of roster.reservePlayerIds) {
      if (reserveAttendanceByUserId.get(userId)?.ack) continue;
      assignmentsByUserId.set(userId, { squadName: messages.embed.assignmentReserve });
    }
    const unacknowledgedUserIds = new Set(assignmentsByUserId.keys());
    if (!unacknowledgedUserIds.size) {
      logInfo("attendance-reminders", "Skipping reminders because everyone already acknowledged attendance", {
        eventId: event.id,
        guildId: payload.config.guildId,
      });
      continue;
    }

    const now = Date.now();
    const remindersToLog: Array<{ userId: string; offsetHours: number; sentAt: string }> = [];
    const eventMessageUrl =
      buildDiscordMessageLink(
        payload.config.guildId,
        event.eventInfoChannelId ?? payload.config.eventInfoChannelId,
        syncState?.eventInfoMessageId,
      ) ??
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
    for (const userId of unacknowledgedUserIds) {
      const dueOffsets = ATTENDANCE_OFFSETS_HOURS
        .filter((offsetHours) => now >= meetingStartMs - offsetHours * 60 * 60 * 1000)
        .filter((offsetHours) => !event.attendanceReminderLog.some(
          (entry) => entry.userId === userId && entry.offsetHours === offsetHours,
        ))
        .sort((left, right) => left - right);

      const offsetHours = dueOffsets[0];
      if (offsetHours === undefined) continue;

      const user = await client.users.fetch(userId).catch(() => null);
      if (!user) continue;

      const sentAt = new Date().toISOString();
      const message = buildAttendanceReminderMessage({
        eventName: event.name,
        meetingStartMs,
        eventMessageUrl: eventMessageUrl ?? undefined,
        assignment: assignmentsByUserId.get(userId),
        messages,
      });

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
