"use client"

import { CalendarSync, Check, Copy } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"

import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { EmptyState } from "@/components/app/empty-state"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Guild } from "@/types/domain"

export function CalendarFeedSettings({
    server,
    dictionary,
    guildLoginUrl,
    calendarFeedToken,
}: {
    server: Guild
    dictionary: Dictionary
    guildLoginUrl: string
    calendarFeedToken?: string
}) {
    const [copied, setCopied] = useState(false)
    const [isPending, startTransition] = useTransition()
    const copy = dictionary.integrationSettings.calendar
    const feedUrl = calendarFeedToken
        ? new URL(
              `/api/calendar/${server.id}?token=${calendarFeedToken}`,
              guildLoginUrl
          ).toString()
        : null
    async function save(regenerateCalendarFeedToken: boolean) {
        const response = await fetch(
            `/api/servers/${server.id}/frontend-settings`,
            {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    name: server.name,
                    avatar: server.avatar,
                    description: server.description,
                    eventCategories: server.eventCategories,
                    calendarItems: server.calendarItems,
                    regenerateCalendarFeedToken,
                }),
            }
        )
        if (!response.ok) {
            toast.error(dictionary.common.error)
            return false
        }
        toast.success(dictionary.common.save)
        startTransition(() => window.location.reload())
        return true
    }
    return (
        <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
                {dictionary.serverSettings.googleCalendarInstructions}
            </p>
            {feedUrl ? (
                <>
                    <div className="flex flex-col gap-2 sm:flex-row">
                        <Input
                            value={feedUrl}
                            readOnly
                            className="min-w-0 rounded-xl"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            className="shrink-0 rounded-xl"
                            onClick={async () => {
                                await navigator.clipboard.writeText(feedUrl)
                                setCopied(true)
                                window.setTimeout(() => setCopied(false), 1600)
                            }}
                        >
                            {copied ? (
                                <Check className="size-4" />
                            ) : (
                                <Copy className="size-4" />
                            )}
                            {copied
                                ? dictionary.serverSettings.copiedCalendarFeed
                                : dictionary.serverSettings.copyCalendarFeed}
                        </Button>
                    </div>
                    <ConfirmActionDialog
                        trigger={
                            <Button
                                type="button"
                                variant="outline"
                                className="rounded-xl"
                                disabled={isPending}
                            >
                                {dictionary.serverSettings.rotateCalendarFeed}
                            </Button>
                        }
                        title={copy.rotateTitle}
                        description={copy.rotateDescription}
                        confirmLabel={copy.rotateConfirm}
                        cancelLabel={dictionary.integrationSettings.cancel}
                        onConfirm={() => save(true)}
                    />
                </>
            ) : (
                <EmptyState
                    icon={CalendarSync}
                    title={copy.emptyTitle}
                    description={copy.emptyDescription}
                    actions={
                        <Button
                            type="button"
                            className="rounded-xl"
                            disabled={isPending}
                            onClick={() => void save(true)}
                        >
                            {dictionary.serverSettings.createCalendarFeed}
                        </Button>
                    }
                />
            )}
        </div>
    )
}
