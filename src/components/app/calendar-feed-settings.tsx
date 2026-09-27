"use client"

import { useState, useTransition } from "react"
import { Check, Copy } from "lucide-react"
import { toast } from "sonner"

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
        if (!response.ok) return toast.error(dictionary.common.error)
        toast.success(dictionary.common.save)
        startTransition(() => window.location.reload())
    }
    return (
        <div className="space-y-3">
            <p className="text-muted-foreground text-sm">
                {dictionary.serverSettings.googleCalendarInstructions}
            </p>
            {feedUrl ? (
                <div className="flex gap-2">
                    <Input value={feedUrl} readOnly className="rounded-xl" />
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
            ) : null}
            <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                disabled={isPending}
                onClick={() => void save(true)}
            >
                {calendarFeedToken
                    ? dictionary.serverSettings.rotateCalendarFeed
                    : dictionary.serverSettings.createCalendarFeed}
            </Button>
        </div>
    )
}
