import { Check, ChevronRight, ExternalLink } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"

import type {
    MatchPhaseDetail,
    MatchPhaseStep,
} from "@/domain/events/match-phase"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { formatHllPresetLabel } from "@/lib/hll-map-presets"
import { GameBadge } from "@/components/app/game-badge"
import type { Dictionary } from "@/i18n/dictionaries"
import type { EventRecord } from "@/types/domain"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const MATCH_DETAIL_TABS = [
    "overview",
    "attendance",
    "roster",
    "discord",
    "result",
] as const

export type MatchDetailTab = (typeof MATCH_DETAIL_TABS)[number]

export function isMatchDetailTab(value: unknown): value is MatchDetailTab {
    return MATCH_DETAIL_TABS.some((tab) => tab === value)
}

function formatDay(value: string, locale: string, timeZone: string) {
    return new Intl.DateTimeFormat(locale, {
        timeZone,
        weekday: "short",
        day: "numeric",
        month: "numeric",
    }).format(new Date(value))
}

function formatClock(value: string, locale: string, timeZone: string) {
    return new Intl.DateTimeFormat(locale, {
        timeZone,
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value))
}

function formatDayTime(value: string, locale: string, timeZone: string) {
    return `${formatDay(value, locale, timeZone)} ${formatClock(value, locale, timeZone)}`
}

function phaseDetailText(
    detail: MatchPhaseDetail,
    dictionary: Dictionary,
    locale: string,
    timeZone: string
) {
    const t = dictionary.matchDetail.phaseDetail
    switch (detail.kind) {
        case "createdAt":
            return t.createdAt.replace(
                "{date}",
                formatDay(detail.at, locale, timeZone)
            )
        case "opensAt":
            return t.opensAt.replace(
                "{date}",
                formatDayTime(detail.at, locale, timeZone)
            )
        case "closesAt":
            return t.closesAt.replace(
                "{date}",
                formatDayTime(detail.at, locale, timeZone)
            )
        case "signedUp":
            return t.signedUp.replace("{count}", String(detail.count))
        case "rosterMissing":
            return t.rosterMissing
        case "rosterDraft":
            return t.rosterDraft
        case "rosterPublished":
            return t.rosterPublished.replace("{count}", String(detail.count))
        case "meetingAt":
            return t.meetingAt.replace(
                "{date}",
                formatDayTime(detail.at, locale, timeZone)
            )
        case "present":
            return t.present.replace("{count}", String(detail.count))
        case "result":
            return t.result[detail.state]
    }
}

/**
 * The shared top of a match (designs D3, E2, E3): title, game, map and time,
 * the Discord link, the five-step progress and the section tabs. Tabs are
 * links, so every section is its own server-rendered page state.
 */
