"use client"

import type { ReactNode } from "react"
import Link from "next/link"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import { EventSignupActions } from "@/components/app/event-signup-actions"
import type { CalendarDisplayEntry } from "@/lib/calendar-entries"
import { formatHllPresetLabel } from "@/lib/hll-map-presets"
import { EmojiValue } from "@/components/app/emoji-value"
import { formatDateTime, formatTime } from "@/lib/format"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
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
}: {
    trigger: ReactNode
    locale: Locale
    serverId: string
    entry: CalendarDisplayEntry
    groups: Group[]
    timezone?: string
    dictionary: Dictionary
    signupLanguage: "en" | "cs" | "de"
}) {
    const detailPath =
        entry.kind === "event"
            ? `/${locale}/dashboard/servers/${serverId}/${entry.event.kind === "training" ? "trainings" : "matches"}/${entry.event.id}`
            : null

    return (
        <Dialog>
            <DialogTrigger asChild>{trigger}</DialogTrigger>
            <DialogContent className="max-w-2xl rounded-2xl">
                <DialogHeader className="pr-12">
                    <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2">
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
                            <DialogTitle>{entry.title}</DialogTitle>
                            <DialogDescription>
                                {entry.description ||
                                    dictionary.event.listDescription}
                            </DialogDescription>
                        </div>
                        {detailPath ? (
                            <Button asChild className="rounded-xl">
                                <Link href={detailPath}>
                                    {dictionary.common.viewDetails}
                                </Link>
                            </Button>
                        ) : null}
                    </div>
                </DialogHeader>

                <div className="grid gap-3 md:grid-cols-2">
                    <InfoTile
                        label={dictionary.calendarCards.meeting}
                        value={formatDateTime(entry.startAt, timezone)}
                    />
                    <InfoTile
                        label={dictionary.calendarCards.gameStart}
                        value={
                            entry.allDay
                                ? dictionary.calendarPage.allDay
                                : formatDateTime(entry.endAt, timezone)
                        }
                    />
                    {entry.kind === "event" ? (
                        <>
                            <InfoTile
                                label={
                                    dictionary.calendarCards.registrationEnds
                                }
                                value={formatDateTime(
                                    entry.event.registrationEnd,
                                    timezone
                                )}
                            />
                            <InfoTile
                                label={dictionary.calendarCards.map}
                                value={
                                    entry.event.kind === "training"
                                        ? entry.event.meetingChannelId ||
                                          "Discord"
                                        : `${formatHllPresetLabel(entry.event.map) ?? entry.event.map ?? "TBD"} • ${entry.event.side ?? "TBD"}`
                                }
                            />
                        </>
                    ) : (
                        <>
                            <InfoTile
                                label={
                                    dictionary.calendarCards.registrationEnds
                                }
                                value={
                                    entry.allDay
                                        ? dictionary.calendarPage.allDay
                                        : formatTime(entry.startAt, timezone)
                                }
                            />
                            <InfoTile
                                label={dictionary.calendarCards.map}
                                value={entry.label ?? dictionary.shared.notSet}
                            />
                        </>
                    )}
                </div>

                {entry.kind === "event" ? (
                    <div className="space-y-2">
                        <div className="text-sm font-medium">
                            {dictionary.common.actions}
                        </div>
                        <EventSignupActions
                            serverId={serverId}
                            event={entry.event}
                            groups={groups}
                            signupLanguage={signupLanguage}
                        />
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    )
}

function InfoTile({ label, value }: { label: string; value: string }) {
    return (
        <div className="border-border/60 rounded-xl border p-3">
            <div className="text-muted-foreground text-xs tracking-[0.2em] uppercase">
                {label}
            </div>
            <div className="mt-2 font-semibold">{value}</div>
        </div>
    )
}
