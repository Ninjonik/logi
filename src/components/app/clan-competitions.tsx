"use client"
import type { ClanCompetitionView } from "@/domain/competitions/enrollment"
import { getTeamManagementMessages } from "@/i18n/messages/team-management"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import type { Dictionary } from "@/i18n/dictionaries"
import { Trophy, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { useRouter } from "next/navigation"
import { isLocale } from "@/i18n/config"
import Link from "next/link"

type Competition = ClanCompetitionView["competitions"][number]
const currentEntry = (competition: Competition) =>
    competition.registrations.some(
        (row) => !row.withdrawn && row.status !== "rejected"
    )

export function ClanCompetitions({
    view,
    serverId,
    locale,
    dictionary,
}: {
    view: ClanCompetitionView
    serverId: string
    locale: string
    dictionary: Dictionary
}) {
    const safe = isLocale(locale) ? locale : "en"
    const t = dictionary.competitionEnrollment,
        m = getTeamManagementMessages(safe),
        league = getLeagueMessages(safe)
    const router = useRouter()
    const [tab, setTab] = useState<"current" | "discover">("current")
    const [busy, setBusy] = useState(false)
    const [refreshing, startTransition] = useTransition()
    const [error, setError] = useState<string | null>(null)
    const current = view.competitions.filter(currentEntry)
    const available = view.competitions.filter(
        (c) =>
            !currentEntry(c) &&
            (!view.teams.length ||
                view.teams.some((team) => team.gameId === c.gameId))
    )
    const history = available.filter((c) => c.registrations.length > 0)
    async function command(
        action: "enroll" | "withdraw",
        competitionId: string,
        teamId: string
    ) {
        if (action === "withdraw" && !window.confirm(league.confirmWithdraw))
            return
        setBusy(true)
        setError(null)
        try {
            const response = await fetch(
                `/api/servers/${encodeURIComponent(serverId)}/competitions`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ action, competitionId, teamId }),
                }
            )
            if (!response.ok) {
                const result: unknown = await response.json()
                const code =
                    result && typeof result === "object" && "error" in result
                        ? result.error
                        : null
                setError(
                    code === "minimum_players"
                        ? t.minimum_players
                        : code === "registration_closed"
                          ? t.registration_closed
                          : code === "team_not_owned"
                            ? t.team_not_owned
                            : t.error
                )
            } else startTransition(() => router.refresh())
        } catch {
            setError(t.error)
        } finally {
            setBusy(false)
        }
    }
    function card(competition: Competition) {
        const teams = view.teams.filter(
            (team) => team.gameId === competition.gameId
        )
        return (
            <article
                key={competition.id}
                className="bg-card rounded-2xl border p-5 sm:p-6"
            >
                <div className="flex items-start gap-4">
                    <div className="bg-muted rounded-xl p-3">
                        <Trophy className="size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <p className="text-muted-foreground text-xs">
                            {competition.gameId === "wardogs"
                                ? "Wardogs"
                                : "Hell Let Loose"}{" "}
                            · {competition.season}
                        </p>
                        <h3 className="mt-1 text-xl font-semibold">
                            {competition.name}
                        </h3>
                    </div>
                    <Badge variant="secondary">
                        {t[competition.registrationMode]}
                    </Badge>
                </div>
                <p className="text-muted-foreground mt-4 text-sm">
                    {competition.minimumLinkedPlayers === null
                        ? t.noMinimum
                        : t.minimum.replace(
                              "{count}",
                              String(competition.minimumLinkedPlayers)
                          )}
                </p>
                <div className="mt-5 space-y-3">
                    {teams.map((team) => {
                        const registration = competition.registrations.find(
                            (row) => row.teamId === team.id
                        )
                        const enrolled =
                            registration &&
                            !registration.withdrawn &&
                            registration.status !== "rejected"
                        const blocked =
                            competition.registrationMode === "closed" ||
                            view.linkedPlayers <
                                (competition.minimumLinkedPlayers ?? 0)
                        return (
                            <div
                                key={team.id}
                                className="flex flex-wrap items-center gap-3 rounded-lg border p-3"
                            >
                                <strong className="flex-1 text-sm">
                                    {team.name}
                                </strong>
                                {registration && (
                                    <Badge variant="outline">
                                        {
                                            t[
                                                registration.withdrawn
                                                    ? "withdrawn"
                                                    : registration.status
                                            ]
                                        }
                                    </Badge>
                                )}
                                <Button
                                    variant={enrolled ? "outline" : "default"}
                                    disabled={
                                        busy ||
                                        refreshing ||
                                        (!enrolled && blocked)
                                    }
                                    onClick={() =>
                                        void command(
                                            enrolled ? "withdraw" : "enroll",
                                            competition.id,
                                            team.id
                                        )
                                    }
                                >
                                    {enrolled ? t.withdraw : t.enroll}
                                </Button>
                            </div>
                        )
                    })}
                </div>
                {!teams.length && (
                    <Button asChild className="mt-4" variant="outline">
                        <Link
                            href={`/${locale}/dashboard/servers/${serverId}/teams`}
                        >
                            {m.createAndConnect}
                        </Link>
                    </Button>
                )}
                <div className="mt-5 flex flex-wrap gap-4 border-t pt-4">
                    <Link
                        className="text-primary text-sm underline"
                        href={`/${locale}/leagues/${competition.slug}`}
                    >
                        {t.publicLink}
                    </Link>
                    {teams.length > 0 && (
                        <Link
                            className="text-primary inline-flex items-center gap-1 text-sm underline"
                            href={`/${locale}/leagues/${competition.slug}/join`}
                        >
                            {m.manageFixtures}
                            <ArrowRight className="size-3.5" />
                        </Link>
                    )}
                </div>
            </article>
        )
    }
    return (
        <div className="space-y-6">
            <div className="bg-muted/30 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
                <div>
                    <p className="font-medium">
                        {view.teams.map((team) => team.name).join(", ") ||
                            m.noClanTeam}
                    </p>
                    <p className="text-muted-foreground mt-1 text-sm">
                        {t.players.replace(
                            "{count}",
                            String(view.linkedPlayers)
                        )}
                    </p>
                </div>
                <Button asChild variant="outline">
                    <Link
                        href={`/${locale}/dashboard/servers/${serverId}/teams`}
                    >
                        {m.title}
                    </Link>
                </Button>
            </div>
            {error && (
                <p
                    role="alert"
                    className="text-destructive rounded-xl border p-4 text-sm"
                >
                    {error}
                </p>
            )}
            <div
                role="group"
                aria-label={t.title}
                className="flex flex-wrap gap-2 border-b pb-3"
            >
                {(["current", "discover"] as const).map((value) => (
                    <Button
                        key={value}

                        aria-pressed={tab === value}
                        aria-controls={`competitions-${value}`}
                        id={`tab-${value}`}
                        variant={tab === value ? "default" : "outline"}
                        onClick={() => setTab(value)}
                    >
                        {value === "current"
                            ? `${m.yourCompetitions} (${current.length})`
                            : m.browseCompetitions}
                    </Button>
                ))}
            </div>
            <section
                id={`competitions-${tab}`}
                aria-labelledby={`tab-${tab}`}
                className="space-y-5"
            >
                {tab === "current" ? (
                    <>
                        {current.length ? (
                            current.map(card)
                        ) : (
                            <div className="rounded-2xl border border-dashed p-8 text-center">
                                <Trophy className="text-muted-foreground mx-auto mb-3 size-8" />
                                <p className="text-muted-foreground mb-4">
                                    {m.noCurrent}
                                </p>
                                <Button onClick={() => setTab("discover")}>
                                    {m.browseCompetitions}
                                </Button>
                            </div>
                        )}
                        {history.length > 0 && (
                            <details className="rounded-xl border p-4">
                                <summary className="cursor-pointer font-medium">
                                    {m.history} ({history.length})
                                </summary>
                                <div className="mt-4 space-y-5">
                                    {history.map(card)}
                                </div>
                            </details>
                        )}
                    </>
                ) : available.length ? (
                    available.map(card)
                ) : (
                    <p className="text-muted-foreground rounded-xl border border-dashed p-8">
                        {m.noAvailable}
                    </p>
                )}
            </section>
        </div>
    )
}
