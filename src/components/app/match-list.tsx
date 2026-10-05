"use client"

import { Bell, Search, Trophy, UsersRound } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"

import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import type { MatchListQueueRow, MatchListRow } from "@/lib/match-list-rows"
import { MatchRowList } from "@/components/app/match-row-list"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type MatchListTab = "upcoming" | "played" | "drafts"
type Kind = MatchListRow["kind"]

const RECENTLY_PLAYED_WEEKS = 2
const RECENTLY_PLAYED_COUNT = 3
const PAGE_SIZE = 30

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

function WeekSection({
    id,
    label,
    rows,
}: {
    id: string
    label: string
    rows: MatchListRow[]
}) {
    return (
        <section aria-labelledby={id} className="flex flex-col gap-2">
            <h2
                id={id}
                className="text-muted-foreground text-xs font-semibold tracking-[0.04em] uppercase"
            >
                {label}
            </h2>
            <MatchRowList rows={rows} />
        </section>
    )
}

function QueueCard({ item }: { item: MatchListQueueRow }) {
    const attention = item.kind !== "confirmAttendance"
    const Icon =
        item.kind === "publishRoster"
            ? UsersRound
            : item.kind === "confirmResult"
              ? Trophy
              : Bell
    return (
        <Link
            href={item.href}
            className={cn(
                "flex items-start gap-3 rounded-xl border px-4 py-3.5 transition-colors",
                attention
                    ? "border-amber-200 bg-amber-50 hover:bg-amber-100/70 dark:border-amber-400/30 dark:bg-amber-400/10 dark:hover:bg-amber-400/15"
                    : "bg-muted/40 hover:bg-muted/70"
            )}
        >
            <Icon
                className={cn(
                    "mt-px size-[18px] shrink-0",
                    attention
                        ? "text-amber-700 dark:text-amber-300"
                        : "text-muted-foreground"
                )}
                aria-hidden="true"
            />
            <span className="flex min-w-0 flex-col leading-5">
                <span className="text-sm font-semibold">{item.title}</span>
                <span
                    className={cn(
                        "text-[13px]",
                        attention
                            ? "text-amber-900 dark:text-amber-100/85"
                            : "text-muted-foreground"
                    )}
                >
                    {item.detail}
                </span>
            </span>
        </Link>
    )
}

function NoMatches({
    children,
    onClear,
    clearLabel,
}: {
    children: ReactNode
    onClear?: () => void
    clearLabel: string
}) {
    return (
        <div className="border-border/70 text-muted-foreground flex flex-col items-center gap-3 rounded-[14px] border border-dashed p-6 text-center text-sm">
            <p>{children}</p>
            {onClear ? (
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={onClear}
                >
                    {clearLabel}
                </Button>
            ) : null}
        </div>
    )
}

/**
 * Matches and trainings of a clan (design E1): organiser tasks first, then
 * upcoming, played or draft events grouped by week, filtered by kind, game
 * and text. `kinds` with one entry hides the kind chips, as on the trainings
 * page.
 */
