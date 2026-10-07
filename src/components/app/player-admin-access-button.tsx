"use client"

import { ShieldCheck } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

/**
 * Grants or removes a player's dashboard admin access for this clan. Both
 * directions change who can manage the clan, so each asks first.
 */
export function PlayerAdminAccessButton({
    serverId,
    playerId,
    playerName,
    initialIsAdmin,
    dictionary,
}: {
    serverId: string
    playerId: string
    playerName: string
    initialIsAdmin: boolean
    dictionary: Dictionary
}) {
    const [isAdmin, setIsAdmin] = useState(initialIsAdmin)
    const labels = dictionary.userManagement

    async function updateAdminAccess() {
        const nextIsAdmin = !isAdmin
        try {
            const response = await fetch(
                `/api/servers/${serverId}/admin-access`,
                {
                    method: "PATCH",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        playerId,
                        isAdmin: nextIsAdmin,
                    }),
                }
            )
            if (!response.ok) {
                throw new Error("Unable to update player admin access.")
            }
            setIsAdmin(nextIsAdmin)
            toast.success(
                nextIsAdmin
                    ? labels.adminAccessGranted
                    : labels.adminAccessRemoved
            )
        } catch {
            toast.error(labels.adminAccessUpdateFailed)
            return false
        }
    }

    return (
        <ConfirmActionDialog
            trigger={
                <Button
                    type="button"
                    variant={isAdmin ? "secondary" : "outline"}
                    className="rounded-xl"
                >
                    <ShieldCheck className="size-4" />
                    {isAdmin
                        ? labels.removeAdminAccess
                        : labels.grantAdminAccess}
                </Button>
            }
            title={(isAdmin
                ? labels.removeAdminTitle
                : labels.grantAdminTitle
            ).replace("{name}", playerName)}
            description={(isAdmin
                ? labels.removeAdminDescription
                : labels.grantAdminDescription
            ).replace("{name}", playerName)}
            confirmLabel={
                isAdmin ? labels.removeAdminAccess : labels.grantAdminAccess
            }
            cancelLabel={dictionary.common.cancel}
            destructive={isAdmin}
            onConfirm={updateAdminAccess}
        />
    )
}
