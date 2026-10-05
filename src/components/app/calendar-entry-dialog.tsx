"use client"

import { useState, type ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Trash2 } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    getCalendarEntryTiles,
    InfoTile,
} from "@/components/app/calendar-entry-tiles"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { EventSignupActions } from "@/components/app/event-signup-actions"
import type { CalendarDisplayEntry } from "@/lib/calendar-entries"
import { getClanDiscordMessages } from "@/lib/clan-language"
import { getSignupDisplayLabel } from "@/lib/event-signup"
import { EmojiValue } from "@/components/app/emoji-value"
import type { Dictionary } from "@/i18n/dictionaries"
import { toIntlLocale } from "@/lib/intl-locale"
import { Button } from "@/components/ui/button"
import { formatDateTime } from "@/lib/format"
import type { Group } from "@/types/domain"
import type { Locale } from "@/i18n/config"

export function CalendarEntryDialog({
    trigger,
    locale,
    serverId,
    entry,
    groups,
    timezone,
    dictionary,
    signupLanguage,
    currentUserId,
    canAdmin = false,
}: {
    trigger: ReactNode
    locale: Locale
    serverId: string
    entry: CalendarDisplayEntry
    groups: Group[]
    timezone?: string
    dictionary: Dictionary
    signupLanguage: "en" | "cs" | "de"
    currentUserId?: string
    canAdmin?: boolean
}) {
    const router = useRouter()
    const [open, setOpen] = useState(false)
    const currentSignup =
        entry.kind === "event"
            ? entry.event.signUps.find(
                  (signup) => signup.userId === currentUserId
              )
            : undefined
    const signupMessages = getClanDiscordMessages(signupLanguage)
    const detailPath =
        entry.kind === "event"
            ? `/${locale}/dashboard/servers/${serverId}/${entry.event.kind === "training" ? "trainings" : "matches"}/${entry.event.id}`
            : null
    const intlLocale = toIntlLocale(locale)
    const tiles = getCalendarEntryTiles(entry, dictionary, (value) =>
        formatDateTime(value, timezone, intlLocale)
    )

    async function deleteManualItem() {
        if (entry.kind !== "manual") return false
        const response = await fetch(
            `/api/servers/${serverId}/calendar-items/${encodeURIComponent(entry.item.id)}`,
            { method: "DELETE" }
        ).catch(() => null)
        if (!response?.ok) {
            toast.error(dictionary.calendarPage.itemDeleteFailed)
            return false
        }
        toast.success(dictionary.calendarPage.itemDeleted)
        setOpen(false)
        router.refresh()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-h-[90dvh] max-w-2xl overflow-y-auto rounded-2xl">
                <DialogHeader className="pr-8">
                    <div className="flex flex-col items-start gap-3 sm:flex-row sm:justify-between sm:gap-4">
                        <div className="min-w-0 space-y-2">
                            {entry.label ? (
                                <div
                                    className="inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium"
                                    style={{
                                        borderColor: `${entry.color}66`,
                                        backgroundColor: `${entry.color}14`,
                                        color: entry.color,
                                    }}
                                >
                                    <EmojiValue value={entry.emoji} />
                                    <span>{entry.label}</span>
                                </div>
                            ) : null}
                            <DialogTitle className="break-words">
                                {entry.title}
                            </DialogTitle>
                            <DialogDescription className="break-words">
                                {entry.description ||
                                    dictionary.event.listDescription}
                            </DialogDescription>
                        </div>
                        {detailPath ? (
                            <Button asChild className="shrink-0 rounded-xl">
                                <Link href={detailPath}>
                                    {dictionary.common.viewDetails}
                                </Link>
                            </Button>
                        ) : null}
                    </div>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-2">
                    {tiles.map((tile) => (
                        <InfoTile
                            key={tile.key}
                            label={tile.label}
                            value={tile.value}
                        />
                    ))}
                </div>

                {entry.kind === "event" ? (
                    <div className="space-y-2">
                        <div className="text-sm font-medium">
                            {dictionary.common.actions}
                        </div>
                        {currentSignup ? (
                            <p className="text-muted-foreground text-sm">
                                {dictionary.event.signupStatusSignedUpAs.replace(
                                    "{type}",
                                    currentSignup.group
                                        ? getSignupDisplayLabel(
                                              currentSignup.group,
                                              signupMessages.buttons
                                          )
                                        : dictionary.event.signupStatusGeneral
                                )}
                            </p>
                        ) : entry.event.participants.some(
                              (participant) =>
                                  participant.userId === currentUserId &&
                                  participant.status === "not_attending"
                          ) ? (
                            <p className="text-muted-foreground text-sm">
                                {dictionary.event.signupStatusDeclined}
                            </p>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {dictionary.event.signupStatusNotSignedUp}
                            </p>
                        )}
                        <EventSignupActions
                            serverId={serverId}
                            event={entry.event}
                            groups={groups}
                            signupLanguage={signupLanguage}
                        />
                    </div>
                ) : canAdmin ? (
                    <div className="flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-muted-foreground text-sm">
                            {dictionary.calendarPage.manualItemAdminHint}
                        </p>
                        <ConfirmActionDialog
                            trigger={
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    className="shrink-0 rounded-xl"
                                >
                                    <Trash2 className="size-4" />
                                    {dictionary.calendarPage.deleteItem}
                                </Button>
                            }
                            title={dictionary.calendarPage.deleteItemTitle.replace(
                                "{title}",
                                entry.title
                            )}
                            description={
                                dictionary.calendarPage.deleteItemDescription
                            }
                            confirmLabel={dictionary.calendarPage.deleteItem}
                            cancelLabel={dictionary.common.cancel}
                            onConfirm={deleteManualItem}
                        >
                            {entry.item.recurrence ? (
                                <p className="text-sm">
                                    {
                                        dictionary.calendarPage
                                            .deleteRecurringNote
                                    }
                                </p>
                            ) : null}
                        </ConfirmActionDialog>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}
