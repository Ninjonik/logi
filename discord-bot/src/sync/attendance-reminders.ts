import { EmbedBuilder, escapeMarkdown, type Client } from "discord.js"

import {
    DEFAULT_MESSAGE_ACCENT_COLOR,
    discordTimestamp,
    fillTemplate,
    resolveMessageAccentColor,
} from "../../../src/domain/discord-messages/format"
import { resolveAttendanceReminderHours } from "../../../src/domain/events/scheduled-job-policy"
import { calendarDayOffset } from "../../../src/domain/discord-messages/calendar-day"
import { getClanDiscordMessages } from "../../../src/lib/clan-language"
import { buildAttendanceReminderComponents } from "../message-builders"
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
 * Attendance reminder DM in the clan language and accent colour: "You play X
 * tomorrow" (today, or without a day when it is further away), the start,
 * meeting time, the player's squad and role, and their roster note. It never
 * carries the server password.
 */
export function buildAttendanceReminderMessage(input: {
    eventName: string
    meetingStartMs: number
    gameStartMs?: number
    assignment?: RosterAssignment
    messages: ReturnType<typeof getClanDiscordMessages>
    accentColor?: number
    /** When the DM is sent and the clan's time zone, for "today"/"tomorrow". */
    now?: number
    timeZone?: string
}) {
    const { messages } = input
    const start = discordTimestamp(input.gameStartMs, "t")
    const meeting = discordTimestamp(input.meetingStartMs, "t")
    const assignment = input.assignment
        ? [input.assignment.squadName, input.assignment.roleName]
              .map((part) => part?.trim())
              .filter(Boolean)
              .join(" · ")
        : ""
    const summary = [
        start ? `${messages.reminders.start} ${start}` : undefined,
        meeting
            ? fillTemplate(messages.embed.meetingAt, { time: meeting })
            : undefined,
        assignment ? escapeMarkdown(assignment) : undefined,
    ].filter(Boolean)
    const summaryLine = summary.join(" · ")
    const note = input.assignment?.note?.trim()
    const lines = [
        summaryLine
            ? summaryLine[0]!.toLocaleUpperCase(messages.locale) +
              summaryLine.slice(1)
            : undefined,
        note ? `${messages.reminders.notes}: ${escapeMarkdown(note)}` : null,
    ].filter((line): line is string => Boolean(line))

    const day =
        input.now === undefined
            ? undefined
            : calendarDayOffset(
                  input.gameStartMs ?? input.meetingStartMs,
                  input.now,
                  input.timeZone ?? "UTC"
              )
    const titleTemplate =
        day === 0
            ? messages.reminders.upcomingTitleToday
            : day === 1
              ? messages.reminders.upcomingTitleTomorrow
              : messages.reminders.upcomingTitle
    const embed = new EmbedBuilder()
        .setColor(input.accentColor ?? DEFAULT_MESSAGE_ACCENT_COLOR)
        .setTitle(
            fillTemplate(titleTemplate, {
                event: input.eventName,
            }).slice(0, 256)
        )
        .setFooter({ text: messages.reminders.upcomingHint })
    if (lines.length) embed.setDescription(lines.join("\n").slice(0, 4096))
    return embed
}

/** Players who already told the organisers they cannot come or are late. */
export function playersWithAbsenceNotice(event: {
    absenceNotices?: Array<{ userId: string }>
}) {
    return new Set((event.absenceNotices ?? []).map((notice) => notice.userId))
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
        // A player who already declined or sent a notice has answered.
        const noticed = playersWithAbsenceNotice(event)
        const unacknowledgedUserIds = new Set(
            [...assignmentsByUserId.keys()].filter(
                (userId) => !noticed.has(userId)
            )
        )
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
        for (const userId of unacknowledgedUserIds) {
            // Only the offsets the match chose (all four on older events).
            const dueOffsets = resolveAttendanceReminderHours(
                event.attendanceReminderHours
            )
                .filter(
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
                assignment: assignmentsByUserId.get(userId),
                messages,
                accentColor,
                now: Date.now(),
                timeZone: payload.config.timezone,
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
