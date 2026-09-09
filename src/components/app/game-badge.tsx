import { DEFAULT_GAME_ID, GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { cn } from "@/lib/utils"

const GAME_ICON_SOURCES: Record<GameId, string> = {
    hell_let_loose: "/img/games/hll.jpg",
    // hllv.pdn is a Paint.NET project and cannot be displayed by browsers.
    // Keep a functional HLL fallback until its exported web image is supplied.
    hell_let_loose_vietnam: "/img/games/hll.jpg",
    wardogs: "/img/games/wardogs.jpg",
}

export function GameBadge({
    gameId,
    dictionary,
    className,
}: {
    gameId?: GameId
    dictionary: Dictionary
    className?: string
}) {
    const resolvedGame = gameId ?? DEFAULT_GAME_ID

    return (
        <span
            className={cn(
                "border-border/70 bg-muted inline-flex size-5 shrink-0 overflow-hidden rounded-full border shadow-sm",
                className
            )}
            aria-label={`${dictionary.games.column}: ${GAME_LABELS[resolvedGame]}`}
            title={GAME_LABELS[resolvedGame]}
        >
            <img
                src={GAME_ICON_SOURCES[resolvedGame]}
                alt=""
                className="size-full object-cover"
            />
        </span>
    )
}
