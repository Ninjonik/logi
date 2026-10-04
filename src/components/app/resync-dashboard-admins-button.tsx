"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"

/** Rebuilds dashboard admin access from the current members of the dashboard role. */
export function ResyncDashboardAdminsButton({
    serverId,
}: {
    serverId: string
}) {
    const [isPending, startTransition] = useTransition()
    const [clicked, setClicked] = useState(false)

    return (
        <Button
            variant="outline"
            className="rounded-xl"
            disabled={isPending}
            onClick={() => {
                startTransition(async () => {
                    const response = await fetch(
                        `/api/servers/${serverId}/dashboard-admins`,
                        { method: "POST" }
                    ).catch(() => null)
                    if (!response?.ok) {
                        toast.error("Unable to resync admin access.")
                        return
                    }
                    setClicked(true)
                    toast.success("Admin access resynced.")
                })
            }}
        >
            {clicked ? "Resynced" : "Resync admin access"}
        </Button>
    )
}
