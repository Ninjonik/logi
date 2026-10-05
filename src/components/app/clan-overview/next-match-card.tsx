import { CalendarPlus } from "lucide-react"
import Link from "next/link"

import {
    rosterFill,
    signupSummary,
    type OverviewAssignment,
} from "@/domain/workspaces/clan-overview"
import {
    fill,
    type OverviewFormat,
} from "@/components/app/clan-overview/overview-format"
import type { MatchTeamAssignment } from "@/domain/teams/match-teams"
import { EmptyState } from "@/components/app/empty-state"
import type { EventRecord, Roster } from "@/types/domain"
import type { Dictionary } from "@/i18n/dictionaries"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const rosterTones = {
    draft: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    published:
        "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    missing: "border-border bg-muted text-muted-foreground",
} as const

function TeamTile({ team }: { team: MatchTeamAssignment }) {
    const { name, shortCode, logoUrl } = team.snapshot
    const code =
        shortCode?.trim() ||
        name
            .split(/\s+/)
            .map((word) => word[0])
            .join("")
            .slice(0, 3)
            .toUpperCase()
    return (
        <span
            title={name}
            className="bg-muted text-foreground flex size-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border text-xs font-bold"
        >
            {logoUrl ? (
                <img
                    src={logoUrl}
                    alt={name}
                    className="size-full object-contain"
                />
            ) : (
                <>
                    <span aria-hidden="true">{code}</span>
                    <span className="sr-only">{name}</span>
                </>
            )}
        </span>
    )
}

/** The clan's next match: when, who, roster places, sign-ups and the next step. */
export function NextMatchCard({
    event,
    roster,
    assignments,
    categoryLabel,
    mapLabel,
    canAdmin,
    hrefs,
    format,
    now,
    dictionary,
}: {
    event: EventRecord | null
    roster: Roster | null
    assignments: readonly OverviewAssignment[]
    categoryLabel?: string
    mapLabel?: string
    canAdmin: boolean
    hrefs: {
        match: (eventId: string) => string
        roster: (rosterId: string) => string
        createRoster: string
        newMatch: string
    }
    format: OverviewFormat
    now: Date
    dictionary: Dictionary
}) {
    const text = dictionary.clanOverview
    if (!event) {
        return (
            <EmptyState
                icon={CalendarPlus}
                title={text.noMatchTitle}
                description={
                    canAdmin ? text.noMatchManager : text.noMatchMember
                }
                className="flex-[999_1_420px]"
                actions={
                    canAdmin ? (
                        <Button asChild className="rounded-xl">
                            <Link href={hrefs.newMatch}>{text.newMatch}</Link>
                        </Button>
                    ) : null
                }
            />
        )
    }

    const places = rosterFill(roster)
    const signups = signupSummary(event, assignments)
    const rosterState = roster
        ? roster.published
            ? "published"
            : "draft"
        : "missing"
    const teams = [...(event.matchTeams ?? [])].sort((a, b) =>
        a.slot.localeCompare(b.slot)
    )
    const details = [
        mapLabel,
        event.side,
        fill(text.meeting, { time: format.time(event.meetingStart) }),
    ].filter((part): part is string => Boolean(part?.trim()))
    const signupLine = [
        fill(text.signedUp, { count: signups.signedUp }),
        signups.unanswered === null
            ? null
            : fill(text.unanswered, { count: signups.unanswered }),
    ]
        .filter(Boolean)
        .join(" · ")

    return (
        <section
            aria-labelledby="overview-next-match"
            className="bg-card flex min-w-0 flex-[999_1_420px] flex-col gap-4 rounded-2xl border p-5 shadow-xs sm:p-6"
        >
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2
                    id="overview-next-match"
                    className="text-muted-foreground text-xs font-semibold tracking-wide uppercase"
                >
                    {fill(text.nextMatch, {
                        when: format.when(event.gameStart, now, text),
                    })}
                </h2>
                <span
                    className={cn(
                        "inline-flex h-6 items-center rounded-full border px-2.5 text-xs font-medium",
                        rosterTones[rosterState]
                    )}
                >
                    {rosterState === "published"
                        ? text.rosterPublished
                        : rosterState === "draft"
                          ? text.rosterDraft
                          : text.rosterMissing}
                </span>
            </div>
            <div className="flex flex-wrap items-center gap-3.5">
                {teams.length ? (
                    <div className="flex items-center gap-3">
                        {teams.map((team, index) => (
                            <span
                                key={team.slot}
                                className="flex items-center gap-3"
                            >
                                {index ? (
                                    <span className="text-muted-foreground text-sm">
                                        {text.versus}
                                    </span>
                                ) : null}
                                <TeamTile team={team} />
                            </span>
                        ))}
                    </div>
                ) : null}
                <div className="flex min-w-0 flex-[1_1_200px] flex-col gap-0.5">
                    <span className="text-lg leading-snug font-semibold break-words">
                        {categoryLabel
                            ? `${event.name} · ${categoryLabel}`
                            : event.name}
                    </span>
                    <span className="text-muted-foreground text-sm">
                        {details.join(" · ")}
                    </span>
                </div>
            </div>
            {places ? (
                <div className="space-y-2">
                    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-sm">
                        <span className="font-medium">
                            {fill(text.rosterFill, places)}
                        </span>
                        <span className="text-muted-foreground">
                            {signupLine}
                        </span>
                    </div>
                    <Progress
                        aria-label={text.rosterFillLabel}
                        aria-valuetext={`${places.filled} / ${places.total}`}
                        value={Math.round((places.filled / places.total) * 100)}
                        className="bg-muted h-2"
                    />
                </div>
            ) : (
                <p className="text-muted-foreground text-sm">{signupLine}</p>
            )}
            <div className="flex flex-wrap gap-2">
                {canAdmin ? (
                    <Button asChild className="rounded-xl">
                        <Link
                            href={
                                roster
                                    ? hrefs.roster(roster.id)
                                    : hrefs.createRoster
                            }
                        >
                            {roster ? text.finishRoster : text.createRoster}
                        </Link>
                    </Button>
                ) : roster?.published ? (
                    <Button asChild className="rounded-xl">
                        <Link href={hrefs.roster(roster.id)}>
                            {text.showRoster}
                        </Link>
                    </Button>
                ) : null}
                <Button asChild variant="outline" className="rounded-xl">
                    <Link href={hrefs.match(event.id)}>{text.openMatch}</Link>
                </Button>
            </div>
        </section>
    )
}
