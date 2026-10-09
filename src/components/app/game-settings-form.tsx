"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import { saveEnabledGames } from "@/components/app/settings/save-enabled-games"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DEFAULT_GAME_ID, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export function GameSettingsForm({
    serverId,
    enabledGames,
    games,
    dictionary,
}: {
    serverId: string
    enabledGames?: GameId[]
    games: Array<{ id: GameId; name: string }>
    dictionary: Dictionary
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [selected, setSelected] = useState<GameId[]>(
        enabledGames === undefined ? [DEFAULT_GAME_ID] : enabledGames
    )

    function toggle(gameId: GameId, checked: boolean) {
        setSelected((current) =>
            checked
                ? [...current, gameId]
                : current.filter((item) => item !== gameId)
        )
    }

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardHeader>
                <CardTitle>{dictionary.games.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-muted-foreground text-sm">
                    {dictionary.games.description}
                </p>
                {games.map((game) => (
                    <div key={game.id} className="flex items-center gap-2">
                        <Checkbox
                            id={`game-${game.id}`}
                            checked={selected.includes(game.id)}
                            disabled={isPending}
                            onCheckedChange={(checked) =>
                                toggle(game.id, checked === true)
                            }
                        />
                        <Label htmlFor={`game-${game.id}`}>{game.name}</Label>
                    </div>
                ))}
                <Button
                    className="rounded-xl"
                    disabled={isPending}
                    onClick={() =>
                        startTransition(async () => {
                            const result = await saveEnabledGames(
                                serverId,
                                selected
                            )
                            if (!result.ok) {
                                toast.error(dictionary.games.saveError)
                                return
                            }
                            toast.success(dictionary.games.saved)
                            router.refresh()
                        })
                    }
                >
                    {dictionary.games.save}
                </Button>
            </CardContent>
        </Card>
    )
}
