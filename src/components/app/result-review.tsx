"use client"

import {
    resultReviewSchema,
    type ResultAction,
} from "@/domain/match-results/result-revision"
import type { Dictionary } from "@/i18n/dictionaries"
import { useEffect, useId, useState } from "react"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { z } from "zod"
type Props = {
    serverId: string
    eventId: string
    gameId: GameId
    dictionary: Dictionary
}
type ScoreInput = { id: string; label: string; score: string }
export function ResultReview(props: Props) {
    return (
        <Review
            key={`${props.serverId}:${props.eventId}:${props.gameId}`}
            {...props}
        />
    )
}
function Review({ serverId, eventId, gameId, dictionary }: Props) {
    const t = dictionary.resultReview,
        heading = useId()
    const [data, setData] = useState<z.infer<typeof resultReviewSchema> | null>(
        null
    )
    const [scores, setScores] = useState<ScoreInput[]>([]),
        [source, setSource] = useState("")
    const [reason, setReason] = useState(""),
        [dirty, setDirty] = useState(false)
    const [loading, setLoading] = useState(true),
        [error, setError] = useState(false),
        [refresh, setRefresh] = useState(0)
    const endpoint = `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(eventId)}/results?game=${gameId}`
    useEffect(() => {
        const controller = new AbortController()
        void fetch(endpoint, { cache: "no-store", signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error()
                const result = resultReviewSchema.parse(await response.json())
                if (controller.signal.aborted) return
                setData(result)
                setScores(
                    result.current?.participants.map((p) => ({
                        ...p,
                        score: p.score === null ? "" : String(p.score),
                    })) ??
                        [1, 2].map((n) => ({
                            id: `participant-${n}`,
                            label: `${t.participant} ${n}`,
                            score: "",
                        }))
                )
                setSource(result.current?.sessionLinks.length ? "keep" : "")
                setReason("")
                setDirty(false)
                setError(false)
            })
            .catch(() => {
                if (!controller.signal.aborted) {
                    setData(null)
                    setError(true)
                }
            })
            .finally(() => {
                if (!controller.signal.aborted) setLoading(false)
            })
        return () => controller.abort()
    }, [endpoint, refresh, t.participant])
    const reload = () => {
        setLoading(true)
        setData(null)
        setRefresh((n) => n + 1)
    }
    async function save(action: ResultAction, legacy = false) {
        setLoading(true)
        setError(false)
        try {
            const sessionLinks =
                source === "keep"
                    ? (data?.current?.sessionLinks.map((s) => s.sessionId) ??
                      [])
                    : source
                      ? [source]
                      : []
            const participants = scores.map((p) => ({
                ...p,
                score: p.score.trim() === "" ? null : Number(p.score),
            }))
            if (
                participants.some(
                    (p) => p.score !== null && !Number.isFinite(p.score)
                )
            )
                throw new Error()
            const selected = data?.sessions.find((s) => s.id === source)
            const matchesSource =
                selected &&
                JSON.stringify(participants) ===
                    JSON.stringify(selected.participants)
            const command = {
                action,
                expectedRevision: data?.current?.version ?? 0,
                ...(action !== "confirm" && !legacy
                    ? {
                          sessionLinks,
                          ...(!matchesSource ? { participants } : {}),
                      }
                    : {}),
                ...(action === "correct" ? { reason } : {}),
            }
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(command),
            })
            if (!response.ok) throw new Error()
            reload()
        } catch {
            setError(true)
            setLoading(false)
        }
    }
    return (
        <section
            className="space-y-4"
            aria-labelledby={heading}
            aria-busy={loading}
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id={heading} className="font-semibold">
                    {t.title}
                </h3>
                <Button variant="outline" onClick={reload} disabled={loading}>
                    {loading ? t.loading : t.refresh}
                </Button>
            </div>
            <p className="text-muted-foreground text-sm">{t.description}</p>
            {error && (
                <p className="text-destructive text-sm" role="alert">
                    {t.error}
                </p>
            )}
            {data && (
                <>
                    <div className="space-y-2 rounded-xl border p-3 text-sm">
                        <p role="status" className="font-medium">
                            {t.status[data.current?.status ?? "unknown"]}
                            {data.current
                                ? ` · ${t.revision} ${data.current.version}`
                                : ""}
                        </p>
                        {data.current && (
                            <>
                                <ul className="flex flex-wrap gap-4">
                                    {data.current.participants.map((p) => (
                                        <li key={p.id}>
                                            {p.label}:{" "}
                                            <strong>
                                                {p.score === null
                                                    ? t.unknownScore
                                                    : p.score}
                                            </strong>
                                        </li>
                                    ))}
                                </ul>
                                <p>
                                    {t.attribution}:{" "}
                                    {
                                        data.current.players.filter(
                                            (p) => p.logiUserId
                                        ).length
                                    }{" "}
                                    {t.verified},{" "}
                                    {
                                        data.current.players.filter(
                                            (p) => !p.logiUserId
                                        ).length
                                    }{" "}
                                    {t.unresolved}
                                </p>
                                {data.current.reviewedAt && (
                                    <p>
                                        {t.reviewedAt}:{" "}
                                        {data.current.reviewedAt} · {t.reviewer}
                                        : {data.current.reviewerId}
                                    </p>
                                )}
                                {data.current.sessionLinks.map((s) => (
                                    <p
                                        className="break-words"
                                        key={s.sessionId}
                                    >
                                        {s.provider} · {s.map ?? t.unknownScore}{" "}
                                        · {s.externalId} ·{" "}
                                        {s.complete ? t.complete : t.incomplete}
                                    </p>
                                ))}
                            </>
                        )}
                    </div>
                    <div className="space-y-3 rounded-xl border p-3">
                        <label className="block space-y-1 text-sm">
                            <span>{t.source}</span>
                            <select
                                aria-label={t.source}
                                className="bg-background w-full rounded-md border p-2"
                                value={source}
                                disabled={loading}
                                onChange={(e) => {
                                    const value = e.target.value
                                    setSource(value)
                                    setDirty(true)
                                    const selected = data.sessions.find(
                                        (s) => s.id === value
                                    )
                                    if (selected?.participants.length)
                                        setScores(
                                            selected.participants.map((p) => ({
                                                ...p,
                                                score:
                                                    p.score === null
                                                        ? ""
                                                        : String(p.score),
                                            }))
                                        )
                                }}
                            >
                                <option value="">{t.manual}</option>
                                {Boolean(data.current?.sessionLinks.length) && (
                                    <option value="keep">
                                        {t.keepSources} (
                                        {data.current?.sessionLinks.length})
                                    </option>
                                )}
                                {data.sessions.map((s) => (
                                    <option key={s.id} value={s.id}>
                                        {s.map ?? t.unknownScore} ·{" "}
                                        {s.externalId} ·{" "}
                                        {s.startedAt ?? t.unknownScore} ·{" "}
                                        {s.complete ? t.complete : t.incomplete}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <p className="text-muted-foreground text-xs">
                            {t.scoreHelp}
                        </p>
                        {scores.map((row, index) => (
                            <div
                                className="flex flex-wrap items-end gap-2"
                                key={row.id}
                            >
                                <label className="min-w-0 flex-1 space-y-1 text-sm">
                                    <span>
                                        {t.participant} {index + 1}
                                    </span>
                                    <Input
                                        aria-label={`${t.participant} ${index + 1}`}
                                        value={row.label}
                                        disabled={loading}
                                        onChange={(e) => {
                                            setScores(
                                                scores.map((s, i) =>
                                                    i === index
                                                        ? {
                                                              ...s,
                                                              label: e.target
                                                                  .value,
                                                          }
                                                        : s
                                                )
                                            )
                                            setDirty(true)
                                        }}
                                    />
                                </label>
                                <label className="w-24 space-y-1 text-sm">
                                    <span>{t.score}</span>
                                    <Input
                                        aria-label={`${t.score} ${index + 1}`}
                                        type="number"
                                        step="any"
                                        value={row.score}
                                        disabled={loading}
                                        placeholder="—"
                                        onChange={(e) => {
                                            setScores(
                                                scores.map((s, i) =>
                                                    i === index
                                                        ? {
                                                              ...s,
                                                              score: e.target
                                                                  .value,
                                                          }
                                                        : s
                                                )
                                            )
                                            setDirty(true)
                                        }}
                                    />
                                </label>
                                <Button
                                    variant="outline"
                                    aria-label={`${t.remove} ${index + 1}`}
                                    disabled={loading || scores.length <= 2}
                                    onClick={() => {
                                        setScores(
                                            scores.filter((_, i) => i !== index)
                                        )
                                        setDirty(true)
                                    }}
                                >
                                    −
                                </Button>
                            </div>
                        ))}
                        <Button
                            variant="outline"
                            disabled={loading || scores.length >= 16}
                            onClick={() => {
                                setScores([
                                    ...scores,
                                    {
                                        id: crypto.randomUUID(),
                                        label: `${t.participant} ${scores.length + 1}`,
                                        score: "",
                                    },
                                ])
                                setDirty(true)
                            }}
                        >
                            {t.addParticipant}
                        </Button>
                        {data.current &&
                            data.current.status !== "provisional" && (
                                <label className="block space-y-1 text-sm">
                                    <span>{t.reason}</span>
                                    <Input
                                        aria-label={t.reason}
                                        value={reason}
                                        maxLength={500}
                                        onChange={(e) =>
                                            setReason(e.target.value)
                                        }
                                    />
                                </label>
                            )}
                        <div className="flex flex-wrap gap-2">
                            {!data.current ||
                            data.current.status === "provisional" ? (
                                <>
                                    <Button
                                        variant="outline"
                                        disabled={loading}
                                        onClick={() => save("stage")}
                                    >
                                        {t.stage}
                                    </Button>
                                    <Button
                                        disabled={
                                            loading ||
                                            dirty ||
                                            data.current?.status !==
                                                "provisional"
                                        }
                                        onClick={() => save("confirm")}
                                    >
                                        {t.confirm}
                                    </Button>
                                    {data.hasLegacyImport && (
                                        <Button
                                            variant="outline"
                                            disabled={loading}
                                            onClick={() => save("stage", true)}
                                        >
                                            {t.useImport}
                                        </Button>
                                    )}
                                </>
                            ) : (
                                <Button
                                    disabled={loading || !reason.trim()}
                                    onClick={() => save("correct")}
                                >
                                    {t.correct}
                                </Button>
                            )}
                        </div>
                        {dirty &&
                            (!data.current ||
                                data.current.status === "provisional") && (
                                <p className="text-muted-foreground text-xs">
                                    {t.unsaved}
                                </p>
                            )}
                    </div>
                    {data.history.length > 0 && (
                        <details className="rounded-xl border p-3 text-sm">
                            <summary className="cursor-pointer font-medium">
                                {t.history} ({data.history.length})
                            </summary>
                            <ol className="mt-3 space-y-3">
                                {data.history.map((r) => (
                                    <li
                                        className="space-y-1 border-t pt-2"
                                        key={r.version}
                                    >
                                        <p className="font-medium">
                                            {t.revision} {r.version} ·{" "}
                                            {t.status[r.status]}
                                        </p>
                                        <p>
                                            {r.createdAt} ·{" "}
                                            {r.reviewerId ??
                                                r.createdBy ??
                                                t.importer}
                                        </p>
                                        <p>
                                            {r.participants
                                                .map(
                                                    (p) =>
                                                        `${p.label}: ${p.score === null ? t.unknownScore : p.score}`
                                                )
                                                .join(" · ")}
                                        </p>
                                        {r.reason && (
                                            <p className="break-words">
                                                {t.reason}: {r.reason}
                                            </p>
                                        )}
                                    </li>
                                ))}
                            </ol>
                        </details>
                    )}
                </>
            )}
        </section>
    )
}
