"use client"

import { SquareCheckBig } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import type { RosterScoreChangeSummary } from "@/domain/events/score-policy"
import { eventWriteErrorMessage } from "@/lib/event-write-error"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

function formatDelta(delta: number) {
    // A real minus sign, as in the design.
    return delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0"
}

/**
 * Closes a match and awards its points (design K4): the dialog lists how many
 * members each attendance rule covers and the points it adds, before anything
 * irreversible happens.
 */
export function ConcludeEventButton({
    serverId,
    eventId,
    disabled,
    dictionary,
    summary,
    label,
    primary = false,
}: {
    serverId: string
    eventId: string
    disabled: boolean
    dictionary: Dictionary
    summary: RosterScoreChangeSummary
    /** Button text; defaults to the plain "conclude" action. */
    label?: string
    /** The main action of the page (design E3): filled, without an icon. */
    primary?: boolean
}) {
    const router = useRouter()
    const t = dictionary.matchDetail.close
    // Members who never answered and get no points are not news.
    const rows = summary.rows.filter(
        (row) => row.category !== "noCategory" || row.delta !== 0
    )

    async function conclude() {
        const response = await fetch(
            `/api/servers/${serverId}/events/${eventId}`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ action: "conclude" }),
            }
        )

        const body = await response.json().catch(() => null)
        if (!response.ok) {
            toast.error(
                eventWriteErrorMessage(body, {
                    forbidden: dictionary.event.writeForbidden,
                    fallback: dictionary.common.error,
                })
            )
            return false
        }

        toast.success(t.closed)
        router.refresh()
    }

    return (
        <ConfirmActionDialog
            trigger={
                <Button
                    variant={primary ? "default" : "outline"}
                    className="rounded-xl"
                    disabled={disabled}
                >
                    {primary ? null : <SquareCheckBig className="size-4" />}
                    {label ?? dictionary.event.conclude}
                </Button>
            }
            title={t.title}
            description={
                summary.changedCount > 0
                    ? t.description.replace(
                          "{count}",
                          String(summary.changedCount)
                      )
                    : t.descriptionNone
            }
            confirmLabel={t.confirm}
            cancelLabel={t.back}
            destructive={false}
            onConfirm={conclude}
        >
            {rows.length > 0 ? (
                <ul className="divide-border/60 border-border/60 divide-y rounded-xl border text-sm">
                    {rows.map((row) => (
                        <li
                            key={row.category}
                            className="flex items-center justify-between gap-3 px-3 py-2"
                        >
                            <span>
                                {t.categories[row.category].replace(
                                    "{count}",
                                    String(row.count)
                                )}
                            </span>
                            <span className="font-medium tabular-nums">
                                {formatDelta(row.delta)}
                            </span>
                        </li>
                    ))}
                </ul>
            ) : null}
        </ConfirmActionDialog>
    )
}
