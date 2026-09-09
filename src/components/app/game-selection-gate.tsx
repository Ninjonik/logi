"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Gamepad2 } from "lucide-react"
import { useEffect } from "react"
import Link from "next/link"

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
    const router = useRouter()
    const searchParams = useSearchParams()
    const games = enabledGames === undefined ? [DEFAULT_GAME_ID] : enabledGames

    useEffect(() => {
        if (games.length !== 1) return
        const params = new URLSearchParams(searchParams.toString())
        params.set("game", games[0]!)
        router.replace(`${pathname}?${params.toString()}`)
    }, [games, pathname, router, searchParams])

    if (games.length === 1) {
        return (
            <div className="bg-background/60 absolute inset-0 z-50 grid place-items-center backdrop-blur-sm">
                <span className="border-primary/25 border-t-primary size-8 animate-spin rounded-full border-2" />
            </div>
        )
    }

    if (!games.length) {
        const settingsHref = `${pathname.split("/").slice(0, 5).join("/")}/settings`
        return (
            <div className="bg-background/60 absolute inset-0 z-50 grid place-items-center p-4 backdrop-blur-sm">
                <section className="border-border bg-card w-full max-w-lg rounded-2xl border p-6 shadow-xl">
                    <Gamepad2 className="text-primary mb-4 size-8" />
                    <h1 className="text-xl font-semibold">
                        {dictionary.games.noActiveTitle}
                    </h1>
                    <p className="text-muted-foreground mt-2 text-sm">
                        {dictionary.games.noActiveDescription}
                    </p>
                    <Button asChild className="mt-6">
                        <Link href={settingsHref}>
                            {dictionary.games.openSettings}
                        </Link>
                    </Button>
                </section>
            </div>
        )
    }

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
