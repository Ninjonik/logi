"use client"

import { useEffect, useState } from "react"

import type { DiscordSelectOption } from "@/components/app/discord-entity-select"

export type DiscordMetadata = {
    roles: DiscordSelectOption[]
    channels: Array<DiscordSelectOption & { type: number; parentId?: string }>
    emojis: DiscordSelectOption[]
}

export type DiscordMetadataState =
    | { status: "loading"; metadata: null }
    | { status: "ready"; metadata: DiscordMetadata }
    | { status: "failed"; metadata: null }

/** Channels, roles and emoji of the clan's Discord server, with whether loading failed. */
export function useDiscordMetadataState(
    serverId: string
): DiscordMetadataState {
    const [state, setState] = useState<{
        serverId: string
        value: DiscordMetadataState
    }>({ serverId, value: { status: "loading", metadata: null } })
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
                if (active)
                    setState({
                        serverId,
                        value: { status: "ready", metadata: body },
                    })
            })
            .catch(() => {
                if (active)
                    setState({
                        serverId,
                        value: { status: "failed", metadata: null },
                    })
            })
        return () => {
            active = false
        }
    }, [serverId])
    return state.serverId === serverId
        ? state.value
        : { status: "loading", metadata: null }
}

/** Channels, roles and emoji of the clan's Discord server, or `null` until loaded or if Discord is unavailable. */
export function useDiscordMetadata(serverId: string) {
    return useDiscordMetadataState(serverId).metadata
}
