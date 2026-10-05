"use client"

import { BellRing, ChevronRight, Search, Users } from "lucide-react"
import { useMemo, useState } from "react"
import Link from "next/link"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type {
    MatchBadgeTone,
    MatchListQueueRow,
    MatchListRow,
} from "@/lib/match-list-rows"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { cn } from "@/lib/utils"

type Tab = "upcoming" | "played"

const RECENTLY_PLAYED_WEEKS = 2
const RECENTLY_PLAYED_COUNT = 3

const badgeTones: Record<MatchBadgeTone, string> = {
    info: "border-sky-500/30 bg-sky-500/10 text-sky-900 dark:text-sky-100",
    attention:
        "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    success:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    neutral: "border-border bg-muted text-muted-foreground",
}

function groupRows(rows: MatchListRow[]) {
    const groups: Array<{ key: number; label: string; rows: MatchListRow[] }> =
        []
    for (const row of rows) {
        const last = groups.at(-1)
        if (last && last.key === row.weekKey) last.rows.push(row)
        else
            groups.push({ key: row.weekKey, label: row.weekLabel, rows: [row] })
    }
    return groups
}

function MatchRows({
    id,
    label,
    rows,
}: {
    id: string
    label: string
    rows: MatchListRow[]
}) {
    return (
        <section aria-labelledby={id} className="space-y-2">
            <h2
                id={id}
                className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
            >
                {label}
            </h2>
            <ul className="border-border/60 divide-border/60 divide-y overflow-hidden rounded-2xl border">
                {rows.map((row) => (
                    <li key={row.id}>
                        <Link
                            href={row.href}
                            className="hover:bg-muted/50 flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors"
                        >
                            <span className="flex w-16 shrink-0 flex-col items-center leading-tight">
                                <span className="text-muted-foreground text-xs">
                                    {row.date}
                                </span>
                                <span className="text-base font-semibold tabular-nums">
                                    {row.time}
                                </span>
                            </span>
                            <span className="flex min-w-0 flex-[1_1_14rem] flex-col leading-snug">
                                <span className="truncate text-sm font-semibold">
                                    {row.title}
                                </span>
                                {row.details ? (
                                    <span className="text-muted-foreground truncate text-sm">
                                        {row.details}
                                    </span>
                                ) : null}
                            </span>
                            <span
                                className={cn(
                                    "shrink-0 tabular-nums",
                                    row.metricStrong
                                        ? "text-sm font-semibold"
                                        : "text-muted-foreground text-sm"
                                )}
                            >
                                {row.metric}
                            </span>
                            <span
                                className={cn(
                                    "inline-flex h-6 shrink-0 items-center rounded-full border px-2.5 text-xs font-medium",
                                    badgeTones[row.badge.tone]
                                )}
                            >
                                {row.badge.label}
                            </span>
                            <ChevronRight
                                className="text-muted-foreground/70 hidden size-4 shrink-0 sm:block"
                                aria-hidden="true"
                            />
                        </Link>
                    </li>
                ))}
            </ul>
        </section>
    )
}

/**
 * Matches and trainings of a clan: organiser tasks first, then upcoming or
 * played events grouped by week, filtered by kind, game and text.
 */
