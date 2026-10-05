"use client"

import { Bell, Check } from "lucide-react"
import { useLocale } from "next-intl"
import { useState } from "react"
import { toast } from "sonner"

import { queuedReminders } from "@/components/app/clan-overview/reminder-response"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { pluralize } from "@/i18n/plural"

/**
 * "Remind N players" on the next match (design G1): after a confirmation the
 * bot sends a direct message to the members who have not answered yet. The
 * route decides who that is when it runs, so the toast reports how many
 * reminders were actually queued.
 */
export function RemindUnansweredButton({
    serverId,
    eventId,
    label,
    dictionary,
}: {
    serverId: string
    eventId: string
    /** "Remind 12 players", already in the reader's plural form. */
    label: string
    dictionary: Dictionary
}) {
    const text = dictionary.clanOverview.remind
    const locale = useLocale()
    const [sent, setSent] = useState(false)

    async function send() {
        let response: Response
        try {
            response = await fetch(
                `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(eventId)}/reminders`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ audience: "unanswered" }),
                }
            )
        } catch {
            toast.error(text.failed)
            return false
        }
        const queued = response.ok
            ? queuedReminders(await response.json().catch(() => null))
            : null
        if (queued === null) {
            toast.error(
                response.status === 429 ? text.rateLimited : text.failed
            )
            return false
        }
        setSent(true)
        toast.success(
            queued ? pluralize(locale, queued, text.sent) : text.nobody
        )
    }

    if (sent)
        return (
            <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled
            >
                <Check className="size-4" aria-hidden="true" />
                {text.done}
            </Button>
        )

    return (
        <ConfirmActionDialog
            trigger={
                <Button type="button" variant="outline" className="rounded-xl">
                    <Bell className="size-4" aria-hidden="true" />
                    {label}
                </Button>
            }
            title={text.confirmTitle}
            description={text.confirmDescription}
            confirmLabel={text.confirm}
            cancelLabel={text.cancel}
            destructive={false}
            onConfirm={send}
        />
    )
}
