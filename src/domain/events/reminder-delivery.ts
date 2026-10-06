import type { ManualReminderAudience } from "./manual-reminders"

/**
 * The last finished reminder of a match, as Convex reports it: one an admin
 * sent, or a scheduled sign-up or attendance reminder (`automatic`, L2-64).
 */
export type ManualReminderOutcome = {
    /** A scheduled reminder; older Convex answers omit it. */
    automatic?: boolean
    audience: ManualReminderAudience
    status: "sent" | "failed"
    requestedAt: string
    completedAt: string | null
    /** Discord ID of the admin who sent it; null for a scheduled reminder. */
    requestedBy: string | null
    recipientCount: number
    sentCount: number
    /** Players whose DMs Discord refused (closed DMs, blocked bot). */
    failedUserIds: string[]
}

/** At most this many players are kept per scheduled reminder run. */
export const AUTOMATIC_REMINDER_PLAYER_LIMIT = 500

/** One stored run of a scheduled sign-up or attendance reminder (L2-64). */
export type AutomaticReminderRun = {
    kind: "signup" | "attendance"
    /** When the last pass of the run finished. */
    sentAt: string
    /** Everyone the run tried to reach. */
    recipientIds: string[]
    /** Who it has not reached yet. */
    failedUserIds: string[]
}

/**
 * The run after one more pass: everyone tried so far, and who is still
 * missed. A player a later pass reached (opened DMs) is no longer missed.
 */
export function mergeAutomaticReminderRun(
    previous: Pick<
        AutomaticReminderRun,
        "recipientIds" | "failedUserIds"
    > | null,
    pass: { sentUserIds: readonly string[]; failedUserIds: readonly string[] },
    limit = AUTOMATIC_REMINDER_PLAYER_LIMIT
): Pick<AutomaticReminderRun, "recipientIds" | "failedUserIds"> {
    const reached = new Set(pass.sentUserIds)
    return {
        recipientIds: [
            ...new Set([
                ...(previous?.recipientIds ?? []),
                ...pass.sentUserIds,
                ...pass.failedUserIds,
            ]),
        ].slice(0, limit),
        failedUserIds: [
            ...new Set([
                ...(previous?.failedUserIds ?? []),
                ...pass.failedUserIds,
            ]),
        ]
            .filter((id) => !reached.has(id))
            .slice(0, limit),
    }
}

/** A scheduled run as the outcome the match page reads; nobody sent it. */
export function automaticReminderOutcome(
    run: AutomaticReminderRun
): ManualReminderOutcome {
    return {
        automatic: true,
        audience: run.kind === "signup" ? "unanswered" : "unconfirmed",
        status: "sent",
        requestedAt: run.sentAt,
        completedAt: run.sentAt,
        requestedBy: null,
        recipientCount: run.recipientIds.length,
        sentCount: Math.max(
            0,
            run.recipientIds.length - run.failedUserIds.length
        ),
        failedUserIds: run.failedUserIds,
    }
}

/**
 * The newest finished reminder within the window, manual or scheduled:
 * the match page shows one notice, about the last reminder that went out.
 */
export function newestReminderOutcome(
    outcomes: ReadonlyArray<ManualReminderOutcome | null>,
    now: number,
    windowMs: number
): ManualReminderOutcome | null {
    let newest: { outcome: ManualReminderOutcome; at: number } | null = null
    for (const outcome of outcomes) {
        if (!outcome) continue
        const at = Date.parse(outcome.completedAt ?? outcome.requestedAt)
        if (!Number.isFinite(at) || now - at >= windowMs) continue
        if (!newest || at > newest.at) newest = { outcome, at }
    }
    return newest?.outcome ?? null
}

/**
 * What the match page tells the admin about a reminder (board L2-60..62,
 * L2-B14): which players it did not reach, or that it was not sent at all.
 * A reminder that reached everyone needs no notice.
 */
export type ReminderDeliveryNotice =
    | {
          kind: "partial"
          automatic: boolean
          audience: ManualReminderAudience
          sent: number
          total: number
          failedUserIds: string[]
          sentAt: string
          requestedBy: string | null
      }
    | {
          kind: "failed"
          automatic: boolean
          audience: ManualReminderAudience
          sentAt: string
          requestedBy: string | null
      }

export function reminderDeliveryNotice(
    outcome: ManualReminderOutcome | null
): ReminderDeliveryNotice | null {
    if (!outcome) return null
    const sentAt = outcome.completedAt ?? outcome.requestedAt
    const automatic = outcome.automatic === true
    if (outcome.status === "failed") {
        return {
            kind: "failed",
            automatic,
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
        automatic,
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
