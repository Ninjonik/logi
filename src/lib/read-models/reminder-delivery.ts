import { makeFunctionReference } from "convex/server"
import { fetchQuery } from "convex/nextjs"
import { z } from "zod"

import {
    reminderDeliveryNotice,
    type ManualReminderOutcome,
    type ReminderDeliveryNotice,
} from "@/domain/events/reminder-delivery"
import { MANUAL_REMINDER_AUDIENCES } from "@/domain/events/manual-reminders"
import { getUsersByIds } from "@/lib/server-user-management"
import { getInternalAuthSecret } from "@/lib/env"

const latestOutcomeReference = makeFunctionReference<"query">(
    "eventReminders:latestOutcome"
)

const outcomeSchema = z.object({
    audience: z.enum(MANUAL_REMINDER_AUDIENCES),
    status: z.enum(["sent", "failed"]),
    requestedAt: z.string(),
    completedAt: z.string().nullable(),
    requestedBy: z.string(),
    recipientCount: z.number().int().nonnegative(),
    sentCount: z.number().int().nonnegative(),
    failedUserIds: z.array(z.string()),
})

/** The notice with display names, ready for the match page. */
export type ReminderDeliveryNoticeView = ReminderDeliveryNotice & {
    /** Null for a player Logi has no name for. */
    failedNames: Array<string | null>
    senderName: string | null
}

/**
 * The last manual reminder of a match that did not reach everyone (board
 * L2-60..62). For clan admins: callers pass an event they found in the
 * admin's clan context and that clan's Discord guild ID, which Convex checks
 * against the event. Null when there is nothing to report or Convex cannot be
 * reached; the page then shows nothing.
 */
export async function getReminderDeliveryNotice(input: {
    guildId: string
    eventId: string
}): Promise<ReminderDeliveryNoticeView | null> {
    let outcome: ManualReminderOutcome | null
    try {
        const raw = await fetchQuery(latestOutcomeReference, {
            secret: getInternalAuthSecret(),
            guildId: input.guildId,
            eventId: input.eventId,
        })
        const parsed = outcomeSchema.nullable().safeParse(raw)
        if (!parsed.success) return null
        outcome = parsed.data
    } catch {
        return null
    }
    const notice = reminderDeliveryNotice(outcome)
    if (!notice) return null
    const failedUserIds = notice.kind === "partial" ? notice.failedUserIds : []
    const users = await getUsersByIds(
        [...new Set([...failedUserIds, notice.requestedBy])],
        input.guildId
    ).catch(() => [])
    const names = new Map(users.map((user) => [user.discordId, user.name]))
    return {
        ...notice,
        failedNames: failedUserIds.map((id) => names.get(id) ?? null),
        senderName: names.get(notice.requestedBy) ?? null,
    }
}
