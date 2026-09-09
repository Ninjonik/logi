"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { Gamepad2 } from "lucide-react"

import { DEFAULT_GAME_ID, GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

export function GameSelectionGate({
    enabledGames,
    dictionary,
}: {
    enabledGames?: GameId[]
    dictionary: Dictionary
}) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const games = enabledGames?.length ? enabledGames : [DEFAULT_GAME_ID]

    return (
        <div className="bg-background/60 absolute inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm">
            <section className="border-border bg-card w-full max-w-lg rounded-2xl border p-6 shadow-xl">
                <Gamepad2 className="text-primary mb-4 size-8" />
                <h1 className="text-xl font-semibold">
                    {dictionary.games.selectTitle}
                </h1>
                <p className="text-muted-foreground mt-2 text-sm">
                    {dictionary.games.selectDescription}
                </p>
                <div className="mt-6 grid gap-2 sm:grid-cols-2">
                    {games.map((gameId) => {
                        const params = new URLSearchParams(
                            searchParams.toString()
                        )
                        params.set("game", gameId)
                        return (
                            <Button
                                key={gameId}
                                asChild
                                variant="outline"
                                className="h-auto justify-start py-4"
                            >
                                <a href={`${pathname}?${params.toString()}`}>
                                    {GAME_LABELS[gameId]}
                                </a>
                            </Button>
                        )
                    })}
                </div>
            </section>
        </div>
    )
}
