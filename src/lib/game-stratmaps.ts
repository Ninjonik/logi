import {
    getHllStratmapMapById,
    getHllStratmapMaps,
    type HllStratmapMap,
} from "@/lib/stratmaps"
import type { GameId } from "@/domain/games/game"

const emptyDefaults: HllStratmapMap["defaultElements"] = {
    offensiveGarrisons: { a: [], b: [] },
    artillery: { a: [], b: [] },
    tanks: { a: [], b: [] },
    trucks: { a: [], b: [] },
    commandSpawns: { a: [], b: [] },
    repairStations: { a: [], b: [] },
}

function placeholderMap(
    id: string,
    name: string,
    imagePath: string
): HllStratmapMap {
    return {
        id,
        name,
        upstreamName: name,
        imagePath,
        mapSize: 1920,
        // Deliberately generic until official coordinates are available.
        strongpoints: ["Alpha", "Bravo", "Charlie", "Delta", "Echo"].map(
            (label, index) => ({
                id: label.toLowerCase(),
                label: `${label} (placeholder)`,
                grid: `${String.fromCharCode(65 + index)}5`,
                center: { x: 320 + index * 320, y: 960 },
                bounds: {
                    x: 240 + index * 320,
                    y: 850,
                    width: 160,
                    height: 220,
                },
                rects: [
                    { x: 240 + index * 320, y: 850, width: 160, height: 220 },
                ],
                spritePath: "",
            })
        ),
        defaultElements: emptyDefaults,
    }
}

export const HLL_VIETNAM_PLACEHOLDER_MAPS = [
    placeholderMap(
        "hllv-placeholder",
        "Hell Let Loose: Vietnam — placeholder map",
        "/maps/hllv-placeholder.svg"
    ),
]

export const WARDOGS_PLACEHOLDER_MAPS = [
    placeholderMap(
        "wardogs-placeholder",
        "Wardogs — placeholder map",
        "/maps/wardogs-placeholder.svg"
    ),
]

export function getStratmapMaps(gameId?: GameId) {
    if (gameId === "hell_let_loose_vietnam") return HLL_VIETNAM_PLACEHOLDER_MAPS
    if (gameId === "wardogs") return WARDOGS_PLACEHOLDER_MAPS
    return getHllStratmapMaps()
}

export function getStratmapMapById(mapId: string, gameId?: GameId) {
    return (
        getStratmapMaps(gameId).find((map) => map.id === mapId) ??
        getHllStratmapMapById(mapId) ??
        HLL_VIETNAM_PLACEHOLDER_MAPS.find((map) => map.id === mapId) ??
        WARDOGS_PLACEHOLDER_MAPS.find((map) => map.id === mapId)
    )
}
