"use client"

import { AlertTriangle, Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import type { ReminderDeliveryNoticeView } from "@/lib/read-models/reminder-delivery"
import { joinNames } from "@/domain/events/reminder-delivery"
import { formatListDate } from "@/lib/match-list-format"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

/** Discord's help page for "Allow direct messages from server members". */
export const DISCORD_SERVER_DM_HELP_URL =
    "https://support.discord.com/hc/articles/217916488"

function fill(template: string, values: Record<string, string | number>) {
    return template.replace(/\{(\w+)\}/g, (match, key: string) =>
        key in values ? String(values[key]) : match
    )
}

/**
 * "Připomínka došla 9 z 12 hráčů" on the match overview (board L2-60..62,
 * L2-64, L2-B14): which players a manual or scheduled reminder did not
 * reach because their DMs are closed, a button that copies their names and a link to Discord's help.
 * When the send failed as a whole it says so instead. Admins only.
 */
export function ReminderDeliveryNotice({
    notice,
    copy,
    errorLabel,
    clanName,
    locale,
    timeZone,
}: {
    notice: ReminderDeliveryNoticeView
    copy: Dictionary["reminderDelivery"]
    errorLabel: string
    clanName: string
    locale: string
    timeZone: string
}) {
    const names = notice.failedNames.map((name) => name ?? copy.unknownPlayer)
    const sentAt = formatListDate(notice.sentAt, locale, timeZone)
    // A scheduled reminder has no sender (L2-64).
    const meta = fill(notice.automatic ? copy.metaAutomatic : copy.meta, {
        kind:
            notice.audience === "unconfirmed"
                ? copy.kindUnconfirmed
                : copy.kindUnanswered,
        time: fill(copy.sentAt, { date: sentAt.date, time: sentAt.time }),
        name: notice.senderName ?? copy.unknownSender,
    })

    async function copyNames() {
        try {
            await navigator.clipboard.writeText(names.join(", "))
            toast.success(copy.copied)
        } catch {
            toast.error(errorLabel)
        }
    }

    return (
        <section className="space-y-2" aria-label={meta}>
            <div
                role="status"
                className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-amber-950 dark:text-amber-100"
            >
                <div className="flex gap-3">
                    <AlertTriangle
                        className="mt-0.5 size-5 shrink-0"
                        aria-hidden="true"
                    />
                    <div className="min-w-0 space-y-2">
                        <p className="font-semibold">
                            {notice.kind === "partial"
                                ? fill(copy.title, {
                                      sent: notice.sent,
                                      total: notice.total,
                                  })
                                : copy.failedAll}
                        </p>
                        {notice.kind === "partial" ? (
                            <>
                                <p className="text-sm">
                                    {fill(
                                        names.length === 1
                                            ? copy.bodyOne
                                            : copy.body,
                                        {
                                            names: joinNames(names, copy.and),
                                            clan: clanName,
                                        }
                                    )}
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="rounded-xl bg-transparent"
                                        onClick={copyNames}
                                    >
                                        <Copy
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                        {copy.copyNames}
                                    </Button>
                                    <Button
                                        asChild
                                        variant="outline"
                                        size="sm"
                                        className="rounded-xl bg-transparent"
                                    >
                                        <a
                                            href={DISCORD_SERVER_DM_HELP_URL}
                                            target="_blank"
                                            rel="noreferrer"
                                        >
                                            {copy.howTo}
                                            <ExternalLink
                                                className="size-3.5"
                                                aria-hidden="true"
                                            />
                                        </a>
                                    </Button>
                                </div>
                            </>
                        ) : null}
                    </div>
                </div>
            </div>
            <p className="text-muted-foreground text-xs">{meta}</p>
        </section>
    )
}
