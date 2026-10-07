import type { Client } from "discord.js"

import {
    deliverManualReminder,
    discordDmSender,
    manualReminderNames,
    type ClaimedManualReminder,
} from "./sync/manual-reminders"
import { logError, logInfo, logWarn } from "./log"
import { convex, references } from "./convex"
import type { SyncPayload } from "./types"
import { env } from "./environment"

type PendingReminder = { id: string; eventId: string; guildId: string }

/**
 * Sends the reminder DMs clan admins ask for from the dashboard. Convex keeps
 * the queue; this service watches its pending rows, claims one at a time,
 * sends the DMs and records the outcome, so a reminder is sent once even when
 * the watch fires repeatedly.
 */
export class ManualReminderRequestService {
    private unsubscribe?: () => void
    private readonly processing = new Set<string>()

    constructor(
        private readonly client: Client,
        private readonly loadEventPayload: (
            eventId: string
        ) => Promise<SyncPayload | null>
    ) {}

    async start() {
        const watch = convex.watchQuery(references.listPendingManualReminders, {
            secret: env.internalSecret,
        })
        this.unsubscribe = watch.onUpdate(() => {
            let pending: PendingReminder[] | undefined
            try {
                pending = watch.localQueryResult() as
                    PendingReminder[] | undefined
            } catch (error) {
                // The query failed, for example before the backend deploy.
                logWarn(
                    "manual-reminders",
                    "Could not read pending reminders",
                    {
                        error,
                    }
                )
                return
            }
            if (pending) void this.processAll(pending)
        })
        const pending = (await convex.query(
            references.listPendingManualReminders,
            { secret: env.internalSecret }
        )) as PendingReminder[]
        await this.processAll(pending)
        logInfo("manual-reminders", "Started manual reminder requests")
    }

    stop() {
        this.unsubscribe?.()
    }

    private async processAll(pending: PendingReminder[]) {
        for (const reminder of pending) {
            if (this.processing.has(reminder.id)) continue
            this.processing.add(reminder.id)
            try {
                await this.process(reminder)
            } finally {
                this.processing.delete(reminder.id)
            }
        }
    }

    private async process(reminder: PendingReminder) {
        let claimed: ClaimedManualReminder | null
        try {
            claimed = (await convex.mutation(references.claimManualReminder, {
                secret: env.internalSecret,
                requestId: reminder.id,
            })) as ClaimedManualReminder | null
        } catch (error) {
            logError("manual-reminders", "Failed to claim a reminder", {
                requestId: reminder.id,
                error,
            })
            return
        }
        if (!claimed) return

        try {
            const payload = await this.loadEventPayload(claimed.eventId)
            if (!payload) throw new Error("Match context is not available.")
            const delivery = await deliverManualReminder({
                payload,
                request: claimed,
                send: discordDmSender(this.client, claimed.eventId),
                names: await manualReminderNames(
                    this.client,
                    payload,
                    claimed.eventId
                ),
            })
            const sentCount = delivery.sent
            // Closed DMs are shown on the match page, never as a bot error.
            await convex.mutation(references.completeManualReminder, {
                secret: env.internalSecret,
                requestId: claimed.id,
                sentCount,
                failedUserIds: delivery.failedUserIds,
            })
            logInfo("manual-reminders", "Sent manual reminders", {
                eventId: claimed.eventId,
                guildId: claimed.guildId,
                audience: claimed.audience,
                recipients: claimed.recipientIds.length,
                sentCount,
            })
        } catch (error) {
            logWarn("manual-reminders", "Manual reminder failed", {
                requestId: claimed.id,
                eventId: claimed.eventId,
                error,
            })
            await convex
                .mutation(references.failManualReminder, {
                    secret: env.internalSecret,
                    requestId: claimed.id,
                    // A code the match page words in the dashboard language.
                    error: "send_failed",
                })
                .catch((failure) =>
                    logError(
                        "manual-reminders",
                        "Failed to record a reminder failure",
                        { error: failure }
                    )
                )
        }
    }
}
