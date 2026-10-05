"use client"

import { Loader2, RefreshCw } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { toast } from "sonner"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

/** Asks the bot to post the forum topics of the match again. */
export function ResyncTopicThreadButton({
    serverId,
    eventId,
    dictionary,
}: {
    serverId: string
    eventId: string
    dictionary: Dictionary
}) {
    const router = useRouter()
    const [busy, setBusy] = useState(false)

    async function resync() {
        setBusy(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/events/${eventId}/resync-topic-thread`,
                { method: "POST" }
            )
            const body = (await response.json().catch(() => null)) as {
                error?: string
            } | null
            if (!response.ok)
                throw new Error(body?.error ?? dictionary.common.error)
            toast.success(dictionary.event.topicThreadResyncQueued)
            router.refresh()
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : dictionary.common.error
            )
        } finally {
            setBusy(false)
        }
    }

    return (
        <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={busy}
            onClick={() => void resync()}
        >
            {busy ? (
                <Loader2 className="size-4 animate-spin" aria-hidden />
            ) : (
                <RefreshCw className="size-4" aria-hidden />
            )}
            {dictionary.event.resyncTopicThread}
        </Button>
    )
}