export function MatchDetailHeader({
    event,
    dictionary,
    locale,
    timeZone,
    listHref,
    phases,
    activeTab,
    tabHref,
    tabCounts,
    discordHref,
    actions,
}: {
    event: EventRecord
    dictionary: Dictionary
    locale: string
    timeZone: string
    listHref: string
    phases: MatchPhaseStep[]
    activeTab: MatchDetailTab
    tabHref: (tab: MatchDetailTab) => string
    tabCounts?: Partial<Record<MatchDetailTab, number>>
    discordHref?: string
    actions?: ReactNode
}) {
    const t = dictionary.matchDetail
    const gameId: GameId = event.gameId ?? "hell_let_loose"
    const map = formatHllPresetLabel(event.map) ?? event.map
    const mapLine = [map, event.side].filter(Boolean).join(" · ")
    const concluded = event.status === "concluded"
    const timeLine = concluded
        ? t.playedLine
              .replace("{date}", formatDay(event.gameStart, locale, timeZone))
              .replace("{time}", formatClock(event.gameStart, locale, timeZone))
        : t.scheduleLine
              .replace("{date}", formatDay(event.gameStart, locale, timeZone))
              .replace(
                  "{meeting}",
                  formatClock(event.meetingStart, locale, timeZone)
              )
              .replace(
                  "{start}",
                  formatClock(event.gameStart, locale, timeZone)
              )

    return (
        <div className="flex flex-col gap-4 px-4 lg:px-6">
            <nav
                aria-label={t.breadcrumbLabel}
                className="text-muted-foreground hidden items-center gap-1 text-xs sm:flex"
            >
                <Link href={listHref} className="hover:text-foreground">
                    {t.backToMatches}
                </Link>
                <ChevronRight className="size-3.5" aria-hidden />
                <span aria-current="page" className="text-foreground truncate">
                    {event.name}
                </span>
            </nav>
            <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                    <h1 className="text-xl font-semibold tracking-tight break-words xl:text-2xl">
                        {event.name}
                    </h1>
                    <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                        <span className="inline-flex items-center gap-1.5">
                            <GameBadge
                                gameId={gameId}
                                dictionary={dictionary}
                                className="size-4"
                            />
                            {GAME_LABELS[gameId]}
                        </span>
                        {mapLine ? <span>{mapLine}</span> : null}
                        <span aria-hidden="true">·</span>
                        <span>{timeLine}</span>
                    </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    {discordHref ? (
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <a
                                href={discordHref}
                                target="_blank"
                                rel="noreferrer"
                            >
                                {t.openInDiscord}
                                <ExternalLink className="size-4" />
                            </a>
                        </Button>
                    ) : null}
                    {actions}
                </div>
            </header>
            <ol
                aria-label={t.progressLabel}
                className="grid grid-cols-1 gap-2 sm:grid-cols-5"
            >
                {phases.map((phase) => (
                    <li
                        key={phase.id}
                        aria-current={
                            phase.state === "current" ? "step" : undefined
                        }
                        className={cn(
                            "flex items-start gap-2 rounded-xl border px-3 py-2",
                            phase.state === "current"
                                ? "border-primary bg-primary/5"
                                : "border-border/60",
                            phase.state === "upcoming" &&
                                "text-muted-foreground"
                        )}
                    >
                        <span
                            aria-hidden="true"
                            className={cn(
                                "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border",
                                phase.state === "done" &&
                                    "border-primary bg-primary text-primary-foreground",
                                phase.state === "current" &&
                                    "border-primary border-[5px]",
                                phase.state === "upcoming" &&
                                    "border-muted-foreground/40"
                            )}
                        >
                            {phase.state === "done" ? (
                                <Check className="size-3" />
                            ) : null}
                        </span>
                        <span className="flex min-w-0 flex-col">
                            <span className="text-sm font-medium">
                                {t.phases[phase.id]}
                                <span className="sr-only">
                                    {` (${t.phaseState[phase.state]})`}
                                </span>
                            </span>
                            <span className="text-muted-foreground truncate text-xs">
                                {phaseDetailText(
                                    phase.detail,
                                    dictionary,
                                    locale,
                                    timeZone
                                )}
                            </span>
                        </span>
                    </li>
                ))}
            </ol>
            <nav
                aria-label={t.tabsLabel}
                className="border-border/70 -mx-4 overflow-x-auto border-b px-4 lg:mx-0 lg:px-0"
            >
                <ul className="flex min-w-max gap-1">
                    {MATCH_DETAIL_TABS.map((tab) => {
                        const active = tab === activeTab
                        const count = tabCounts?.[tab]
                        return (
                            <li key={tab}>
                                <Link
                                    href={tabHref(tab)}
                                    aria-current={active ? "page" : undefined}
                                    scroll={false}
                                    className={cn(
                                        "-mb-px inline-flex h-10 items-center gap-1.5 border-b-2 px-3 text-sm whitespace-nowrap transition-colors",
                                        active
                                            ? "border-foreground text-foreground font-semibold"
                                            : "text-muted-foreground hover:text-foreground border-transparent"
                                    )}
                                >
                                    {t.tabs[tab]}
                                    {count !== undefined ? (
                                        <span className="bg-muted text-muted-foreground rounded-full px-1.5 text-[11px] font-medium tabular-nums">
                                            {count}
                                        </span>
                                    ) : null}
                                </Link>
                            </li>
                        )
                    })}
                </ul>
            </nav>
        </div>
    )
}
