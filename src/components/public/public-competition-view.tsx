import { CalendarDays, ChevronDown, Layers } from "lucide-react"
import Link from "next/link"

import {
    describeFixtureSpan,
    fixturesForView,
    groupPublicFixtures,
    hasPlayoffFixtures,
    PLAYOFF_VIEW,
    type CompetitionView,
    type PublicFixtureGroup,
} from "@/domain/competitions/public-rounds"
import type {
    PublicCompetition,
    PublicCompetitionFixture,
    PublicCompetitionTeam,
} from "@/domain/competitions/competition"
import { deriveDivisionStandings } from "@/domain/competitions/standings"
import { EmptyState } from "@/components/app/empty-state"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { teamInitials } from "@/domain/teams/team"
import { GAME_LABELS } from "@/domain/games/game"
import { Badge } from "@/components/ui/badge"
import type { Locale } from "@/i18n/config"
import { pluralize } from "@/i18n/plural"

/** Official links of competitions Logi knows; others have none yet. */
const OFFICIAL_LINKS: Record<
    string,
    { logo: string; rules: string; website: string }
> = {
    "ecl-2026": {
        logo: "https://hll-ecl.eu/static/assets/ecl_logo_web_2025.png",
        rules: "https://hll-ecl.eu/rules",
        website: "https://hll-ecl.eu",
    },
}

/**
 * Public competition page (design J1): the competition hero, division tabs
 * (plus play-off when it has fixtures), the division table with played,
 * won and points, and the fixtures by round or week.
 */
export function PublicCompetitionView({
    competition,
    view,
    clanLinks,
    now,
    locale,
    dictionary,
}: {
    competition: PublicCompetition
    view: CompetitionView | null
    /** Public clan page (Discord server ID) per team ID, when the team has one. */
    clanLinks: Record<string, string>
    now: number
    locale: Locale
    dictionary: Dictionary
}) {
    const t = dictionary.publicSite.competition
    const teams = new Map(
        competition.divisions.flatMap((division) =>
            division.teams.map((team) => [team.id, team] as const)
        )
    )
    const tabs = [
        ...competition.divisions.map((division) => ({
            id: division.id,
            label: division.name,
            current:
                view?.kind === "division" && view.divisionId === division.id,
        })),
        ...(hasPlayoffFixtures(competition.divisions)
            ? [
                  {
                      id: PLAYOFF_VIEW,
                      label: dictionary.competition.phases.playoff,
                      current: view?.kind === "playoff",
                  },
              ]
            : []),
    ]
    const division =
        view?.kind === "division"
            ? competition.divisions.find(
                  (entry) => entry.id === view.divisionId
              )
            : undefined
    const fixtures = view ? fixturesForView(competition.divisions, view) : []

    return (
        <div className="flex flex-col gap-7">
            <CompetitionHero
                competition={competition}
                locale={locale}
                dictionary={dictionary}
            />
            {!view ? (
                <EmptyState
                    icon={Layers}
                    title={t.noDivisionsTitle}
                    description={t.noDivisionsDescription}
                />
            ) : (
                <>
                    {tabs.length > 1 ? (
                        <nav
                            aria-label={t.divisionsLabel}
                            className="flex flex-wrap gap-1 border-b"
                        >
                            {tabs.map((tab) => (
                                <Link
                                    key={tab.id}
                                    href={`/${locale}/competitions/${competition.slug}?division=${encodeURIComponent(tab.id)}`}
                                    scroll={false}
                                    aria-current={
                                        tab.current ? "page" : undefined
                                    }
                                    className="text-muted-foreground hover:text-foreground aria-[current=page]:border-foreground aria-[current=page]:text-foreground -mb-px inline-flex h-10 items-center border-b-2 border-transparent px-3.5 text-sm font-medium transition-colors aria-[current=page]:font-semibold"
                                >
                                    {tab.label}
                                </Link>
                            ))}
                        </nav>
                    ) : null}
                    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.07fr)_minmax(0,1fr)]">
                        {division ? (
                            <StandingsTable
                                competition={competition}
                                division={division}
                                clanLinks={clanLinks}
                                locale={locale}
                                dictionary={dictionary}
                            />
                        ) : null}
                        <FixtureGroups
                            fixtures={fixtures}
                            teams={teams}
                            now={now}
                            locale={locale}
                            dictionary={dictionary}
                            className={division ? undefined : "lg:col-span-2"}
                        />
                    </div>
                </>
            )}
        </div>
    )
}

