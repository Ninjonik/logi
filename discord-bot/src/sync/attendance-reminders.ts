import { EmbedBuilder, escapeMarkdown, type Client } from "discord.js"

import {
    DEFAULT_MESSAGE_ACCENT_COLOR,
    discordTimestamp,
    fillTemplate,
    resolveMessageAccentColor,
} from "../../../src/domain/discord-messages/format"
import { getClanDiscordMessages } from "../../../src/lib/clan-language"
import { buildAttendanceReminderComponents } from "../message-builders"
import { ATTENDANCE_OFFSETS_HOURS } from "../constants"
import { buildDiscordMessageLink } from "../utils"
import { convex, references } from "../convex"
import type { SyncPayload } from "../types"
import { logInfo, logWarn } from "../log"
import { env } from "../environment"

type RosterAssignment = {
    squadName: string
    roleName?: string
    note?: string
}

/**
 * Attendance reminder DM in the clan language and accent colour: event and
 * start, meeting time, the player's squad and role, notes and a link back to
 * the event card. It never carries the server password.
 */
export function buildAttendanceReminderMessage(input: {
    eventName: string
    meetingStartMs: number
    gameStartMs?: number
    eventMessageUrl?: string
    assignment?: RosterAssignment
    messages: ReturnType<typeof getClanDiscordMessages>
    accentColor?: number
}) {
    const { messages } = input
    const start = discordTimestamp(input.gameStartMs, "t")
    const startRelative = discordTimestamp(input.gameStartMs, "R")
    const meeting = discordTimestamp(input.meetingStartMs, "t")
    const assignment = input.assignment
        ? [input.assignment.squadName, input.assignment.roleName]
              .map((part) => part?.trim())
              .filter(Boolean)
              .join(" · ")
        : ""
    const summary = [
        start
            ? `${messages.reminders.start} ${start}${startRelative ? ` (${startRelative})` : ""}`
            : undefined,
        meeting
            ? fillTemplate(messages.embed.meetingAt, { time: meeting })
            : undefined,
        assignment ? `**${escapeMarkdown(assignment)}**` : undefined,
    ].filter(Boolean)
    const summaryLine = summary.join(" · ")
    const note = input.assignment?.note?.trim()
    const lines = [
        summaryLine
            ? summaryLine[0]!.toLocaleUpperCase(messages.locale) +
              summaryLine.slice(1)
            : undefined,
        note ? `${messages.reminders.notes}: ${escapeMarkdown(note)}` : null,
        input.eventMessageUrl
            ? `${messages.reminders.eventThread}: [${messages.reminders.openInDiscord}](${input.eventMessageUrl})`
            : null,
    ].filter((line): line is string => Boolean(line))

    const embed = new EmbedBuilder()
        .setColor(input.accentColor ?? DEFAULT_MESSAGE_ACCENT_COLOR)
        .setTitle(
            fillTemplate(messages.reminders.upcomingTitle, {
                event: input.eventName,
            }).slice(0, 256)
        )
        .setFooter({ text: messages.reminders.upcomingHint })
    if (lines.length) embed.setDescription(lines.join("\n").slice(0, 4096))
    return embed
}

