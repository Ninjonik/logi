"use client"
import {
    ArrowRight,
    Search,
    Trophy,
    Users,
    Layers,
    CalendarDays,
} from "lucide-react"
import { CompetitionMark } from "@/components/public/public-competition-view"
import type { PublicCompetition } from "@/domain/competitions/competition"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { Locale } from "@/i18n/config"
import { useState } from "react"
import Link from "next/link"
export function LeagueDirectory({
    competitions,
    locale,
}: {
    competitions: PublicCompetition[]
    locale: Locale
}) {
    const t = getLeagueMessages(locale)
    const [search, setSearch] = useState("")
    const [game, setGame] = useState("all")
    const filtered = competitions.filter(
        (competition) =>
            (game === "all" || competition.gameId === game) &&
            `${competition.name} ${competition.season}`
                .toLocaleLowerCase(locale)
                .includes(search.toLocaleLowerCase(locale))
    )
    return (
        <div className="space-y-12">
            <header className="bg-muted/30 relative overflow-hidden rounded-2xl border px-6 py-10 sm:px-10 sm:py-14">
                <Trophy
                    aria-hidden
                    className="absolute -right-6 -bottom-8 size-56 -rotate-12 text-amber-500/5"
                />
                <div className="relative max-w-2xl">
                    <p className="mb-4 flex items-center gap-2 text-xs font-semibold tracking-[.18em] text-amber-700 uppercase dark:text-amber-400">
                        <Trophy className="size-4" />
                        Logi
                    </p>
                    <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                        {t.title}
                    </h1>
                    <p className="text-muted-foreground mt-4 max-w-xl text-base leading-7">
                        {t.description}
                    </p>
                    <Button asChild className="mt-6">
                        <Link href={`/${locale}/league-teams`}>
                            {t.manage}
                            <ArrowRight className="size-4" />
                        </Link>
                    </Button>
                </div>
            </header>
            <section aria-label={t.browse} className="space-y-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="flex flex-wrap gap-2">
                        {["all", "hell_let_loose", "wardogs"].map((value) => (
                            <button
                                key={value}
                                type="button"
                                aria-pressed={game === value}
                                onClick={() => setGame(value)}
                                className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${game === value ? "bg-foreground text-background" : "bg-background hover:bg-muted"}`}
                            >
                                {value === "all"
                                    ? t.allGames
                                    : value === "wardogs"
                                      ? "Wardogs"
                                      : "Hell Let Loose"}
                            </button>
                        ))}
                    </div>
                    <div className="relative sm:w-64">
                        <Search
                            aria-hidden
                            className="text-muted-foreground absolute top-3 left-3 size-4"
                        />
                        <Input
                            aria-label={t.search}
                            placeholder={t.search}
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            className="pl-9"
                        />
                    </div>
                </div>
                {filtered.length ? (
                    <ul className="grid gap-5 lg:grid-cols-2">
                        {filtered.map((competition) => {
                            const teams = new Map(
                                competition.divisions.flatMap((division) =>
                                    division.teams.map(
                                        (team) => [team.id, team] as const
                                    )
                                )
                            )
                            const fixtures = competition.divisions.flatMap(
                                (division) => division.fixtures
                            )
                            const policy =
                                competition.registrationMode ?? "closed"
                            return (
                                <li
                                    key={competition.id}
                                    className={`bg-card flex flex-col overflow-hidden rounded-2xl border ${filtered.length === 1 ? "lg:col-span-2 lg:grid lg:grid-cols-[1fr_1.1fr]" : ""}`}
                                >
                                    <div
                                        className={`bg-muted/20 flex items-start gap-4 border-b p-6 ${filtered.length === 1 ? "lg:border-r lg:border-b-0" : ""}`}
                                    >
                                        <CompetitionMark
                                            competition={competition}
                                            className="size-16 shrink-0 rounded-xl text-lg"
                                        />
                                        <div className="min-w-0 flex-1">
                                            <p className="text-muted-foreground mb-1 text-xs font-medium">
                                                {
                                                    GAME_LABELS[
                                                        competition.gameId
                                                    ]
                                                }{" "}
                                                <span className="mx-1">·</span>{" "}
                                                {competition.season}
                                            </p>
                                            <h2 className="text-xl font-semibold tracking-tight">
                                                <Link
                                                    href={`/${locale}/leagues/${competition.slug}`}
                                                    className="hover:underline"
                                                >
                                                    {competition.name}
                                                </Link>
                                            </h2>
                                            <p
                                                className={`mt-2 text-xs font-medium ${policy === "closed" ? "text-muted-foreground" : "text-emerald-700 dark:text-emerald-400"}`}
                                            >
                                                <span
                                                    aria-hidden
                                                    className="mr-1.5"
                                                >
                                                    ●
                                                </span>
                                                {t[policy]}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex flex-1 flex-col p-6">
                                        <p className="text-muted-foreground line-clamp-3 min-h-12 text-sm leading-6">
                                            {competition.description ?? t.rules}
                                        </p>
                                        <dl className="mt-6 grid grid-cols-3 gap-3 border-y py-4">
                                            {[
                                                {
                                                    icon: Users,
                                                    label: t.teams,
                                                    count: teams.size,
                                                },
                                                {
                                                    icon: Layers,
                                                    label: t.divisions,
                                                    count: competition.divisions
                                                        .length,
                                                },
                                                {
                                                    icon: CalendarDays,
                                                    label: t.fixtures,
                                                    count: fixtures.length,
                                                },
                                            ].map(
                                                ({
                                                    icon: Icon,
                                                    label,
                                                    count,
                                                }) => (
                                                    <div key={label}>
                                                        <dt className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                                            <Icon className="size-3.5" />
                                                            {label}
                                                        </dt>
                                                        <dd className="mt-1 text-xl font-semibold tabular-nums">
                                                            {count}
                                                        </dd>
                                                    </div>
                                                )
                                            )}
                                        </dl>
                                        <p className="text-muted-foreground mt-4 text-xs">
                                            {competition.minimumLinkedPlayers
                                                ? t.minimum.replace(
                                                      "{count}",
                                                      String(
                                                          competition.minimumLinkedPlayers
                                                      )
                                                  )
                                                : t.noMinimum}
                                        </p>
                                        <div className="mt-6 flex flex-wrap gap-2">
                                            <Button asChild variant="outline">
                                                <Link
                                                    href={`/${locale}/leagues/${competition.slug}`}
                                                >
                                                    {t.view}
                                                    <ArrowRight className="size-4" />
                                                </Link>
                                            </Button>
                                            {policy !== "closed" && (
                                                <Button asChild>
                                                    <Link
                                                        href={`/${locale}/leagues/${competition.slug}/join`}
                                                    >
                                                        {t.register}
                                                    </Link>
                                                </Button>
                                            )}
                                        </div>
                                    </div>
                                </li>
                            )
                        })}
                    </ul>
                ) : (
                    <div
                        role="status"
                        className="rounded-xl border border-dashed py-16 text-center"
                    >
                        <Trophy
                            aria-hidden
                            className="text-muted-foreground mx-auto mb-4 size-8"
                        />
                        <h2 className="font-semibold">{t.empty}</h2>
                        <p className="text-muted-foreground mt-2 text-sm">
                            {t.emptyHint}
                        </p>
                    </div>
                )}
            </section>
            <section className="bg-muted/20 rounded-2xl border p-6 sm:p-8">
                <div className="mb-8 max-w-2xl">
                    <h2 className="text-2xl font-semibold tracking-tight">
                        {t.setupTitle}
                    </h2>
                    <p className="text-muted-foreground mt-3 leading-7">
                        {t.setupDescription}
                    </p>
                </div>
                <ol className="grid gap-6 md:grid-cols-3">
                    {[
                        [t.setupOne, t.setupOneText],
                        [t.setupTwo, t.setupTwoText],
                        [t.setupThree, t.setupThreeText],
                    ].map(([title, text], index) => (
                        <li key={title}>
                            <span className="bg-background mb-4 inline-flex size-8 items-center justify-center rounded-lg border font-mono text-xs">
                                0{index + 1}
                            </span>
                            <h3 className="font-semibold">{title}</h3>
                            <p className="text-muted-foreground mt-2 text-sm leading-6">
                                {text}
                            </p>
                        </li>
                    ))}
                </ol>
                <div className="mt-8 flex justify-end border-t pt-6">
                    <Button asChild>
                        <Link href={`/${locale}/league-teams`}>
                            {t.create}
                            <ArrowRight className="size-4" />
                        </Link>
                    </Button>
                </div>
            </section>
        </div>
    )
}