/** The competition's logo, or its initials on the hero's indigo. */
export function CompetitionMark({
    competition,
    className,
}: {
    competition: Pick<PublicCompetition, "slug" | "name">
    className?: string
}) {
    const official = OFFICIAL_LINKS[competition.slug]
    return (
        <span
            className={`flex flex-none items-center justify-center overflow-hidden bg-indigo-900 font-bold text-white ${className ?? ""}`}
        >
            {official ? (
                <img
                    src={official.logo}
                    alt={competition.name}
                    className="max-h-full max-w-full object-contain p-2"
                />
            ) : (
                <span aria-hidden="true">
                    {/* A short one-word name ("ECL") is its own mark. */}
                    {teamInitials(
                        competition.name,
                        /^\S{1,4}$/.test(competition.name.trim())
                            ? competition.name.trim()
                            : null
                    )}
                </span>
            )}
        </span>
    )
}

/** "Hell Let Loose · 24 teams in 3 divisions". */
export function competitionSummary(
    competition: Pick<PublicCompetition, "gameId" | "divisions">,
    locale: Locale,
    dictionary: Dictionary
) {
    const teamCount = competition.divisions.reduce(
        (total, division) => total + division.teams.length,
        0
    )
    return [
        GAME_LABELS[competition.gameId],
        `${pluralize(locale, teamCount, dictionary.competitionAdmin.countTeams)} ${pluralize(locale, competition.divisions.length, dictionary.publicSite.competition.divisionsIn)}`,
    ].join(" · ")
}

function CompetitionHero({
    competition,
    locale,
    dictionary,
}: {
    competition: PublicCompetition
    locale: Locale
    dictionary: Dictionary
}) {
    const t = dictionary.publicSite.competition
    const official = OFFICIAL_LINKS[competition.slug]
    return (
        <section
            aria-labelledby="competition-title"
            className="flex flex-wrap items-center gap-5 rounded-[18px] bg-indigo-950 p-6 text-indigo-100 dark:ring-1 dark:ring-indigo-400/20"
        >
            <CompetitionMark
                competition={competition}
                className="size-[72px] rounded-2xl text-lg"
            />
            <div className="flex min-w-0 flex-[1_1_280px] flex-col gap-1.5">
                <h1
                    id="competition-title"
                    className="text-3xl leading-9 font-bold break-words text-white"
                >
                    {competition.name} {competition.season}
                </h1>
                <p className="text-sm text-indigo-200">
                    {competitionSummary(competition, locale, dictionary)}
                </p>
                {competition.description ? (
                    <p className="max-w-2xl text-sm whitespace-pre-line text-indigo-200/90">
                        {competition.description}
                    </p>
                ) : null}
            </div>
            {official ? (
                <div className="flex flex-wrap gap-2">
                    <a
                        href={official.rules}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center rounded-lg bg-white px-3.5 text-[13px] font-semibold text-indigo-950 transition-colors hover:bg-indigo-50"
                    >
                        {t.rules}
                    </a>
                    <a
                        href={official.website}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex h-9 items-center rounded-lg border border-indigo-500 px-3.5 text-[13px] font-medium text-indigo-100 transition-colors hover:bg-indigo-900"
                    >
                        {dictionary.competition.website}
                    </a>
                </div>
            ) : null}
        </section>
    )
}

function TeamCell({
    team,
    href,
    dictionary,
}: {
    team: PublicCompetitionTeam
    href: string | null
    dictionary: Dictionary
}) {
    const content = (
        <>
            <TeamLogo
                name={team.name}
                shortCode={team.shortCode}
                logoUrl={team.logoUrl}
                className="size-6 rounded-md [&_[data-slot=avatar-fallback]]:rounded-md [&_[data-slot=avatar-fallback]]:text-[8px] [&_[data-slot=avatar-fallback]]:font-bold"
            />
            <span className="min-w-0 break-words">
                {team.name}
                {team.withdrawn ? (
                    <span className="text-muted-foreground font-normal">
                        {" "}
                        {dictionary.competition.withdrawn}
                    </span>
                ) : null}
            </span>
        </>
    )
    return href ? (
        <Link
            href={href}
            className="inline-flex items-center gap-2 underline-offset-4 hover:underline"
        >
            {content}
        </Link>
    ) : (
        <span className="inline-flex items-center gap-2">{content}</span>
    )
}

