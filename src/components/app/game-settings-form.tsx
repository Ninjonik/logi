"use client"

import { makeFunctionReference } from "convex/server"
import { useState, useTransition } from "react"
import { useMutation } from "convex/react"
import { toast } from "sonner"

import {
    DEFAULT_GAME_ID,
    GAME_IDS,
    GAME_LABELS,
    type GameId,
} from "@/domain/games/game"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

const setEnabledGamesReference = makeFunctionReference<"mutation">(
    "guilds:setEnabledGames"
)

export function GameSettingsForm({
    serverId,
    userId,
    enabledGames,
    dictionary,
}: {
    serverId: string
    userId: string
    enabledGames?: GameId[]
    dictionary: Dictionary
}) {
    const setEnabledGames = useMutation(setEnabledGamesReference)
    const [isPending, startTransition] = useTransition()
    const [selected, setSelected] = useState<GameId[]>(
        enabledGames?.length ? enabledGames : [DEFAULT_GAME_ID]
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
                {GAME_IDS.map((gameId) => (
                    <div key={gameId} className="flex items-center gap-2">
                        <Checkbox
                            id={`game-${gameId}`}
                            checked={selected.includes(gameId)}
                            disabled={isPending}
                            onCheckedChange={(checked) =>
                                toggle(gameId, checked === true)
                            }
                        />
                        <Label htmlFor={`game-${gameId}`}>
                            {GAME_LABELS[gameId]}
                        </Label>
                    </div>
                ))}
                <Button
                    className="rounded-xl"
                    disabled={isPending || selected.length === 0}
                    onClick={() =>
                        startTransition(async () => {
                            try {
                                await setEnabledGames({
                                    guildId: serverId as never,
                                    userId,
                                    enabledGames: selected,
                                })
                                toast.success(dictionary.games.saved)
                            } catch (error) {
                                console.error(error)
                                toast.error(dictionary.games.saveError)
                            }
                        })
                    }
                >
                    {dictionary.games.save}
                </Button>
            </CardContent>
        </Card>
    )
}
