"use client"

import {
    sharedRosterContext,
    type SharedRosterContext,
} from "@/lib/gateways/shared-matches"
import { useEffect, useState } from "react"

/** Creation and editing use the same clan/player projection, scoped to the selected match. */
export function useSharedRosterContext(
    serverId: string,
    eventId: string | undefined,
    canAdmin: boolean,
    revision?: string
) {
    const [result, setResult] = useState<{
        serverId: string
        eventId: string
        context: SharedRosterContext
    }>()
    useEffect(() => {
        if (!canAdmin || !eventId) return
        let active = true
        void sharedRosterContext(serverId, eventId)
            .then((context) => {
                if (active) setResult({ serverId, eventId, context })
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
    }, [serverId, eventId, canAdmin, revision])
    return canAdmin &&
        result?.serverId === serverId &&
        result.eventId === eventId
        ? result.context
        : undefined
}
