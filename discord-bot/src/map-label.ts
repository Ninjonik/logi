import {
    formatHllPresetLabel,
    inferHllSelection,
} from "../../src/lib/hll-map-presets"
import type { getClanDiscordMessages } from "../../src/lib/clan-language"
import type { GameId } from "../../src/domain/games/game"

const MARKDOWN = /([\\`*_{}[\]()#+\-.!|>~<@])/g

/**
 * "Foy · den" in the clan language: the map, its time of day and the mode when
 * it is not warfare. Unknown values are shown as stored, escaped and on one
 * line.
 */
export function formatMapLabel(
    map: string | null | undefined,
    gameId: GameId | undefined,
    messages: ReturnType<typeof getClanDiscordMessages>
) {
    const value = map?.trim()
    if (!value) return undefined
    const selection = inferHllSelection(value, gameId)
    if (!selection) {
        return (formatHllPresetLabel(value, gameId) ?? value)
            .replace(/[\s\p{Cc}]+/gu, " ")
            .replace(MARKDOWN, "\\$1")
    }
    return [
        formatHllPresetLabel(selection.mapId, gameId) ?? selection.mapId,
        messages.mapLabels.times[selection.time],
        selection.mode === "warfare"
            ? undefined
            : messages.mapLabels.modes[selection.mode],
    ]
        .filter(Boolean)
        .join(" · ")
}
