import { formatHllPresetLabel, inferHllSelection } from "@/lib/hll-map-presets"
import { getEventMessages } from "@/lib/clan-language/events"
import type { GameId } from "@/domain/games/game"

const MARKDOWN = /([\\`*_{}[\]()#+\-.!|>~<@])/g

/**
 * "Foy · den" in the clan language, as the bot's cards write it: the map,
 * its time of day and the mode when it is not warfare. Unknown values are
 * shown as stored, escaped and on one line. The dashboard's previews use it
 * so they show the same words as Discord.
 */
export function formatDiscordMapLabel(
    map: string | null | undefined,
    gameId: GameId | undefined,
    language: string | null | undefined
) {
    const value = map?.trim()
    if (!value) return undefined
    const messages = getEventMessages(language)
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
