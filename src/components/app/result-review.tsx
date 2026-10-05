"use client"

import { CheckCircle2, Clock3, Loader2, Server } from "lucide-react"
import { useEffect, useId, useMemo, useState } from "react"
import { z } from "zod"

import {
    resultReviewSchema,
    resultRevisionSchema,
    type ResultAction,
    type ResultRevision,
} from "@/domain/match-results/result-revision"
import { suggestResultSession } from "@/domain/match-results/session-pick"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type ReviewData = z.infer<typeof resultReviewSchema>
type Props = {
    serverId: string
    eventId: string
    gameId: GameId
    dictionary: Dictionary
    /** Server-rendered review, shown before the first refresh finishes. */
    initialData?: ReviewData | null
    /** Match start, used to suggest the server game the result came from. */
    matchStart?: string
    locale?: string
    timeZone?: string
    /** Names of the admins and importers in the history, by Discord ID. */
    actorNames?: Record<string, string>
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

function toInputs(
    participants: ReadonlyArray<{
        id: string
        label: string
        score: number | null
    }>
): ScoreInput[] {
    return participants.map((p) => ({
        ...p,
        score: p.score === null ? "" : String(p.score),
    }))
}

/** Editor fields for a review: the current result, else the server game
 * that matches the match time, else two empty participants. */
function editorState(
    data: ReviewData,
    matchStart: string | undefined,
    participantLabel: string
) {
    const suggestion =
        !data.current && matchStart
            ? suggestResultSession(data.sessions, matchStart)
            : null
    return {
        scores: data.current
            ? toInputs(data.current.participants)
            : suggestion?.participants.length
              ? toInputs(suggestion.participants)
              : [1, 2].map((n) => ({
                    id: `participant-${n}`,
                    label: `${participantLabel} ${n}`,
                    score: "",
                })),
        source: data.current?.sessionLinks.length
            ? "keep"
            : (suggestion?.id ?? ""),
        suggested: Boolean(suggestion),
    }
}

function scoreText(
    participants: ReadonlyArray<{ score: number | string | null }>
) {
    return participants
        .map((p) =>
            p.score === null || p.score === "" ? "–" : String(p.score)
        )
        .join(" : ")
}

/**
 * Review of a match result (design E2): the score, the server game it came
 * from, confirmation, and a history where a confirmed result changes only by
 * a correction with a reason.
 */
function Review({
    serverId,
    eventId,
    gameId,
    dictionary,
    initialData,
    matchStart,
    locale = "en",
    timeZone = "UTC",
    actorNames = {},
}: Props) {
    const t = dictionary.resultReview
    const m = dictionary.matchDetail.result
    const heading = useId()
    const [initial] = useState(() =>
        initialData ? editorState(initialData, matchStart, t.participant) : null
    )
    const [data, setData] = useState<ReviewData | null>(initialData ?? null)
    const [scores, setScores] = useState<ScoreInput[]>(initial?.scores ?? [])
    const [source, setSource] = useState(initial?.source ?? "")
    const [suggested, setSuggested] = useState(initial?.suggested ?? false)
    const [choosingSource, setChoosingSource] = useState(false)
    const [reason, setReason] = useState("")
    const [dirty, setDirty] = useState(false)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(false)
    const [refresh, setRefresh] = useState(0)
    const endpoint = `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(eventId)}/results?game=${gameId}`

    useEffect(() => {
        const controller = new AbortController()
        void fetch(endpoint, { cache: "no-store", signal: controller.signal })
            .then(async (response) => {
                if (!response.ok) throw new Error()
                const result = resultReviewSchema.parse(await response.json())
                if (controller.signal.aborted) return
                const next = editorState(result, matchStart, t.participant)
                setData(result)
                setScores(next.scores)
                setSource(next.source)
                setSuggested(next.suggested)
                setChoosingSource(false)
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
    }, [endpoint, refresh, t.participant, matchStart])

    const reload = () => {
        setLoading(true)
        setRefresh((n) => n + 1)
    }

    function formatTime(value: string | null | undefined) {
        if (!value) return t.unknownScore
        return new Intl.DateTimeFormat(locale, {
            timeZone,
            weekday: "short",
            day: "numeric",
            month: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value))
    }

    function formatClock(value: string | null | undefined) {
        if (!value) return ""
        return new Intl.DateTimeFormat(locale, {
            timeZone,
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(value))
    }

    async function send(action: ResultAction, expectedRevision: number) {
        const sessionLinks =
            source === "keep"
                ? (data?.current?.sessionLinks.map((s) => s.sessionId) ?? [])
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
            expectedRevision,
            ...(action !== "confirm"
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
        return resultRevisionSchema.parse(await response.json())
    }

    async function run(action: "stage" | "confirm" | "correct") {
        setLoading(true)
        setError(false)
        try {
            const version = data?.current?.version ?? 0
            if (action === "confirm") {
                // Unsaved edits are saved first, then confirmed as reviewed.
                const staged =
                    dirty || data?.current?.status !== "provisional"
                        ? await send("stage", version)
                        : null
                await send("confirm", staged?.version ?? version)
            } else {
                await send(action, version)
            }
            reload()
        } catch {
            setError(true)
            setLoading(false)
        }
    }

    async function stageLegacyImport() {
        setLoading(true)
        setError(false)
        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "stage",
                    expectedRevision: data?.current?.version ?? 0,
                }),
            })
            if (!response.ok) throw new Error()
            reload()
        } catch {
            setError(true)
            setLoading(false)
        }
    }

    const current = data?.current ?? null
    const reviewed = current !== null && current.status !== "provisional"
    const status = current?.status ?? "none"
    const selectedSession = data?.sessions.find((s) => s.id === source)
    const linkedPlayers = current?.players.filter((p) => p.logiUserId).length
    const unlinkedPlayers = current?.players.filter((p) => !p.logiUserId).length
    // Oldest first, so the pending confirmation follows the last entry.
    const history = useMemo(
        () => [...(data?.history ?? [])].reverse(),
        [data?.history]
    )

    function sourceTitle() {
        if (source === "keep" && current?.sessionLinks.length) {
            const link = current.sessionLinks[0]!
            return m.sourceSession
                .replace("{map}", link.map ?? m.unknownMap)
                .replace(
                    "{time}",
                    `${formatTime(link.startedAt)}${link.endedAt ? `–${formatClock(link.endedAt)}` : ""}`
                )
        }
        if (selectedSession)
            return m.sourceSession
                .replace("{map}", selectedSession.map ?? m.unknownMap)
                .replace("{time}", formatTime(selectedSession.startedAt))
        return m.sourceManual
    }

    function sourceDetail() {
        const complete =
            source === "keep"
                ? current?.sessionLinks.every((s) => s.complete)
                : selectedSession?.complete
        if (source === "keep" || selectedSession)
            return [
                suggested && source !== "keep" ? m.sourceSuggested : null,
                complete ? m.complete : m.incomplete,
            ]
                .filter(Boolean)
                .join(" · ")
        return null
    }

    function revisionTitle(revision: ResultRevision) {
        const score = scoreText(revision.participants)
        return revision.origin !== "manual" && revision.status === "provisional"
            ? m.historyImport.replace("{score}", score)
            : m.historyEntry[revision.status].replace("{score}", score)
    }

    function revisionWho(revision: ResultRevision) {
        const id = revision.reviewerId ?? revision.createdBy
        return id ? (actorNames[id] ?? id) : m.automatic
    }

    const editable = !loading && Boolean(data)
    const confirmScore = scoreText(scores)

    return (
        <section
            className="@container"
            aria-labelledby={heading}
            aria-busy={loading}
        >
            <div className="grid gap-4 @3xl:grid-cols-[minmax(0,1fr)_18rem]">
                <div className="border-border/60 bg-card space-y-4 rounded-2xl border p-4 sm:p-5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                        <h2 id={heading} className="text-base font-semibold">
                            {m.title}
                        </h2>
                        <div className="flex items-center gap-2">
                            <Badge
                                variant={reviewed ? "default" : "secondary"}
                                className="rounded-full"
                                role="status"
                            >
                                {reviewed ? (
                                    <CheckCircle2 className="size-3.5" />
                                ) : (
                                    <Clock3 className="size-3.5" />
                                )}
                                {m.status[status]}
                            </Badge>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={reload}
                                disabled={loading}
                            >
                                {loading ? (
                                    <Loader2 className="size-4 animate-spin" />
                                ) : null}
                                {loading ? t.loading : t.refresh}
                            </Button>
                        </div>
                    </div>
                    {error ? (
                        <p className="text-destructive text-sm" role="alert">
                            {t.error}
                        </p>
                    ) : null}
                    {data ? (
                        <>
                            <div className="flex flex-wrap items-end gap-3">
                                {scores.map((row, index) => (
                                    <div
                                        key={row.id}
                                        className="flex items-end gap-2"
                                    >
                                        {index > 0 && scores.length === 2 ? (
                                            <span
                                                aria-hidden="true"
                                                className="pb-2 text-2xl font-semibold"
                                            >
                                                :
                                            </span>
                                        ) : null}
                                        <label className="flex flex-col gap-1">
                                            <Input
                                                aria-label={m.nameLabel.replace(
                                                    "{index}",
                                                    String(index + 1)
                                                )}
                                                value={row.label}
                                                disabled={!editable}
                                                className="h-7 w-32 text-xs"
                                                onChange={(e) => {
                                                    setScores(
                                                        scores.map((s, i) =>
                                                            i === index
                                                                ? {
                                                                      ...s,
                                                                      label: e
                                                                          .target
                                                                          .value,
                                                                  }
                                                                : s
                                                        )
                                                    )
                                                    setDirty(true)
                                                }}
                                            />
                                            <Input
                                                aria-label={m.scoreLabel.replace(
                                                    "{name}",
                                                    row.label
                                                )}
                                                type="number"
                                                step="any"
                                                value={row.score}
                                                disabled={!editable}
                                                placeholder="—"
                                                className="h-12 w-32 text-center text-2xl font-semibold tabular-nums"
                                                onChange={(e) => {
                                                    setScores(
                                                        scores.map((s, i) =>
                                                            i === index
                                                                ? {
                                                                      ...s,
                                                                      score: e
                                                                          .target
                                                                          .value,
                                                                  }
                                                                : s
                                                        )
                                                    )
                                                    setDirty(true)
                                                }}
                                            />
                                        </label>
                                        {scores.length > 2 ? (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                aria-label={`${t.remove} ${index + 1}`}
                                                disabled={!editable}
                                                onClick={() => {
                                                    setScores(
                                                        scores.filter(
                                                            (_, i) =>
                                                                i !== index
                                                        )
                                                    )
                                                    setDirty(true)
                                                }}
                                            >
                                                −
                                            </Button>
                                        ) : null}
                                    </div>
                                ))}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    disabled={!editable || scores.length >= 16}
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
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {t.scoreHelp}
                            </p>

                            <div className="space-y-2">
                                <div className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
                                    {m.source}
                                </div>
                                <div className="border-border/60 bg-muted/30 flex flex-wrap items-center gap-3 rounded-xl border px-3 py-2.5">
                                    <Server
                                        className="text-muted-foreground size-4 shrink-0"
                                        aria-hidden
                                    />
                                    <span className="flex min-w-0 flex-1 flex-col">
                                        <span className="text-sm font-medium break-words">
                                            {sourceTitle()}
                                        </span>
                                        {sourceDetail() ? (
                                            <span className="text-muted-foreground text-xs">
                                                {sourceDetail()}
                                            </span>
                                        ) : null}
                                    </span>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        className="rounded-lg"
                                        aria-expanded={choosingSource}
                                        disabled={!editable}
                                        onClick={() =>
                                            setChoosingSource(!choosingSource)
                                        }
                                    >
                                        {m.otherGame}
                                    </Button>
                                </div>
                                {choosingSource ? (
                                    <select
                                        aria-label={t.source}
                                        className="bg-background w-full rounded-md border p-2 text-sm"
                                        value={source}
                                        disabled={!editable}
                                        onChange={(e) => {
                                            const value = e.target.value
                                            setSource(value)
                                            setSuggested(false)
                                            setDirty(true)
                                            const selected = data.sessions.find(
                                                (s) => s.id === value
                                            )
                                            if (selected?.participants.length)
                                                setScores(
                                                    toInputs(
                                                        selected.participants
                                                    )
                                                )
                                        }}
                                    >
                                        <option value="">
                                            {m.sourceManual}
                                        </option>
                                        {current?.sessionLinks.length ? (
                                            <option value="keep">
                                                {m.sourceKeep.replace(
                                                    "{count}",
                                                    String(
                                                        current.sessionLinks
                                                            .length
                                                    )
                                                )}
                                            </option>
                                        ) : null}
                                        {data.sessions.map((s) => (
                                            <option key={s.id} value={s.id}>
                                                {m.sourceSession
                                                    .replace(
                                                        "{map}",
                                                        s.map ?? m.unknownMap
                                                    )
                                                    .replace(
                                                        "{time}",
                                                        formatTime(s.startedAt)
                                                    )}{" "}
                                                ·{" "}
                                                {s.complete
                                                    ? m.complete
                                                    : m.incomplete}
                                            </option>
                                        ))}
                                    </select>
                                ) : null}
                                {current ? (
                                    <p className="text-muted-foreground text-xs">
                                        {m.attribution
                                            .replace(
                                                "{linked}",
                                                String(linkedPlayers ?? 0)
                                            )
                                            .replace(
                                                "{unlinked}",
                                                String(unlinkedPlayers ?? 0)
                                            )}
                                    </p>
                                ) : null}
                            </div>

                            {reviewed ? (
                                <label className="block space-y-1 text-sm">
                                    <span>{m.reason}</span>
                                    <Input
                                        aria-label={m.reason}
                                        value={reason}
                                        maxLength={500}
                                        disabled={!editable}
                                        onChange={(e) =>
                                            setReason(e.target.value)
                                        }
                                    />
                                    {!reason.trim() ? (
                                        <span className="text-muted-foreground text-xs">
                                            {m.reasonRequired}
                                        </span>
                                    ) : null}
                                </label>
                            ) : null}

                            <div className="flex flex-wrap justify-end gap-2">
                                {reviewed ? (
                                    <Button
                                        className="rounded-xl"
                                        disabled={!editable || !reason.trim()}
                                        onClick={() => run("correct")}
                                    >
                                        {m.correct}
                                    </Button>
                                ) : (
                                    <>
                                        {data.hasLegacyImport ? (
                                            <Button
                                                variant="ghost"
                                                className="rounded-xl"
                                                disabled={!editable}
                                                onClick={stageLegacyImport}
                                            >
                                                {t.useImport}
                                            </Button>
                                        ) : null}
                                        <Button
                                            variant="outline"
                                            className="rounded-xl"
                                            disabled={!editable}
                                            onClick={() => run("stage")}
                                        >
                                            {m.saveWithoutConfirm}
                                        </Button>
                                        <Button
                                            className="rounded-xl"
                                            disabled={!editable}
                                            onClick={() => run("confirm")}
                                        >
                                            <CheckCircle2 className="size-4" />
                                            {m.confirm.replace(
                                                "{score}",
                                                confirmScore
                                            )}
                                        </Button>
                                    </>
                                )}
                            </div>
                            {dirty && !reviewed ? (
                                <p className="text-muted-foreground text-xs">
                                    {t.unsaved}
                                </p>
                            ) : null}
                        </>
                    ) : null}
                </div>

                <aside
                    aria-labelledby={`${heading}-history`}
                    className="border-border/60 bg-card h-fit space-y-3 rounded-2xl border p-4 sm:p-5"
                >
                    <h2
                        id={`${heading}-history`}
                        className="text-base font-semibold"
                    >
                        {m.history}
                    </h2>
                    {history.length === 0 && !current ? (
                        <p className="text-muted-foreground text-sm">
                            {m.historyEmpty}
                        </p>
                    ) : (
                        <ol className="space-y-3">
                            {history.map((revision) => (
                                <li
                                    key={revision.version}
                                    className="flex gap-2.5"
                                >
                                    <span
                                        aria-hidden="true"
                                        className={cn(
                                            "mt-1.5 size-2 shrink-0 rounded-full",
                                            revision.status === "provisional"
                                                ? "bg-muted-foreground/60"
                                                : "bg-primary"
                                        )}
                                    />
                                    <span className="flex min-w-0 flex-col text-sm">
                                        <span className="font-medium">
                                            {revisionTitle(revision)}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {m.historyAt
                                                .replace(
                                                    "{date}",
                                                    formatTime(
                                                        revision.createdAt
                                                    )
                                                )
                                                .replace(
                                                    "{who}",
                                                    revisionWho(revision)
                                                )}
                                        </span>
                                        {revision.reason ? (
                                            <span className="text-muted-foreground text-xs break-words">
                                                {t.reason}: {revision.reason}
                                            </span>
                                        ) : null}
                                    </span>
                                </li>
                            ))}
                            {current?.status === "provisional" ? (
                                <li className="flex gap-2.5">
                                    <span
                                        aria-hidden="true"
                                        className="border-muted-foreground/50 mt-1.5 size-2 shrink-0 rounded-full border"
                                    />
                                    <span className="flex flex-col text-sm">
                                        <span className="font-medium">
                                            {m.historyNext}
                                        </span>
                                        <span className="text-muted-foreground text-xs">
                                            {m.historyNextDetail}
                                        </span>
                                    </span>
                                </li>
                            ) : null}
                        </ol>
                    )}
                    <p className="text-muted-foreground border-border/60 border-t pt-3 text-xs">
                        {m.correctionNote}
                    </p>
                </aside>
            </div>
        </section>
    )
}
