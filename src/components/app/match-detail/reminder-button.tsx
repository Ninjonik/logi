"use client"

import { Bell, Loader2 } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import type {
    ManualReminderAudience,
    ManualReminderUnavailable,
} from "@/domain/events/manual-reminders"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/** Who a reminder can reach now, as the match page computed it. */
export type ReminderAudienceState = {
    count: number
    unavailable: ManualReminderUnavailable | null
}

/**
 * "Připomenout" (designs D3 and E3): queues reminder DMs through
 * `POST /api/servers/{serverId}/events/{eventId}/reminders`. The bot sends
 * them; a repeated click while they are queued does not send twice.
 */
export function ReminderButton({
    serverId,
    eventId,
    audience,
    state,
    dictionary,
    className,
    label,
}: {
    serverId: string
    eventId: string
    audience: ManualReminderAudience
    state: ReminderAudienceState
    dictionary: Dictionary
    className?: string
    label?: string
}) {
    const t = dictionary.matchDetail.reminders
    const [sending, setSending] = useState(false)
    const disabledReason = state.unavailable
        ? t.unavailable[state.unavailable]
        : state.count === 0
          ? t.nobody
          : null

    async function remind() {
        setSending(true)
        try {
            const response = await fetch(
                `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(eventId)}/reminders`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ audience }),
                }
            )
            const body = (await response.json().catch(() => null)) as {
                queued?: number
                retryAt?: string
                reason?: ManualReminderUnavailable
            } | null
            if (response.ok && typeof body?.queued === "number") {
                toast.success(
                    body.queued > 0
                        ? t.queued.replace("{count}", String(body.queued))
                        : t.nobody
                )
                return
            }
            if (response.status === 429 && body?.retryAt) {
                toast.error(
                    t.rateLimited.replace(
                        "{time}",
                        new Intl.DateTimeFormat(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                        }).format(new Date(body.retryAt))
                    )
                )
                return
            }
            toast.error(
                body?.reason
                    ? t.unavailable[body.reason]
                    : dictionary.common.error
            )
        } catch {
            toast.error(dictionary.common.error)
        } finally {
            setSending(false)
        }
    }

    const button = (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn("h-8 rounded-lg px-2.5 text-xs", className)}
            onClick={remind}
            disabled={sending || Boolean(disabledReason)}
            title={disabledReason ?? undefined}
        >
            {sending ? (
                <Loader2 className="size-3.5 animate-spin" />
            ) : (
                <Bell className="size-3.5" />
            )}
            {sending ? t.sending : (label ?? t.remind)}
        </Button>
    )
    // A disabled button gets no pointer events; the wrapper keeps the reason
    // reachable by hover and focus.
    return disabledReason ? (
        <span tabIndex={0} title={disabledReason} className="inline-flex">
            {button}
        </span>
    ) : (
        button
    )
}
