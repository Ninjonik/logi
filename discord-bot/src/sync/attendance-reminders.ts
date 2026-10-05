import type { Client, Guild } from "discord.js"

import {
    attendanceReminderView,
    type DmPlace,
} from "../../../src/domain/discord-messages/direct-message-views"
import {
    matchTitle,
    playerName,
} from "../../../src/domain/discord-messages/match-text"
import { resolveAttendanceReminderHours } from "../../../src/domain/events/scheduled-job-policy"
import { getDirectMessages } from "../../../src/lib/clan-language/direct-messages"
import { findSquadLeader } from "../../../src/domain/discord-messages/format"
import type { EventRecord, Roster, SyncPayload } from "../types"
import { dmFrame, memberNames } from "../events/match-context"
import { messagePayload } from "../ui/message-kit"
import { convex, references } from "../convex"
import { logInfo, logWarn } from "../log"
import { env } from "../environment"

/**
 * Where each rostered player plays, for the attendance reminder: the squad,
 * the role and the squad's leader, or the reserves. Only players who have
 * not confirmed are listed unless `includeAcknowledged`.
 */
export function rosterPlaces(
    roster: Roster,
    names: Readonly<Record<string, string>>,
    options: { includeAcknowledged?: boolean } = {}
) {
    const places = new Map<string, DmPlace>()
    for (const squad of roster.squads) {
        const leader = findSquadLeader(squad.players)
        for (const player of squad.players) {
            if (!player.id || (player.ack && !options.includeAcknowledged))
                continue
            places.set(player.id, {
                kind: "squad",
                squad: squad.name,
                role: player.roleName?.trim() || undefined,
                leader:
                    leader && leader !== player
                        ? playerName(leader, names)
                        : undefined,
            })
        }
    }
    const acknowledged = new Map(
        (roster.reserveAttendances ?? []).map((item) => [item.userId, item.ack])
    )
    for (const userId of roster.reservePlayerIds) {
        if (places.has(userId)) continue
        if (acknowledged.get(userId) && !options.includeAcknowledged) continue
        places.set(userId, { kind: "reserve" })
    }
    return places
}

/** Squad leaders' names for the reminder line "velitel čety Rex_CZ". */
export async function leaderNames(
    guild: Guild | null | undefined,
    roster: Roster,
    known: Readonly<Record<string, string>>
) {
    return await memberNames(
        guild,
        roster.squads.flatMap((squad) => {
            const leader = findSquadLeader(squad.players)
            return leader?.id ? [leader.id] : []
        }),
        known
    )
}

/**
 * The attendance reminder DM (board L2-16..27): "Zítra hraješ VLK vs ROG"
 * with the weekday schedule, the player's place and leader, and
 * "Potvrdím", "Přijdu později", "Nemůžu". It never carries the server
 * password. A manual reminder from the match page says so.
 */
export function buildAttendanceReminderDm(input: {
    payload: Pick<SyncPayload, "config" | "guild">
    event: EventRecord
    place?: DmPlace
    now: number
    sentByLeaders?: boolean
}) {
    const { config, guild } = input.payload
    return messagePayload(
        attendanceReminderView({
            event: {
                id: input.event.id,
                title: matchTitle(input.event),
                meetingStart: input.event.meetingStart,
                gameStart: input.event.gameStart,
            },
            place: input.place,
            now: input.now,
            sentByLeaders: input.sentByLeaders,
            copy: getDirectMessages(config.defaultLanguage),
            frame: dmFrame(config, guild.name),
        }),
        { language: config.defaultLanguage, style: config.messageStyle }
    )
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

        const assignmentsByUserId = rosterPlaces(
            roster,
            await leaderNames(guild, roster, payload.userDisplayNames)
        )
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
            try {
                await user.send(
                    buildAttendanceReminderDm({
                        payload,
                        event,
                        place: assignmentsByUserId.get(userId),
                        now: Date.now(),
                    })
                )
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
