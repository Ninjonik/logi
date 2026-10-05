import { ExternalLink, Layers } from "lucide-react"
import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import type {
    PublicCompetitionFixture,
    PublicCompetitionTeam,
} from "@/domain/competitions/competition"
import {
    selectedDivisionId,
    splitPublicFixtures,
} from "@/domain/competitions/public-fixtures"
import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs"
import { deriveDivisionStandings } from "@/domain/competitions/standings"
import { getPublicCompetition } from "@/lib/read-models/competitions"
import { getDictionary, type Dictionary } from "@/i18n/dictionaries"
import { EmptyState } from "@/components/app/empty-state"
import { GameBadge } from "@/components/app/game-badge"
import { TeamLogo } from "@/components/app/team-logo"
import { GAME_LABELS } from "@/domain/games/game"
import { getLocalizedCanonical } from "@/lib/seo"
import { Badge } from "@/components/ui/badge"
import { pluralize } from "@/i18n/plural"
import { isLocale } from "@/i18n/config"

type Props = {
    params: Promise<{ locale: string; slug: string }>
    searchParams: Promise<{ division?: string | string[] }>
}
const ECL_SLUG = "ecl-2026"
const ECL_LOGO = "https://hll-ecl.eu/static/assets/ecl_logo_web_2025.png"

export async function generateMetadata({
    params,
}: Pick<Props, "params">): Promise<Metadata> {
    const { locale, slug } = await params
    const safeLocale = isLocale(locale) ? locale : "en"
    const competition = await getPublicCompetition(slug)
    return {
        title: competition
            ? `${competition.name} ${competition.season}`
            : "Competition",
        description: competition
            ? `${competition.name} standings and match results.`
            : "Competition standings.",
        alternates: getLocalizedCanonical(safeLocale, `/competitions/${slug}`),
    }
}

function TeamName({
    team,
    withdrawnLabel,
    unknownLabel,
}: {
    team: PublicCompetitionTeam | undefined
    withdrawnLabel: string
    unknownLabel: string
}) {
    if (!team)
        return <span className="text-muted-foreground">{unknownLabel}</span>
    return (
        <span className="inline-flex min-w-0 items-center gap-2">
            <TeamLogo
                name={team.name}
                shortCode={team.shortCode}
                logoUrl={team.logoUrl}
                className="size-7"
            />
            <span className="truncate">
                {team.name}
                {team.withdrawn ? ` ${withdrawnLabel}` : ""}
            </span>
        </span>
    )
}