function StandingsTable({
    competition,
    division,
    clanLinks,
    locale,
    dictionary,
}: {
    competition: PublicCompetition
    division: PublicCompetition["divisions"][number]
    clanLinks: Record<string, string>
    locale: Locale
    dictionary: Dictionary
}) {
    const t = dictionary.publicSite.competition
    const teams = new Map(division.teams.map((team) => [team.id, team]))
    const standings = deriveDivisionStandings(division.teams, division.fixtures)
    const head =
        "text-muted-foreground px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap"
    return (
        <section
            aria-labelledby="standings-title"
            className="flex min-w-0 flex-col gap-2.5"
        >
            <h2 id="standings-title" className="text-base font-semibold">
                {t.standings}
            </h2>
            <div className="overflow-x-auto rounded-[14px] border">
                {standings.length ? (
                    <table className="w-full border-collapse text-sm">
                        <thead>
                            <tr className="bg-muted/50 text-left">
                                <th scope="col" className={`${head} w-8`}>
                                    #
                                </th>
                                <th scope="col" className={head}>
                                    {dictionary.competition.team}
                                </th>
                                <th
                                    scope="col"
                                    className={`${head} text-right`}
                                >
                                    {t.matchesColumn}
                                </th>
                                <th
                                    scope="col"
                                    className={`${head} text-right`}
                                >
                                    {t.winsColumn}
                                </th>
                                <th
                                    scope="col"
                                    className={`${head} text-right`}
                                >
                                    {t.pointsColumn}
                                </th>
                            </tr>
                        </thead>
                        <tbody className="tabular-nums">
                            {standings.map((row, index) => {
                                const team = teams.get(row.teamId)
                                const clan = clanLinks[row.teamId]
                                return (
                                    <tr key={row.teamId} className="border-t">
                                        <td className="text-muted-foreground px-3.5 py-2.5">
                                            {index + 1}
                                        </td>
                                        <th
                                            scope="row"
                                            className="px-3.5 py-2.5 text-left font-semibold"
                                        >
                                            {team ? (
                                                <TeamCell
                                                    team={team}
                                                    href={
                                                        clan
                                                            ? `/${locale}/clans/${clan}`
                                                            : null
                                                    }
                                                    dictionary={dictionary}
                                                />
                                            ) : (
                                                t.unknownTeam
                                            )}
                                        </th>
                                        <td className="px-3.5 py-2.5 text-right">
                                            {row.totalMatches}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-right">
                                            {row.totalWins}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-right font-bold">
                                            {row.capScore}
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-muted-foreground p-4 text-sm">
                        {dictionary.competition.noTeams}
                    </p>
                )}
            </div>
            <p className="text-muted-foreground text-xs">
                {t.standingsNoteFor.replace("{name}", competition.name)}
            </p>
        </section>
    )
}

function FixtureGroups({
    fixtures,
    teams,
    now,
    locale,
    dictionary,
    className,
}: {
    fixtures: PublicCompetitionFixture[]
    teams: Map<string, PublicCompetitionTeam>
    now: number
    locale: Locale
    dictionary: Dictionary
    className?: string
}) {
    const t = dictionary.publicSite.competition
    const { upcoming, results } = groupPublicFixtures(fixtures)
    if (!upcoming.length && !results.length)
        return (
            <EmptyState
                icon={CalendarDays}
                title={t.noFixturesTitle}
                description={t.noFixturesDescription}
                className={className}
            />
        )
    const dayMonth = new Intl.DateTimeFormat(locale, {
        day: "numeric",
        month: "numeric",
    })
    const range = (from: string, to: string) => {
        const [start, end] = [from, to].map((value) =>
            dayMonth.format(new Date(value))
        )
        return start === end ? start : `${start} – ${end}`
    }
    const roundLabel = (group: PublicFixtureGroup) =>
        typeof group.round === "number"
            ? t.round.replace("{round}", String(group.round))
            : group.round
    const upcomingHeading = (group: PublicFixtureGroup) => {
        const span = describeFixtureSpan(group, now)
        const when =
            span.kind === "undated"
                ? t.undated
                : span.kind === "this_weekend"
                  ? t.thisWeekend
                  : span.kind === "this_week"
                    ? t.thisWeek
                    : span.kind === "next_week"
                      ? t.nextWeek
                      : range(span.from, span.to)
        const round = roundLabel(group)
        if (round) return `${round} · ${when}`
        // A bare date range reads as a heading only with what it lists.
        return span.kind === "range"
            ? `${t.upcoming} · ${when}`
            : capitalize(when, locale)
    }
    const resultHeading = (group: PublicFixtureGroup) => {
        const round = roundLabel(group)
        if (round) return `${round} · ${t.resultsSuffix}`
        return group.first && group.last
            ? `${dictionary.competition.results} · ${range(group.first, group.last)}`
            : dictionary.competition.results
    }
    const name = (teamId: string) => teams.get(teamId)?.name ?? t.unknownTeam
    const phase = (fixture: PublicCompetitionFixture) =>
        fixture.phase === "relegation" ? (
            <Badge variant="outline">
                {dictionary.competition.phases.relegation}
            </Badge>
        ) : null

    const renderUpcoming = (group: PublicFixtureGroup) => {
        const span = describeFixtureSpan(group, now)
        const withDate = span.kind === "range" || span.kind === "undated"
        const format = new Intl.DateTimeFormat(locale, {
            weekday: "short",
            ...(withDate ? { day: "numeric", month: "numeric" } : {}),
            hour: "2-digit",
            minute: "2-digit",
        })
        return (
            <FixtureSection
                key={`upcoming-${group.key}`}
                id={`upcoming-${group.key}`}
                heading={upcomingHeading(group)}
            >
                {group.fixtures.map((fixture) => (
                    <li
                        key={fixture.id}
                        className="flex items-center gap-3 px-4 py-3"
                    >
                        <span className="text-muted-foreground min-w-16 shrink-0 text-xs">
                            {fixture.scheduledAt
                                ? format.format(new Date(fixture.scheduledAt))
                                : "–"}
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-semibold break-words">
                            {name(fixture.teamAId)} vs {name(fixture.teamBId)}
                        </span>
                        {phase(fixture)}
                    </li>
                ))}
            </FixtureSection>
        )
    }
    const renderResults = (group: PublicFixtureGroup) => {
        const format = new Intl.DateTimeFormat(locale, {
            weekday: "short",
            day: "numeric",
            month: "numeric",
        })
        return (
            <FixtureSection
                key={`results-${group.key}`}
                id={`results-${group.key}`}
                heading={resultHeading(group)}
            >
                {group.fixtures.map((fixture) => (
                    <li
                        key={fixture.id}
                        className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3"
                    >
                        <span className="text-muted-foreground min-w-16 shrink-0 text-xs">
                            {fixture.scheduledAt
                                ? format.format(new Date(fixture.scheduledAt))
                                : "–"}
                        </span>
                        <span className="min-w-0 flex-[1_1_160px] text-sm font-semibold break-words">
                            {name(fixture.teamAId)}{" "}
                            <span className="tabular-nums">
                                {fixture.scoreA ?? "–"} :{" "}
                                {fixture.scoreB ?? "–"}
                            </span>{" "}
                            {name(fixture.teamBId)}
                        </span>
                        {phase(fixture)}
                        {fixture.status === "forfeit" ? (
                            <Badge variant="secondary">
                                {dictionary.competition.fixtureStatus.forfeit}
                            </Badge>
                        ) : null}
                        {fixture.eventId ? (
                            <Link
                                href={`/${locale}/matches/${fixture.eventId}`}
                                className="text-[13px] underline underline-offset-[3px]"
                            >
                                {t.statistics}
                            </Link>
                        ) : null}
                    </li>
                ))}
            </FixtureSection>
        )
    }
    // The board shows the next round and the last played one; earlier and
    // later rounds stay one click away.
    const more = [
        ...upcoming.slice(1).map(renderUpcoming),
        ...results.slice(1).map(renderResults),
    ]

    return (
        <div className={`flex min-w-0 flex-col gap-[22px] ${className ?? ""}`}>
            {upcoming.slice(0, 1).map(renderUpcoming)}
            {results.slice(0, 1).map(renderResults)}
            {more.length ? (
                <details className="group flex flex-col">
                    <summary className="text-muted-foreground hover:text-foreground flex cursor-pointer list-none items-center gap-1.5 text-sm font-medium [&::-webkit-details-marker]:hidden">
                        <ChevronDown className="size-4 transition-transform group-open:rotate-180" />
                        {t.moreRounds.replace("{count}", String(more.length))}
                    </summary>
                    <div className="mt-[22px] flex flex-col gap-[22px]">
                        {more}
                    </div>
                </details>
            ) : null}
        </div>
    )
}

function FixtureSection({
    id,
    heading,
    children,
}: {
    id: string
    heading: string
    children: React.ReactNode
}) {
    const headingId = `fixtures-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`
    return (
        <section aria-labelledby={headingId} className="flex flex-col gap-2.5">
            <h2 id={headingId} className="text-base font-semibold">
                {heading}
            </h2>
            <ul className="divide-y overflow-hidden rounded-[14px] border">
                {children}
            </ul>
        </section>
    )
}

function capitalize(value: string, locale: string) {
    return value.charAt(0).toLocaleUpperCase(locale) + value.slice(1)
}
