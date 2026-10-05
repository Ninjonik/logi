"use client"

import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { useTransition } from "react"
import { toast } from "sonner"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

/** Rebuilds dashboard admin access from the current members of the dashboard role. */
export function ResyncDashboardAdminsButton({
    serverId,
    dictionary,
    disabled = false,
}: {
    serverId: string
    dictionary: Dictionary
    disabled?: boolean
}) {
    const text = dictionary.settingsHub.rolesPage
    const router = useRouter()
    const [isPending, startTransition] = useTransition()

    return (
        <Button
            type="button"
            variant="outline"
            className="rounded-xl"
            disabled={disabled || isPending}
            onClick={() => {
                startTransition(async () => {
                    const response = await fetch(
                        `/api/servers/${serverId}/dashboard-admins`,
                        { method: "POST" }
                    ).catch(() => null)
                    if (!response?.ok) {
                        toast.error(text.resyncError)
                        return
                    }
                    toast.success(text.resynced)
                    // Shows the rebuilt list of people with access.
                    router.refresh()
                })
            }}
        >
            <RefreshCw
                className={isPending ? "size-4 animate-spin" : "size-4"}
                aria-hidden="true"
            />
            {text.resync}
        </Button>
    )
}