export default async function CompetitionPage({ params, searchParams }: Props) {
    const [{ locale, slug }, { division: requestedDivision }] =
        await Promise.all([params, searchParams])
    const safeLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(safeLocale)
    const labels = dictionary.competition
    const t = dictionary.publicSite.competition
    const competition = await getPublicCompetition(slug)
    if (!competition) notFound()
    const isEcl = competition.slug === ECL_SLUG
    const divisionId = selectedDivisionId(
        competition.divisions,
        typeof requestedDivision === "string" ? requestedDivision : undefined
    )
    const division = competition.divisions.find(
        (entry) => entry.id === divisionId
    )
    // A playoff or relegation fixture may pair teams of different
    // divisions; name both from the whole competition.
    const teams = new Map(
        competition.divisions.flatMap((entry) =>
            entry.teams.map((team) => [team.id, team])
        )
    )
    const teamCount = competition.divisions.reduce(
        (total, entry) => total + entry.teams.length,
        0
    )
    const dateFormat = new Intl.DateTimeFormat(safeLocale, {
        weekday: "short",
        day: "numeric",
        month: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    })
    const when = (fixture: PublicCompetitionFixture) =>
        fixture.scheduledAt
            ? dateFormat.format(new Date(fixture.scheduledAt))
            : ""
    const pageHref = (id: string) =>
        `/${safeLocale}/competitions/${competition.slug}?division=${encodeURIComponent(id)}`

    return (
        <PublicSiteShell locale={safeLocale}>
            <PublicPage>
                <div className="space-y-6">
                    <PublicBreadcrumbs
                        items={[
                            {
                                label: dictionary.app.name,
                                href: `/${safeLocale}`,
                            },
                            {
                                label: labels.title,
                                href: `/${safeLocale}/competitions`,
                            },
                            { label: competition.name },
                        ]}
                    />
                    <section
                        aria-labelledby="competition-title"
                        className="bg-card rounded-3xl border p-5 sm:p-8"
                    >
                        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex min-w-0 items-center gap-4">
                                {isEcl ? (
                                    <div className="bg-background flex size-16 shrink-0 items-center justify-center rounded-2xl border p-2 sm:size-20">
                                        <img
                                            src={ECL_LOGO}
                                            alt="ECL"
                                            className="max-h-full max-w-full object-contain"
                                        />
                                    </div>
                                ) : null}
                                <div className="min-w-0">
                                    <h1
                                        id="competition-title"
                                        className="text-3xl font-semibold tracking-tight break-words"
                                    >
                                        {competition.name} {competition.season}
                                    </h1>
                                    <p className="text-muted-foreground mt-1">
                                        <span className="mr-1.5 inline-flex align-middle">
                                            <GameBadge
                                                gameId={competition.gameId}
                                                dictionary={dictionary}
                                            />
                                        </span>
                                        {[
                                            GAME_LABELS[competition.gameId],
                                            pluralize(
                                                safeLocale,
                                                teamCount,
                                                dictionary.competitionAdmin
                                                    .countTeams
                                            ),
                                            pluralize(
                                                safeLocale,
                                                competition.divisions.length,
                                                dictionary.competitionAdmin
                                                    .countDivisions
                                            ),
                                        ].join(" · ")}
                                    </p>
                                    {competition.description ? (
                                        <p className="text-muted-foreground mt-2 max-w-2xl text-sm whitespace-pre-line">
                                            {competition.description}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                            {isEcl ? (
                                <div className="flex flex-wrap gap-2">
                                    <a
                                        className="hover:bg-muted inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium"
                                        href="https://hll-ecl.eu/rules"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {labels.rules}{" "}
                                        <ExternalLink className="size-4" />
                                    </a>
                                    <a
                                        className="hover:bg-muted inline-flex h-10 items-center gap-2 rounded-xl border px-4 text-sm font-medium"
                                        href="https://hll-ecl.eu"
                                        target="_blank"
                                        rel="noreferrer"
                                    >
                                        {labels.website}{" "}
                                        <ExternalLink className="size-4" />
                                    </a>
                                </div>
                            ) : null}
                        </div>
                    </section>
                    {!division ? (
                        <EmptyState
                            icon={Layers}
                            title={t.noDivisionsTitle}
                            description={t.noDivisionsDescription}
                        />
                    ) : (
                        <>
                            {competition.divisions.length > 1 ? (
                                <nav
                                    aria-label={t.divisionsLabel}
                                    className="bg-muted inline-flex max-w-full flex-wrap gap-1 rounded-lg p-1"
                                >
                                    {competition.divisions.map((entry) => (
                                        <Link
                                            key={entry.id}
                                            href={pageHref(entry.id)}
                                            scroll={false}
                                            aria-current={
                                                entry.id === division.id
                                                    ? "page"
                                                    : undefined
                                            }
                                            className="text-muted-foreground hover:text-foreground aria-[current=page]:bg-background aria-[current=page]:text-foreground rounded-md px-3 py-1.5 text-sm font-medium transition-colors aria-[current=page]:shadow-sm"
                                        >
                                            {entry.name}
                                        </Link>
                                    ))}
                                </nav>
                            ) : null}
                            <DivisionView
                                dictionary={dictionary}
                                locale={safeLocale}
                                division={division}
                                teams={teams}
                                when={when}
                            />
                        </>
                    )}
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}

function DivisionView({
    dictionary,
    locale,
    division,
    teams,
    when,
}: {
    dictionary: Dictionary
    locale: string
    division: {
        id: string
        name: string
        teams: PublicCompetitionTeam[]
        fixtures: PublicCompetitionFixture[]
    }
    teams: Map<string, PublicCompetitionTeam>
    when(fixture: PublicCompetitionFixture): string
}) {
    const labels = dictionary.competition
    const t = dictionary.publicSite.competition
    const standings = deriveDivisionStandings(division.teams, division.fixtures)
    const { upcoming, results } = splitPublicFixtures(division.fixtures)
    const name = (teamId: string) => (
        <TeamName
            team={teams.get(teamId)}
            withdrawnLabel={labels.withdrawn}
            unknownLabel={t.unknownTeam}
        />
    )
    const phase = (fixture: PublicCompetitionFixture) =>
        fixture.phase !== "league" ? (
            <Badge variant="outline">{labels.phases[fixture.phase]}</Badge>
        ) : null

    return (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
            <Card className="min-w-0 overflow-hidden">
                <CardHeader className="border-b">
                    <CardTitle>
                        <h2>
                            {t.standings} · {division.name}
                        </h2>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 p-0 pb-4">
                    {standings.length ? (
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[640px] text-sm">
                                <thead className="bg-muted/40 text-muted-foreground text-left">
                                    <tr>
                                        <th scope="col" className="px-4 py-3">
                                            #
                                        </th>
                                        <th scope="col" className="px-4 py-3">
                                            {labels.team}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right"
                                        >
                                            {labels.capScore}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right"
                                        >
                                            {labels.regularWins}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right"
                                        >
                                            {labels.totalWins}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right"
                                        >
                                            {labels.regularMatches}
                                        </th>
                                        <th
                                            scope="col"
                                            className="px-4 py-3 text-right"
                                        >
                                            {labels.totalMatches}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {standings.map((row, index) => (
                                        <tr
                                            key={row.teamId}
                                            className="border-t"
                                        >
                                            <td className="px-4 py-3 tabular-nums">
                                                {index + 1}
                                            </td>
                                            <th
                                                scope="row"
                                                className="px-4 py-3 text-left font-medium"
                                            >
                                                {name(row.teamId)}
                                            </th>
                                            <td className="px-4 py-3 text-right font-semibold tabular-nums">
                                                {row.capScore}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {row.regularWins}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {row.totalWins}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {row.regularMatches}
                                            </td>
                                            <td className="px-4 py-3 text-right tabular-nums">
                                                {row.totalMatches}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    ) : (
                        <p className="text-muted-foreground px-4 pt-4 text-sm sm:px-6">
                            {labels.noTeams}
                        </p>
                    )}
                    <p className="text-muted-foreground px-4 text-xs sm:px-6">
                        {t.standingsNote}
                    </p>
                </CardContent>
            </Card>
            <div className="min-w-0 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <h2>{t.upcoming}</h2>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {upcoming.length ? (
                            <ul className="space-y-3 text-sm">
                                {upcoming.map((fixture) => (
                                    <li
                                        key={fixture.id}
                                        className="flex flex-col gap-1"
                                    >
                                        <span className="text-muted-foreground text-xs">
                                            {when(fixture)}
                                        </span>
                                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                                            {name(fixture.teamAId)}
                                            <span className="text-muted-foreground">
                                                vs
                                            </span>
                                            {name(fixture.teamBId)}
                                            {phase(fixture)}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {t.noUpcoming}
                            </p>
                        )}
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <h2>{labels.results}</h2>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {results.length ? (
                            <ul className="space-y-3 text-sm">
                                {results.map((fixture) => (
                                    <li
                                        key={fixture.id}
                                        className="flex flex-col gap-1"
                                    >
                                        <span className="text-muted-foreground flex flex-wrap items-center justify-between gap-2 text-xs">
                                            <span>{when(fixture)}</span>
                                            {fixture.eventId ? (
                                                <Link
                                                    className="text-primary hover:underline"
                                                    href={`/${locale}/matches/${fixture.eventId}`}
                                                >
                                                    {labels.statistics}
                                                </Link>
                                            ) : null}
                                        </span>
                                        <span className="flex min-w-0 flex-wrap items-center gap-2">
                                            {name(fixture.teamAId)}
                                            <strong className="tabular-nums">
                                                {fixture.scoreA ?? "–"} :{" "}
                                                {fixture.scoreB ?? "–"}
                                            </strong>
                                            {name(fixture.teamBId)}
                                            {phase(fixture)}
                                            {fixture.status === "forfeit" ? (
                                                <Badge variant="secondary">
                                                    {
                                                        labels.fixtureStatus
                                                            .forfeit
                                                    }
                                                </Badge>
                                            ) : null}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {t.noResults}
                            </p>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
