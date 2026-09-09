"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Gamepad2 } from "lucide-react"
import Link from "next/link"

import { DEFAULT_GAME_ID, GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

export function GameSwitcher({
    enabledGames,
    dictionary,
}: {
    enabledGames?: GameId[]
    dictionary: Dictionary
}) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const selected = searchParams.get("game") as GameId | "all" | null
    const games = enabledGames === undefined ? [DEFAULT_GAME_ID] : enabledGames
    const options: Array<GameId | "all"> = ["all", ...games]

    if (!games.length) return null

    function href(game: GameId | "all") {
        const params = new URLSearchParams(searchParams.toString())
        if (game === "all") params.delete("game")
        else params.set("game", game)
        const query = params.toString()
        return `${pathname}${query ? `?${query}` : ""}`
    }

    return (
        <div
            className="flex flex-wrap gap-1 px-1"
            aria-label={dictionary.games.filterLabel}
        >
            <Gamepad2 className="text-muted-foreground mt-1.5 ml-1 size-4" />
            {options.map((game) => (
                <Button
                    key={game}
                    variant={
                        (selected ?? "all") === game ? "secondary" : "ghost"
                    }
                    size="sm"
                    className="h-7 px-2 text-xs"
                    asChild
                >
                    <Link href={href(game)}>
                        {game === "all"
                            ? dictionary.games.all
                            : GAME_LABELS[game]}
                    </Link>
                </Button>
            ))}
        </div>
    )
}