export function MatchList({
    rows,
    drafts,
    queue,
    games,
    kinds,
    showDrafts,
    initialGame,
    initialTab,
    draftsEmpty,
    dictionary,
}: {
    rows: MatchListRow[]
    drafts: MatchListRow[]
    queue: MatchListQueueRow[]
    games: Array<{ id: GameId; label: string }>
    kinds: readonly Kind[]
    /** Managers get the drafts tab; members never see drafts. */
    showDrafts: boolean
    initialGame?: GameId
    initialTab?: MatchListTab
    /** Shown in the drafts tab when the clan has no drafts. */
    draftsEmpty?: ReactNode
    dictionary: Dictionary
}) {
    const text = dictionary.matchList
    const trainingsOnly = kinds.length === 1 && kinds[0] === "training"
    const [tab, setTab] = useState<MatchListTab>(
        initialTab === "drafts" && !showDrafts
            ? "upcoming"
            : (initialTab ?? "upcoming")
    )
    const [selectedKinds, setSelectedKinds] = useState<Record<Kind, boolean>>({
        match: true,
        training: true,
    })
    const [game, setGame] = useState<GameId | "all">(initialGame ?? "all")
    const [query, setQuery] = useState("")
    const [playedLimit, setPlayedLimit] = useState(PAGE_SIZE)

    const filtersActive =
        game !== "all" ||
        query.trim() !== "" ||
        !selectedKinds.match ||
        !selectedKinds.training
    const filter = useMemo(() => {
        const needle = query.trim().toLocaleLowerCase()
        return (list: MatchListRow[]) =>
            list.filter(
                (row) =>
                    selectedKinds[row.kind] &&
                    (game === "all" || row.gameId === game) &&
                    (!needle || row.search.includes(needle))
            )
    }, [game, selectedKinds, query])
    const filtered = useMemo(() => filter(rows), [filter, rows])
    const filteredDrafts = useMemo(() => filter(drafts), [filter, drafts])
    const upcoming = filtered.filter((row) => !row.played)
    const played = filtered.filter((row) => row.played).reverse()
    const recentlyPlayed = played
        .filter((row) => row.weekKey >= -RECENTLY_PLAYED_WEEKS)
        .slice(0, RECENTLY_PLAYED_COUNT)

    function toggleKind(kind: Kind) {
        setSelectedKinds((current) => {
            const next = { ...current, [kind]: !current[kind] }
            // At least one kind stays selected so the list never empties by accident.
            return next.match || next.training ? next : current
        })
    }

    function clearFilters() {
        setSelectedKinds({ match: true, training: true })
        setGame("all")
        setQuery("")
    }

    const tabs: Array<{ value: MatchListTab; label: string }> = [
        { value: "upcoming", label: text.tabs.upcoming },
        { value: "played", label: text.tabs.played },
        ...(showDrafts
            ? [
                  {
                      value: "drafts" as const,
                      label: drafts.length
                          ? text.tabs.draftsCount.replace(
                                "{count}",
                                String(drafts.length)
                            )
                          : text.tabs.drafts,
                  },
              ]
            : []),
    ]

    function weekSections(list: MatchListRow[]) {
        return groupRows(list).map((group) => (
            <WeekSection
                key={`${tab}:${group.key}`}
                id={`week-${tab}-${group.key}`}
                label={group.label}
                rows={group.rows}
            />
        ))
    }

    const clear = filtersActive ? clearFilters : undefined
    let content: ReactNode
    if (tab === "upcoming") {
        content = (
            <>
                {upcoming.length ? (
                    weekSections(upcoming)
                ) : (
                    <NoMatches onClear={clear} clearLabel={text.clearFilters}>
                        {text.noUpcoming}
                    </NoMatches>
                )}
                {recentlyPlayed.length ? (
                    <WeekSection
                        id="recently-played"
                        label={text.recentlyPlayed}
                        rows={recentlyPlayed}
                    />
                ) : null}
            </>
        )
    } else if (tab === "played") {
        content = played.length ? (
            <>
                {weekSections(played.slice(0, playedLimit))}
                {played.length > playedLimit ? (
                    <div className="flex justify-center">
                        <Button
                            type="button"
                            variant="outline"
                            className="rounded-lg"
                            onClick={() =>
                                setPlayedLimit((limit) => limit + PAGE_SIZE)
                            }
                        >
                            {text.showMore}
                        </Button>
                    </div>
                ) : null}
            </>
        ) : (
            <NoMatches onClear={clear} clearLabel={text.clearFilters}>
                {text.noPlayed}
            </NoMatches>
        )
    } else {
        content = filteredDrafts.length ? (
            weekSections(filteredDrafts)
        ) : drafts.length ? (
            <NoMatches onClear={clear} clearLabel={text.clearFilters}>
                {text.noDraftsMatch}
            </NoMatches>
        ) : (
            draftsEmpty
        )
    }

    return (
        <div className="flex flex-col gap-6">
            {queue.length ? (
                <section
                    aria-labelledby="match-queue"
                    className="flex flex-col gap-2.5"
                >
                    <h2 id="match-queue" className="text-sm font-semibold">
                        {text.queue.title}
                    </h2>
                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(16.25rem,100%),1fr))] gap-3">
                        {queue.map((item) => (
                            <QueueCard
                                key={`${item.kind}:${item.href}`}
                                item={item}
                            />
                        ))}
                    </div>
                </section>
            ) : null}

            <div className="flex flex-wrap items-center justify-between gap-3">
                <div
                    role="tablist"
                    aria-label={text.tabsLabel}
                    className="bg-muted flex gap-0.5 rounded-[10px] p-[3px]"
                >
                    {tabs.map((item, index) => (
                        <button
                            key={item.value}
                            id={`match-tab-${item.value}`}
                            type="button"
                            role="tab"
                            aria-selected={tab === item.value}
                            aria-controls="match-tabpanel"
                            tabIndex={tab === item.value ? 0 : -1}
                            onClick={() => setTab(item.value)}
                            onKeyDown={(event) => {
                                const step =
                                    event.key === "ArrowRight"
                                        ? 1
                                        : event.key === "ArrowLeft"
                                          ? -1
                                          : 0
                                if (!step) return
                                event.preventDefault()
                                const next =
                                    tabs[
                                        (index + step + tabs.length) %
                                            tabs.length
                                    ]
                                setTab(next.value)
                                document
                                    .getElementById(`match-tab-${next.value}`)
                                    ?.focus()
                            }}
                            className={cn(
                                "h-8 rounded-lg px-3.5 text-[13px] whitespace-nowrap transition-colors",
                                tab === item.value
                                    ? "bg-background text-foreground font-semibold shadow-sm"
                                    : "text-muted-foreground hover:text-foreground font-medium"
                            )}
                        >
                            {item.label}
                        </button>
                    ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {kinds.length > 1
                        ? kinds.map((kind) => (
                              <button
                                  key={kind}
                                  type="button"
                                  aria-pressed={selectedKinds[kind]}
                                  onClick={() => toggleKind(kind)}
                                  className={cn(
                                      "h-8 rounded-full border px-3 text-[13px] font-medium transition-colors",
                                      selectedKinds[kind]
                                          ? "border-foreground bg-muted text-foreground"
                                          : "border-border text-muted-foreground hover:text-foreground"
                                  )}
                              >
                                  {kind === "match"
                                      ? text.filters.matches
                                      : text.filters.trainings}
                              </button>
                          ))
                        : null}
                    {games.length > 1 ? (
                        <Select
                            value={game}
                            onValueChange={(value) =>
                                setGame(value as GameId | "all")
                            }
                        >
                            <SelectTrigger
                                size="sm"
                                className="h-8 w-auto gap-1.5 rounded-lg px-2.5 text-[13px] shadow-none"
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
                    <label className="border-input text-muted-foreground focus-within:border-ring flex h-8 w-[12.5rem] max-w-full items-center gap-2 rounded-lg border px-2.5">
                        <Search
                            className="size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        <input
                            type="search"
                            value={query}
                            onChange={(event) => setQuery(event.target.value)}
                            aria-label={
                                trainingsOnly
                                    ? text.filters.searchTrainingsLabel
                                    : text.filters.searchLabel
                            }
                            placeholder={
                                trainingsOnly
                                    ? text.filters.searchTrainingsPlaceholder
                                    : text.filters.searchPlaceholder
                            }
                            className="text-foreground placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-[13px] outline-none"
                        />
                    </label>
                </div>
            </div>

            <div
                id="match-tabpanel"
                role="tabpanel"
                aria-labelledby={`match-tab-${tab}`}
                className="flex flex-col gap-6"
            >
                {content}
            </div>
        </div>
    )
}
