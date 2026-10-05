import type { Client } from "discord.js"

import type { PanelFactionEmoji } from "../../../src/domain/discord-publications/panel-presentation"
import { factionAssets } from "../public-panels/assets"

const REFRESH_MS = 60 * 60 * 1000
let cached: { at: number; value: Promise<PanelFactionEmoji> } | null = null

/**
 * Faction emblems for event messages: the application emoji the operator
 * installed with `scripts/provision-discord-panel-emoji.ts`, cached for an
 * hour. A failed lookup yields no emoji, so messages use the fallback emblems
 * and event sync never waits on or fails because of it.
 */
export function applicationFactionEmoji(
    client: Client
): Promise<PanelFactionEmoji> {
    const now = Date.now()
    if (!cached || now - cached.at >= REFRESH_MS) {
        cached = {
            at: now,
            value: (async () => {
                try {
                    const installed = await client.application?.emojis.fetch()
                    return Object.fromEntries(
                        (await factionAssets()).flatMap((asset) => {
                            const found = installed?.find(
                                (emoji) => emoji.name === asset.name
                            )
                            return found
                                ? [[asset.faction, found.toString()]]
                                : []
                        })
                    ) as PanelFactionEmoji
                } catch {
                    return {}
                }
            })(),
        }
    }
    return cached.value
}