export function MatchList({
    rows,
    queue,
    games,
    initialGame,
    initialTab,
    dictionary,
}: {
    rows: MatchListRow[]
    queue: MatchListQueueRow[]
    games: Array<{ id: GameId; label: string }>
    initialGame?: GameId
    initialTab?: Tab
    dictionary: Dictionary
}) {
    const text = dictionary.matchList
    const [tab, setTab] = useState<Tab>(initialTab ?? "upcoming")
    const [kinds, setKinds] = useState({ match: true, training: true })
    const [game, setGame] = useState<GameId | "all">(initialGame ?? "all")
    const [query, setQuery] = useState("")

    const filtered = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase()
        return rows.filter(
            (row) =>
                kinds[row.kind] &&
                (game === "all" || row.gameId === game) &&
                (!needle || row.search.includes(needle))
        )
    }, [game, kinds, query, rows])
    const upcoming = filtered.filter((row) => !row.played)
    const played = filtered.filter((row) => row.played).reverse()
    const recentlyPlayed = played
        .filter((row) => row.weekKey >= -RECENTLY_PLAYED_WEEKS)
        .slice(0, RECENTLY_PLAYED_COUNT)
    const visible = tab === "upcoming" ? upcoming : played

    function toggleKind(kind: "match" | "training") {
        setKinds((current) => {
            const next = { ...current, [kind]: !current[kind] }
            // At least one kind stays selected so the list never empties by accident.
            return next.match || next.training ? next : current
        })
    }

    return (
        <div className="space-y-6">
            {queue.length ? (
                <section aria-labelledby="match-queue" className="space-y-2.5">
                    <h2 id="match-queue" className="text-sm font-semibold">
                        {text.queue.title}
                    </h2>
                    <div className="grid gap-3 sm:grid-cols-[repeat(auto-fit,minmax(16rem,1fr))]">
                        {queue.map((item) => {
                            const Icon =
                                item.kind === "publishRoster" ? Users : BellRing
                            return (
                                <Link
                                    key={`${item.kind}:${item.href}`}
                                    href={item.href}
                                    className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 transition-colors hover:bg-amber-500/15"
                                >
                                    <Icon
                                        className="mt-0.5 size-4 shrink-0 text-amber-700 dark:text-amber-300"
                                        aria-hidden="true"
                                    />
                                    <span className="flex min-w-0 flex-col leading-snug">
                                        <span className="text-sm font-semibold">
                                            {item.title}
                                        </span>
                                        <span className="text-sm text-amber-900/80 dark:text-amber-100/80">
                                            {item.detail}
                                        </span>
                                    </span>
                                </Link>
                            )
                        })}
                    </div>
                </section>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                    role="tablist"
                    aria-label={text.tabsLabel}
                    className="bg-muted flex gap-0.5 rounded-xl p-1"
                >
                    {(["upcoming", "played"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={tab === value}
                            onClick={() => setTab(value)}
                            className={cn(
                                "h-8 rounded-lg px-3.5 text-sm font-medium transition-colors",
                                tab === value
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {text.tabs[value]}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {(["match", "training"] as const).map((kind) => (
                        <button
                            key={kind}
                            type="button"
                            aria-pressed={kinds[kind]}
                            onClick={() => toggleKind(kind)}
                            className={cn(
                                "h-8 rounded-full border px-3 text-sm font-medium transition-colors",
                                kinds[kind]
                                    ? "border-foreground bg-muted text-foreground"
                                    : "border-border text-muted-foreground hover:text-foreground"
                            )}
                        >
                            {kind === "match"
                                ? text.filters.matches
                                : text.filters.trainings}
                        </button>
                    ))}
                    {games.length > 1 ? (
                        <Select
                            value={game}
                            onValueChange={(value) =>
                                setGame(value as GameId | "all")
                            }
                        >
                            <SelectTrigger
                                className="h-8 w-auto min-w-36 rounded-lg"
                                aria-label={text.filters.game}
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">
                                    {text.filters.allGames}
                                </SelectItem>
                                {games.map((option) => (
                                    <SelectItem
                                        key={option.id}
                                        value={option.id}
                                    >
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : null}
                    <label className="border-input text-muted-foreground flex h-8 w-52 max-w-full items-center gap-2 rounded-lg border px-2.5">
                        <Search
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            aria-label={text.filters.searchLabel}
                            placeholder={text.filters.searchPlaceholder}
                            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
                        />
                    </label>
                </div>
            </div>

            {visible.length ? (
                groupRows(visible).map((group) => (
                    <MatchRows
                        key={`${tab}:${group.key}`}
                        id={`week-${tab}-${group.key}`}
                        label={group.label}
                        rows={group.rows}
                    />
                ))
            ) : (
                <p className="text-muted-foreground border-border/60 rounded-2xl border border-dashed p-6 text-center text-sm">
                    {tab === "upcoming" ? text.noUpcoming : text.noPlayed}
                </p>
            )}

            {tab === "upcoming" && recentlyPlayed.length ? (
                <MatchRows
                    id="recently-played"
                    label={text.recentlyPlayed}
                    rows={recentlyPlayed}
                />
            ) : null}
        </div>
    )
}
