"use client"

import { useEffect, useState } from "react"

import type { DiscordSelectOption } from "@/components/app/discord-entity-select"

export type DiscordMetadata = {
    roles: DiscordSelectOption[]
    channels: Array<DiscordSelectOption & { type: number; parentId?: string }>
    emojis: DiscordSelectOption[]
}

/** Channels, roles and emoji of the clan's Discord server, or `null` until loaded or if Discord is unavailable. */
export function useDiscordMetadata(serverId: string) {
    const [metadata, setMetadata] = useState<DiscordMetadata | null>(null)
    useEffect(() => {
        let active = true
        fetch(`/api/servers/${serverId}/discord-metadata`)
            .then(async (response) => {
                const body = await response.json()
                if (
                    !response.ok ||
                    !Array.isArray(body?.channels) ||
                    !Array.isArray(body?.roles) ||
                    !Array.isArray(body?.emojis)
                )
                    throw new Error("Unable to load Discord metadata.")
                if (active) setMetadata(body)
            })
            .catch(() => {
                if (active) setMetadata(null)
            })
        return () => {
            active = false
        }
    }, [serverId])
    return metadata
}
