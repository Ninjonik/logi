import { Gamepad2 } from "lucide-react"

import { DEFAULT_GAME_ID, GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { Badge } from "@/components/ui/badge"

export function GameBadge({
    gameId,
    dictionary,
}: {
    gameId?: GameId
    dictionary: Dictionary
}) {
    const resolvedGame = gameId ?? DEFAULT_GAME_ID
    const shortLabel =
        resolvedGame === "hell_let_loose"
            ? "HLL"
            : resolvedGame === "hell_let_loose_vietnam"
              ? "HLLV"
              : "WD"

    return (
        <Badge
            variant="outline"
            className="gap-1 px-1.5 py-0.5 text-[10px] whitespace-nowrap"
            aria-label={`${dictionary.games.column}: ${GAME_LABELS[resolvedGame]}`}
            title={GAME_LABELS[resolvedGame]}
        >
            <Gamepad2 className="size-3" aria-hidden />
            {shortLabel}
        </Badge>
    )
}
