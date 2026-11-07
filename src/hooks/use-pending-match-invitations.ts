"use client"

import { pendingSharedInvitationCount } from "@/lib/gateways/shared-matches"
import { usePathname } from "next/navigation"
import { useEffect, useState } from "react"

export const SHARED_INVITATIONS_CHANGED = "logi:shared-match-invitations"

/** Keep the selected clan's manager badge current without clearing it on read errors. */
export function usePendingMatchInvitations(
    serverId: string | undefined,
    enabled: boolean
) {
    const pathname = usePathname()
    const [result, setResult] = useState<{
        serverId: string
        count: number
    } | null>(null)
    useEffect(() => {
        if (!serverId || !enabled) return
        let active = true
        let loading = false
        let queued = false
        const refresh = async () => {
            if (!active || document.visibilityState === "hidden") return
            if (loading) {
                queued = true
                return
            }
            loading = true
            try {
                const count = await pendingSharedInvitationCount(serverId)
                if (active) setResult({ serverId, count })
            } catch {
                // A temporary outage must not dismiss unresolved invitations.
            } finally {
                loading = false
                if (queued && active) {
                    queued = false
                    void refresh()
                }
            }
        }
        void refresh()
        const timer = window.setInterval(() => void refresh(), 60_000)
        window.addEventListener("focus", refresh)
        window.addEventListener(SHARED_INVITATIONS_CHANGED, refresh)
        document.addEventListener("visibilitychange", refresh)
        return () => {
            active = false
            window.clearInterval(timer)
            window.removeEventListener("focus", refresh)
            window.removeEventListener(SHARED_INVITATIONS_CHANGED, refresh)
            document.removeEventListener("visibilitychange", refresh)
        }
    }, [serverId, enabled, pathname])
    return enabled && result && result.serverId === serverId ? result.count : 0
}
