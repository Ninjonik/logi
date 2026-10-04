"use client"

import {
    warconEnvelopeSchema,
    type WarconEnvelope,
    warconFreshness,
} from "@/domain/game-data/warcon-contracts"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"

export function WarconScoreboard({
    serverId,
    connectionId,
    dictionary,
}: {
    serverId: string
    connectionId: string
    dictionary: Dictionary
}) {
    const t = dictionary.gameData
    const [open, setOpen] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const [data, setData] = useState<WarconEnvelope | null>(null)
    const [error, setError] = useState(false)
    const [loading, setLoading] = useState(false)
    const [observedNow, setObservedNow] = useState(0)
    useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        let timer: ReturnType<typeof setTimeout> | undefined
        async function load() {
            let delay = 15_000
            try {
                setObservedNow(Date.now())
                if (document.visibilityState === "hidden") return
                setLoading(true)
                const response = await fetch(
                    `/api/servers/${encodeURIComponent(serverId)}/game-data/${encodeURIComponent(connectionId)}?game=wardogs&view=live`,
                    { cache: "no-store", signal: controller.signal }
                )
                const retry = Number(response.headers.get("retry-after"))
                if (Number.isFinite(retry) && retry > 0)
                    delay = Math.max(delay, Math.min(retry * 1000, 86_400_000))
                if (!response.ok) throw new Error()
                const body: unknown = await response.json()
                const envelope = warconEnvelopeSchema.parse(
                    body && typeof body === "object" && "data" in body
                        ? body.data
                        : null
                )
                if (
                    envelope.connectionId !== connectionId ||
                    envelope.result.view !== "live"
                )
                    throw new Error()
                if (!controller.signal.aborted) {
                    setData(envelope)
                    setError(false)
                }
            } catch {
                if (!controller.signal.aborted) {
                    setError(true)
                    setData(null)
                }
            } finally {
                if (!controller.signal.aborted) {
                    setObservedNow(Date.now())
                    setLoading(false)
                    timer = setTimeout(() => void load(), delay)
                }
            }
        }
        void load()
        return () => {
            controller.abort()
            clearTimeout(timer)
        }
    }, [open, refresh, serverId, connectionId])
    const live = data?.result.view === "live" ? data.result.data : null
    const fresh = live
        ? warconFreshness(live.statusAt, observedNow, live.ok)
        : "unavailable"
    const playersFresh = live
        ? warconFreshness(live.playersAt, observedNow, live.ok)
        : "unavailable"
    return (
        <details
            className="rounded-lg border p-3"
            onToggle={(e) => {
                setObservedNow(Date.now())
                setOpen(e.currentTarget.open)
            }}
        >
            <summary className="cursor-pointer font-medium">
                {t.liveScoreboard}
            </summary>
            {open && (
                <div className="mt-4 space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={loading}
                            onClick={() => setRefresh((v) => v + 1)}
                        >
                            {loading ? t.loading : t.refresh}
                        </Button>
                        <span
                            role="status"
                            className="text-muted-foreground text-xs"
                        >
                            {t.scoreboardPolling}
                        </span>
                    </div>
                    {error && (
                        <p role="alert" className="text-destructive text-sm">
                            {t.scoreboardError}
                        </p>
                    )}
                    {live && (
                        <>
                            <div className="flex flex-wrap gap-3 text-sm">
                                <span>
                                    {t.state}: {t.freshness[fresh]}
                                </span>
                                <span>
                                    {t.players}:{" "}
                                    {live.status?.playerCount ?? t.unknown} /{" "}
                                    {live.status?.maxPlayers ?? t.unknown}
                                </span>
                                <span>
                                    {t.map}: {live.status?.map || t.unknown}
                                </span>
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {t.playerObservation}:{" "}
                                {live.playersAt
                                    ? new Date(live.playersAt).toLocaleString()
                                    : t.never}{" "}
                                · {t.freshness[playersFresh]}
                            </p>
                            {live.gameServerId && (
                                <p className="text-sm break-all">
                                    {t.joinCode}:{" "}
                                    <code>{live.gameServerId}</code>
                                </p>
                            )}
                            <div className="grid gap-2 sm:grid-cols-3">
                                {live.status?.scores.map((score) => (
                                    <div
                                        className="bg-muted rounded-md p-3 text-sm"
                                        key={score.name}
                                    >
                                        {score.name}{" "}
                                        <strong className="ml-2">
                                            {score.score}
                                        </strong>
                                    </div>
                                ))}
                            </div>
                            {playersFresh === "unavailable" ? (
                                <p className="text-sm">
                                    {t.scoreboardUnavailable}
                                </p>
                            ) : !live.players.length ? (
                                <p className="text-sm">{t.scoreboardEmpty}</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <caption className="sr-only">
                                            {t.liveScoreboard}
                                        </caption>
                                        <thead>
                                            <tr>
                                                {[
                                                    t.player,
                                                    t.faction,
                                                    t.kills,
                                                    t.deaths,
                                                    "K/D",
                                                    t.cash,
                                                    t.ping,
                                                ].map((label) => (
                                                    <th
                                                        key={label}
                                                        scope="col"
                                                        className="border-b px-2 py-2 font-medium"
                                                    >
                                                        {label}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {[...live.players]
                                                .sort(
                                                    (a, b) =>
                                                        b.kills - a.kills ||
                                                        a.deaths - b.deaths
                                                )
                                                .map((player) => (
                                                    <tr key={player.steamId}>
                                                        <td className="border-b px-2 py-2">
                                                            {player.name}
                                                        </td>
                                                        <td className="border-b px-2 py-2">
                                                            {player.faction ??
                                                                t.unknown}
                                                        </td>
                                                        <td className="border-b px-2 py-2 tabular-nums">
                                                            {player.kills}
                                                        </td>
                                                        <td className="border-b px-2 py-2 tabular-nums">
                                                            {player.deaths}
                                                        </td>
                                                        <td className="border-b px-2 py-2 tabular-nums">
                                                            {(
                                                                player.kills /
                                                                Math.max(
                                                                    1,
                                                                    player.deaths
                                                                )
                                                            ).toFixed(2)}
                                                        </td>
                                                        <td className="border-b px-2 py-2 tabular-nums">
                                                            {player.cash}
                                                        </td>
                                                        <td className="border-b px-2 py-2 tabular-nums">
                                                            {player.ping ??
                                                                t.unknown}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                            <p className="text-muted-foreground text-xs">
                                {t.unconfirmed}
                            </p>
                        </>
                    )}
                </div>
            )}
        </details>
    )
}
