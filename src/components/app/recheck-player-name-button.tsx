"use client"

import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { useRouter } from "next/navigation"
import { RefreshCw } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

export function RecheckPlayerNameButton({
    serverId,
    assignmentId,
    dictionary,
}: {
    serverId: string
    assignmentId: string
    dictionary: Dictionary
}) {
    const [pending, setPending] = useState(false)
    const router = useRouter()
    const labels = dictionary.userManagement
    async function recheck() {
        setPending(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/users/${assignmentId}/recheck-name`,
                { method: "POST" }
            )
            if (!response.ok) throw new Error("Recheck failed")
            const result: { changed: boolean } = await response.json()
            toast.success(
                result.changed
                    ? labels.displayNameUpdated
                    : labels.displayNameUnchanged
            )
            router.refresh()
        } catch {
            toast.error(labels.displayNameRecheckFailed)
        } finally {
            setPending(false)
        }
    }
    return (
        <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={recheck}
        >
            <RefreshCw className={pending ? "size-4 animate-spin" : "size-4"} />
            {pending ? labels.recheckingDisplayName : labels.recheckDisplayName}
        </Button>
    )
}
