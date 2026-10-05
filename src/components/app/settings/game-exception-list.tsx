"use client"

import { Plus, X } from "lucide-react"
import type { ReactNode } from "react"

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { GameBadge } from "@/components/app/game-badge"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

/**
 * One setting's per-game exceptions, shown under its clan-wide value (design
 * A2). A game without a row uses the clan-wide value; an emptied row falls back
 * to it when saved.
 */
export function GameExceptionList<V>({
    enabledGames,
    exceptions,
    onChange,
    emptyValue,
    canAdd,
    dictionary,
    renderValue,
}: {
    enabledGames: readonly GameId[]
    exceptions: Partial<Record<GameId, V>>
    onChange: (next: Partial<Record<GameId, V>>) => void
    /** Value of a freshly added exception, before anything is chosen. */
    emptyValue: V
    canAdd: boolean
    dictionary: Dictionary
    renderValue: (
        game: GameId,
        value: V | undefined,
        setValue: (value: V) => void
    ) => ReactNode
}) {
    const rows = enabledGames.filter((game) => game in exceptions)
    const addable = enabledGames.filter((game) => !(game in exceptions))

    function remove(game: GameId) {
        const next = { ...exceptions }
        delete next[game]
        onChange(next)
    }

    return (
        <div className="space-y-2">
            {rows.map((game) => {
                const value = exceptions[game]
                return (
                    <div
                        key={game}
                        className="border-border/60 space-y-2 border-l-2 pl-3"
                    >
                        <div className="flex items-center gap-2">
                            <GameBadge gameId={game} dictionary={dictionary} />
                            <span className="text-muted-foreground flex-1 text-xs font-medium">
                                {GAME_LABELS[game]}
                            </span>
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-lg"
                                aria-label={dictionary.settingsHub.gameExceptionRemove.replace(
                                    "{game}",
                                    GAME_LABELS[game]
                                )}
                                onClick={() => remove(game)}
                            >
                                <X className="size-4" />
                            </Button>
                        </div>
                        {renderValue(game, value, (nextValue) =>
                            onChange({ ...exceptions, [game]: nextValue })
                        )}
                    </div>
                )
            })}
            {canAdd && addable.length ? (
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground h-8 rounded-lg px-2"
                        >
                            <Plus className="size-3.5" />
                            {dictionary.settingsHub.gameExceptionAdd}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        {addable.map((game) => (
                            <DropdownMenuItem
                                key={game}
                                onSelect={() =>
                                    onChange({
                                        ...exceptions,
                                        [game]: emptyValue,
                                    })
                                }
                                className="flex items-center gap-2"
                            >
                                <GameBadge
                                    gameId={game}
                                    dictionary={dictionary}
                                />
                                {GAME_LABELS[game]}
                            </DropdownMenuItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            ) : null}
        </div>
    )
}
