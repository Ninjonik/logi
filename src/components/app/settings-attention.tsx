"use client"

import * as React from "react"

type SettingsAttention = { serverId: string; count: number }

const SettingsAttentionContext = React.createContext<{
    attention: SettingsAttention | null
    setAttention: (attention: SettingsAttention) => void
} | null>(null)

/**
 * Carries the number of clan settings that need attention from the clan's
 * server layout (which loads the settings) to the sidebar badge.
 */
export function SettingsAttentionProvider({
    children,
}: {
    children: React.ReactNode
}) {
    const [attention, setAttention] = React.useState<SettingsAttention | null>(
        null
    )
    const value = React.useMemo(
        () => ({ attention, setAttention }),
        [attention]
    )
    return (
        <SettingsAttentionContext.Provider value={value}>
            {children}
        </SettingsAttentionContext.Provider>
    )
}

/** Rendered by the clan layout; reports the clan's count to the sidebar. */
export function SettingsAttentionReport({
    serverId,
    count,
}: SettingsAttention) {
    const setAttention = React.useContext(
        SettingsAttentionContext
    )?.setAttention
    React.useEffect(() => {
        setAttention?.({ serverId, count })
    }, [setAttention, serverId, count])
    return null
}

/** The count for the clan shown in the sidebar, or 0 while it is unknown. */
export function useSettingsAttentionCount(serverId: string | undefined) {
    const attention = React.useContext(SettingsAttentionContext)?.attention
    return attention && attention.serverId === serverId ? attention.count : 0
}
