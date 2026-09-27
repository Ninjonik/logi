import { DEFAULT_GAME_ID, type GameId } from "@/domain/games/game"
import { GameBadge } from "@/components/app/game-badge"
import type { Dictionary } from "@/i18n/dictionaries"

export function ConfigurationScopeIndicator({
    enabledGames,
    gameId,
    dictionary,
}: {
    enabledGames?: GameId[]
    gameId?: GameId
    dictionary: Dictionary
}) {
    const games = enabledGames?.length ? enabledGames : [DEFAULT_GAME_ID]
    const scopedGame = gameId ? [gameId] : games
    return (
        <div className="border-primary/25 bg-primary/5 flex items-center gap-3 rounded-xl border px-4 py-3 text-sm">
            <div className="flex -space-x-1.5">
                {scopedGame.map((id) => (
                    <GameBadge
                        key={id}
                        gameId={id}
                        dictionary={dictionary}
                        className="ring-background size-6 ring-2"
                    />
                ))}
            </div>
            <div>
                <p className="font-medium">
                    {gameId
                        ? dictionary.configurationScope.singleGame
                        : dictionary.configurationScope.clanWide}
                </p>
                <p className="text-muted-foreground text-xs">
                    {gameId
                        ? dictionary.configurationScope.singleGameDescription
                        : dictionary.configurationScope.clanWideDescription}
                </p>
            </div>
        </div>
    )
}
