import { makeFunctionReference } from "convex/server"

import { env } from "../environment"
import { convex } from "../convex"
import { logWarn } from "../log"

/**
 * Who one scheduled reminder run reached (board L2-64): the match page then
 * names the players whose DMs are closed, as it does for a manual reminder.
 * `runKey` groups the passes of one run: the sign-up day, or the attendance
 * offset.
 */
export type AutomaticReminderOutcome = {
    guildId: string
    eventId: string
    kind: "signup" | "attendance"
    runKey: string
    sentUserIds: string[]
    failedUserIds: string[]
}

export type RecordAutomaticReminderOutcome = (
    outcome: AutomaticReminderOutcome
) => Promise<void>

const recordReference = makeFunctionReference<"mutation">(
    "eventReminders:recordAutomatic"
)

/** Stores one run's outcome; a failed write is logged and never thrown. */
export const recordAutomaticReminderOutcome: RecordAutomaticReminderOutcome =
    async (outcome) => {
        if (!outcome.sentUserIds.length && !outcome.failedUserIds.length) return
        await convex
            .mutation(recordReference, {
                secret: env.internalSecret,
                ...outcome,
            })
            .then(() => undefined)
            .catch((error: unknown) =>
                logWarn(
                    "reminders",
                    "Failed to record a scheduled reminder outcome",
                    {
                        guildId: outcome.guildId,
                        eventId: outcome.eventId,
                        kind: outcome.kind,
                        error,
                    }
                )
            )
    }

/** The sign-up reminder's run: one per calendar day (UTC). */
export const signupReminderRunKey = (now: number) =>
    new Date(now).toISOString().slice(0, 10)

/** The attendance reminder's run: its offset before the meeting. */
export const attendanceReminderRunKey = (offsetHours: number) =>
    `${offsetHours}h`
