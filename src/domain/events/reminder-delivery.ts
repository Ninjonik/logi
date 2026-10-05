import type { ManualReminderAudience } from "./manual-reminders"

/** The last finished manual reminder of a match, as Convex reports it. */
export type ManualReminderOutcome = {
    audience: ManualReminderAudience
    status: "sent" | "failed"
    requestedAt: string
    completedAt: string | null
    /** Discord ID of the admin who sent it. */
    requestedBy: string
    recipientCount: number
    sentCount: number
    /** Players whose DMs Discord refused (closed DMs, blocked bot). */
    failedUserIds: string[]
}

/**
 * What the match page tells the admin about a reminder (board L2-60..62,
 * L2-B14): which players it did not reach, or that it was not sent at all.
 * A reminder that reached everyone needs no notice.
 */
export type ReminderDeliveryNotice =
    | {
          kind: "partial"
          audience: ManualReminderAudience
          sent: number
          total: number
          failedUserIds: string[]
          sentAt: string
          requestedBy: string
      }
    | {
          kind: "failed"
          audience: ManualReminderAudience
          sentAt: string
          requestedBy: string
      }

export function reminderDeliveryNotice(
    outcome: ManualReminderOutcome | null
): ReminderDeliveryNotice | null {
    if (!outcome) return null
    const sentAt = outcome.completedAt ?? outcome.requestedAt
    if (outcome.status === "failed") {
        return {
            kind: "failed",
            audience: outcome.audience,
            sentAt,
            requestedBy: outcome.requestedBy,
        }
    }
    const failedUserIds = [...new Set(outcome.failedUserIds)]
    if (failedUserIds.length === 0) return null
    const total = Math.max(outcome.recipientCount, failedUserIds.length)
    return {
        kind: "partial",
        audience: outcome.audience,
        sent: Math.min(outcome.sentCount, total - failedUserIds.length),
        total,
        failedUserIds,
        sentAt,
        requestedBy: outcome.requestedBy,
    }
}

/** "Mrak, Ježek a Liška": names joined with the language's "and". */
export function joinNames(names: readonly string[], and: string) {
    if (names.length <= 1) return names.join("")
    return `${names.slice(0, -1).join(", ")} ${and} ${names[names.length - 1]}`
}
