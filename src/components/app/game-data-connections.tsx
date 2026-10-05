"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { ChevronDown } from "lucide-react"
import type { z } from "zod"

import { GameDataSources, type ServerLastGame } from "./game-data-sources"
import { gameDataSettingsSchema } from "@/domain/game-data/contracts"
import { GameHistoryRetention } from "./game-history-retention"
import { GameHistoryPanel } from "./game-history-panel"
import type { Dictionary } from "@/i18n/dictionaries"

type Props = { serverId: string; dictionary: Dictionary }
type Settings = z.infer<typeof gameDataSettingsSchema>

export function GameDataConnections(props: Props) {
    return <Connections key={props.serverId} {...props} />
}

/**
 * Game servers (design G4): one card per server with its key, last test and
 * the last game the collector saw, the form that connects a server, and how
 * long game history is kept.
 */
function Connections({ serverId, dictionary }: Props) {
    const t = dictionary.gameData
    const [data, setData] = useState<Settings | null>(null)
    const [browsing, setBrowsing] = useState(false)
    const url = `/api/servers/${encodeURIComponent(serverId)}/game-data`
    const load = useCallback(
        (signal?: AbortSignal) =>
            fetch(url, { cache: "no-store", signal })
                .then(async (response) => {
                    if (!response.ok) throw new Error()
                    const result = gameDataSettingsSchema.parse(
                        await response.json()
                    )
                    if (!signal?.aborted) setData(result)
                })
                // The cards still work without it; only "last game" stays empty.
                .catch(() => undefined),
        [url]
    )
    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
        return () => controller.abort()
    }, [load])
    const lastGames = useMemo(
        () =>
            Object.fromEntries(
                (data?.connections ?? []).map((entry) => [
                    entry.sourceRef,
                    {
                        map: entry.snapshot.map ?? null,
                        at: entry.snapshot.observedAt,
                        connectionId: entry.snapshot.id,
                    } satisfies ServerLastGame,
                ])
            ),
        [data]
    )
    return (
        <div className="space-y-6">
            <GameDataSources
                serverId={serverId}
                dictionary={dictionary}
                lastGames={lastGames}
                onChanged={() => void load()}
            />
            <section
                id="game-history"
                aria-labelledby="game-history-title"
                className="bg-card scroll-mt-6 rounded-2xl border px-5 pt-5 pb-2 sm:px-6"
            >
                <h2
                    id="game-history-title"
                    className="border-b pb-3 text-base font-semibold"
                >
                    {t.servers.historyTitle}
                </h2>
                <GameHistoryRetention
                    serverId={serverId}
                    dictionary={dictionary}
                />
                <details
                    className="group border-t py-3"
                    onToggle={(event) => setBrowsing(event.currentTarget.open)}
                >
                    <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 text-sm">
                        <ChevronDown
                            className="size-4 transition-transform group-open:rotate-180"
                            aria-hidden="true"
                        />
                        {t.servers.card.browseHistory}
                    </summary>
                    {browsing ? (
                        <div className="pt-4">
                            <GameHistoryPanel
                                serverId={serverId}
                                dictionary={dictionary}
                            />
                        </div>
                    ) : null}
                </details>
            </section>
        </div>
    )
}
