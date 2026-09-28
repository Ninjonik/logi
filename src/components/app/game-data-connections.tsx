"use client"

import { gameDataSettingsSchema } from "@/domain/game-data/contracts"
import { useCallback, useEffect, useState } from "react"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import type { z } from "zod"

type Props = { serverId: string; dictionary: Dictionary }
type Settings = z.infer<typeof gameDataSettingsSchema>

export function GameDataConnections(props: Props) {
    return <Connections key={props.serverId} {...props} />
}
function Connections({ serverId, dictionary }: Props) {
    const t = dictionary.gameData
    const [data, setData] = useState<Settings | null>(null)
    const [error, setError] = useState(false)
    const [loading, setLoading] = useState(true)
    const [pending, setPending] = useState<string | null>(null)
    const url = `/api/servers/${encodeURIComponent(serverId)}/game-data`
    const load = useCallback(
        (signal?: AbortSignal) =>
            fetch(url, { cache: "no-store", signal })
                .then(async (response) => {
                    if (!response.ok) throw new Error()
                    const result = gameDataSettingsSchema.parse(
                        await response.json()
                    )
                    if (!signal?.aborted) {
                        setData(result)
                        setError(false)
                    }
                })
                .catch(() => {
                    if (!signal?.aborted) setError(true)
                })
                .finally(() => {
                    if (!signal?.aborted) setLoading(false)
                }),
        [url]
    )
    useEffect(() => {
        const controller = new AbortController()
        void load(controller.signal)
        return () => controller.abort()
    }, [load])
    async function configure(sourceRef: string, enabled: boolean) {
        setPending(sourceRef)
        setError(false)
        try {
            const response = await fetch(url, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ sourceRef, enabled }),
            })
            if (!response.ok) throw new Error()
            await load()
        } catch {
            setError(true)
        } finally {
            setPending(null)
        }
    }
    const refs = [
        ...new Set([
            ...(data?.sources.map((source) => source.ref) ?? []),
            ...(data?.connections.map((entry) => entry.sourceRef) ?? []),
        ]),
    ]
    return (
        <div className="space-y-4">
            <p className="text-muted-foreground text-sm">{t.description}</p>
            <div className="flex items-center gap-3">
                <Button
                    variant="outline"
                    disabled={loading || pending !== null}
                    onClick={() => {
                        setLoading(true)
                        void load()
                    }}
                >
                    {loading ? t.loading : t.refresh}
                </Button>
            </div>
            {error && (
                <p role="alert" className="text-destructive text-sm">
                    {t.error}
                </p>
            )}
            {!loading && data && refs.length === 0 && (
                <p className="rounded-lg border p-4 text-sm">{t.empty}</p>
            )}
            {refs.map((ref) => {
                const source = data?.sources.find(
                    (source) => source.ref === ref
                )
                const entry = data?.connections.find(
                    (entry) => entry.sourceRef === ref
                )
                const snapshot = entry?.snapshot
                const health = entry?.health
                const resumable =
                    !health?.enabled ||
                    health.nextAttemptAt === null ||
                    ["unauthorized", "unsupported", "configuration"].includes(
                        health.historyErrorCategory ?? ""
                    )
                return (
                    <section
                        key={ref}
                        className="space-y-3 rounded-lg border p-4"
                        aria-label={ref}
                    >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0">
                                <h3 className="font-medium break-words">
                                    {snapshot?.displayName ?? ref}
                                </h3>
                                <p className="text-muted-foreground text-xs">
                                    {(source?.gameId ?? snapshot?.gameId) ===
                                    "wardogs"
                                        ? "Wardogs"
                                        : "Hell Let Loose"}{" "}
                                    · {source?.provider ?? snapshot?.provider}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {source && resumable && (
                                    <Button
                                        variant="outline"
                                        disabled={pending !== null || loading}
                                        onClick={() =>
                                            void configure(ref, true)
                                        }
                                    >
                                        {pending === ref ? t.saving : t.enable}
                                    </Button>
                                )}
                                {health?.enabled && (
                                    <Button
                                        variant="outline"
                                        disabled={pending !== null || loading}
                                        onClick={() =>
                                            void configure(ref, false)
                                        }
                                    >
                                        {pending === ref ? t.saving : t.disable}
                                    </Button>
                                )}
                            </div>
                        </div>
                        <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                            <div>
                                <dt className="text-muted-foreground">
                                    {t.state}
                                </dt>
                                <dd>
                                    {!health?.enabled
                                        ? t.disabled
                                        : t.freshness[
                                              snapshot?.freshness ??
                                                  "unavailable"
                                          ]}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    {t.players}
                                </dt>
                                <dd>
                                    {snapshot?.players ?? t.unknown} /{" "}
                                    {snapshot?.capacity ?? t.unknown}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    {t.map}
                                </dt>
                                <dd className="break-words">
                                    {snapshot?.map ?? t.unknown}
                                </dd>
                            </div>
                            <div>
                                <dt className="text-muted-foreground">
                                    {t.observed}
                                </dt>
                                <dd className="break-words">
                                    {snapshot?.observedAt
                                        ? new Date(
                                              snapshot.observedAt
                                          ).toLocaleString()
                                        : t.never}
                                </dd>
                            </div>
                        </dl>
                        {snapshot?.scores.length ? (
                            <p className="text-sm">
                                {snapshot.scores
                                    .map(
                                        (score) =>
                                            `${score.label}: ${score.score ?? t.unknown}`
                                    )
                                    .join(" · ")}{" "}
                                <span className="text-muted-foreground">
                                    ({t.unconfirmed})
                                </span>
                            </p>
                        ) : null}
                        <p className="text-muted-foreground text-xs">
                            {health?.capabilities.includes("match_history")
                                ? t.historySupported
                                : t.historyUnsupported}
                        </p>
                        {health?.collectedSessions != null && (
                            <p className="text-sm">
                                {t.collectedSessions}:{" "}
                                {health.collectedSessions} · {t.historyObserved}
                                :{" "}
                                {health.lastHistorySuccessAt
                                    ? new Date(
                                          health.lastHistorySuccessAt
                                      ).toLocaleString()
                                    : t.never}
                            </p>
                        )}
                        {health?.historyErrorCategory && (
                            <p role="status" className="text-sm">
                                {t.historyError}:{" "}
                                {t.errors[health.historyErrorCategory]}
                            </p>
                        )}
                        {health?.errorCategory && (
                            <p role="status" className="text-sm">
                                {t.errors[health.errorCategory]}
                            </p>
                        )}
                        {snapshot?.attribution && (
                            <a
                                className="text-xs underline"
                                href={snapshot.attribution.url}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {snapshot.attribution.label}
                            </a>
                        )}
                    </section>
                )
            })}
        </div>
    )
}
