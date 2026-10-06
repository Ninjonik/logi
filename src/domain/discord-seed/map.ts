import {
    hllLayerLighting,
    hllModeOf,
    panelMapDefinition,
    panelMapKey,
} from "../discord-publications/panel-graphics"
import type { MessageMedia } from "../discord-messages/message-view"
import { liveMapLine } from "../discord-publications/live-panel"
import type { SeedGame } from "./views"

/** The map facts of the seed messages: "Foy · Warfare · Den", "Foy" and the map picture. */
export type SeedMapFacts = {
    /** "Foy · Warfare · Den" in the clan language, Markdown-escaped. */
    mapLine: string | null
    /** "Foy" for the control message. */
    mapName: string | null
    /** Logi's built-in picture of a known map, beside the call. */
    thumbnail: MessageMedia | null
}

/**
 * The map of a server as the seed call and the control message show it (P5,
 * P3-19, P3-20), from the collected snapshot's map (a CRCON name such as
 * "Foy" or a layer such as "foy_warfare_day"). The bot posts it and the P3
 * page previews it from this one function, so the preview is exactly the
 * bot's message: mode and lighting when the map says them, and the built-in
 * map picture of the catalogue (P7-B04) when the map is known. `siteUrl`
 * makes the picture's URL absolute for Discord; without it the path stays
 * relative for the dashboard.
 */
export function seedMapFacts(
    server: { gameId: SeedGame; map: string | null },
    language: string,
    siteUrl: string | null = null
): SeedMapFacts {
    const raw = server.map?.trim()
    if (!raw) return { mapLine: null, mapName: null, thumbnail: null }
    const key = panelMapKey(server.gameId, raw)
    const known = panelMapDefinition(server.gameId, key)
    const name = known?.name ?? raw
    const hll = server.gameId === "hell_let_loose"
    const mapLine = liveMapLine(
        {
            map: { name, key },
            mode: hll ? hllModeOf(raw) : null,
            lighting: hll ? hllLayerLighting(raw) : null,
        },
        language
    )
    const url = known?.builtIn ? mapUrl(known.builtIn, siteUrl) : null
    return {
        mapLine: mapLine || null,
        mapName: name,
        thumbnail: url ? { url, description: name } : null,
    }
}

/** The picture's URL; null when the site URL is unusable, so Discord never gets a relative one. */
function mapUrl(path: string, siteUrl: string | null) {
    if (siteUrl === null) return path
    try {
        return new URL(path, siteUrl).href
    } catch {
        return null
    }
}
