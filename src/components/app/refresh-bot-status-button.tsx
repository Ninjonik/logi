"use client"

import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

export function RefreshBotStatusButton({
    dictionary,
    label,
    onRefreshed,
}: {
    dictionary: Dictionary
    /** Replaces "Refresh", e.g. "Check again" in the setup guide. */
    label?: string
    /** Called after the bot status was read again from Discord. */
    onRefreshed?: () => void
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    async function handleRefresh() {
        const response = await fetch("/api/auth/discord/refresh", {
            method: "POST",
        })
        const body = await response.json()

        if (!response.ok) {
            toast.error(
                body.error ?? dictionary.dashboard.botStatusRefreshError
            )
            return
        }

        toast.success(dictionary.dashboard.botStatusRefreshed)
        onRefreshed?.()
        startTransition(() => {
            router.refresh()
        })
    }

    return (
        <Button
            variant="outline"
            className="h-8 rounded-lg px-3 text-[13px]"
            onClick={handleRefresh}
            disabled={isPending}
        >
            {isPending
                ? dictionary.dashboard.refreshingBotStatus
                : (label ?? dictionary.dashboard.refreshBotStatus)}
        </Button>
    )
}