export async function processAttendanceReminders(
    client: Client,
    queuedEventIds: Set<string>,
    payload: SyncPayload,
    dueEventIds: ReadonlySet<string>
) {
    const guild = await client.guilds
        .fetch(payload.config.guildId)
        .catch(() => null)
    if (!guild) {
        logWarn(
            "attendance-reminders",
            "Skipping attendance reminders because guild could not be fetched",
            {
                guildId: payload.config.guildId,
            }
        )
        return
    }

    for (const event of payload.events) {
        if (!dueEventIds.has(event.id)) continue
        if (event.status !== "starting") continue

        const roster = payload.rosters.find(
            (item) => item.eventId === event.id && item.published
        )
        if (!roster) {
            logInfo(
                "attendance-reminders",
                "Skipping reminders because no published roster exists",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                }
            )
            continue
        }

        const syncState = payload.syncStates.find(
            (item) => item.eventId === event.id
        )
        const meetingStartMs = new Date(event.meetingStart).getTime()
        if (!Number.isFinite(meetingStartMs)) {
            logWarn(
                "attendance-reminders",
                "Skipping reminders because meeting start is invalid",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                    meetingStart: event.meetingStart,
                }
            )
            continue
        }

        const messages = getClanDiscordMessages(payload.config.defaultLanguage)
        const matchType = event.matchType?.trim().toLowerCase()
        const accentColor = resolveMessageAccentColor({
            messageStyle: payload.config.messageStyle,
            categoryColor: matchType
                ? payload.guild.eventCategories?.find(
                      (category) =>
                          category.id.trim().toLowerCase() === matchType
                  )?.color
                : undefined,
        })
        const assignmentsByUserId = new Map<string, RosterAssignment>()
        for (const squad of roster.squads) {
            for (const player of squad.players) {
                if (player.id && !player.ack) {
                    assignmentsByUserId.set(player.id, {
                        squadName: squad.name,
                        roleName: player.roleName,
                        note: player.note,
                    })
                }
            }
        }
        const reserveAttendanceByUserId = new Map(
            (roster.reserveAttendances ?? []).map((attendance) => [
                attendance.userId,
                attendance,
            ])
        )
        for (const userId of roster.reservePlayerIds) {
            if (reserveAttendanceByUserId.get(userId)?.ack) continue
            assignmentsByUserId.set(userId, {
                squadName: messages.assignment.reserveTitle,
            })
        }
        const unacknowledgedUserIds = new Set(assignmentsByUserId.keys())
        if (!unacknowledgedUserIds.size) {
            logInfo(
                "attendance-reminders",
                "Skipping reminders because everyone already acknowledged attendance",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                }
            )
            continue
        }

        const now = Date.now()
        const remindersToLog: Array<{
            userId: string
            offsetHours: number
            sentAt: string
        }> = []
        const eventMessageUrl =
            buildDiscordMessageLink(
                payload.config.guildId,
                event.eventInfoChannelId ?? payload.config.eventInfoChannelId,
                syncState?.eventInfoMessageId
            ) ??
            buildDiscordMessageLink(
                payload.config.guildId,
                syncState?.announcementChannelId,
                syncState?.announcementMessageId
            ) ??
            buildDiscordMessageLink(
                payload.config.guildId,
                syncState?.forumChannelId,
                syncState?.infoMessageId
            )
        for (const userId of unacknowledgedUserIds) {
            const dueOffsets = ATTENDANCE_OFFSETS_HOURS.filter(
                (offsetHours) =>
                    now >= meetingStartMs - offsetHours * 60 * 60 * 1000
            )
                .filter(
                    (offsetHours) =>
                        !event.attendanceReminderLog.some(
                            (entry) =>
                                entry.userId === userId &&
                                entry.offsetHours === offsetHours
                        )
                )
                .sort((left, right) => left - right)

            const offsetHours = dueOffsets[0]
            if (offsetHours === undefined) continue

            const user = await client.users.fetch(userId).catch(() => null)
            if (!user) continue

            const sentAt = new Date().toISOString()
            const message = buildAttendanceReminderMessage({
                eventName: event.name,
                meetingStartMs,
                gameStartMs: Date.parse(event.gameStart),
                eventMessageUrl: eventMessageUrl ?? undefined,
                assignment: assignmentsByUserId.get(userId),
                messages,
                accentColor,
            })

            try {
                await user.send({
                    embeds: [message],
                    allowedMentions: { parse: [] },
                    components: buildAttendanceReminderComponents(
                        event.id,
                        payload.config.defaultLanguage
                    ),
                })
                logInfo("attendance-reminders", "Sent attendance reminder", {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                    userId,
                    offsetHours,
                })
            } catch {
                continue
            }

            remindersToLog.push({ userId, offsetHours, sentAt })
        }

        if (remindersToLog.length) {
            await convex.mutation(references.appendAttendanceReminderLog, {
                secret: env.internalSecret,
                eventId: event.id as never,
                reminders: remindersToLog,
            })
            queuedEventIds.add(event.id)
            logInfo(
                "attendance-reminders",
                "Logged attendance reminders and re-queued event",
                {
                    eventId: event.id,
                    guildId: payload.config.guildId,
                    reminderCount: remindersToLog.length,
                }
            )
        }
    }
}
