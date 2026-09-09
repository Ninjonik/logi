import {
    CalendarDays,
    ClipboardList,
    Info,
    ListTodo,
    Radio,
    Target,
    Trophy,
    Users,
} from "lucide-react"
import { addDays, format } from "date-fns"
import type { Metadata } from "next"

import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from "@/components/ui/tooltip"
import { EventCalendarEventDialog } from "@/components/app/event-calendar-event-dialog"
import { PerformanceHistoryChart } from "@/components/app/performance-history-chart"
import { getGuildPerformanceHistory } from "@/lib/read-models/performance-history"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { getRecentMatchSummary } from "@/lib/read-models/server-dashboard"
import { getEventCategoryPresentation } from "@/lib/event-categories"
import { PageHeader } from "@/components/app/page-header"
import { EmojiValue } from "@/components/app/emoji-value"
import { getGuildMetadata } from "@/lib/server-metadata"
import { formatDateKey, formatTime } from "@/lib/format"
import { getServerContext } from "@/lib/server-context"
import { StatCard } from "@/components/app/stat-card"
import { type Locale, isLocale } from "@/i18n/config"
import { getDictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { isGameId } from "@/domain/games/game"
import { Badge } from "@/components/ui/badge"
import { getLoggedInUser } from "@/lib/auth"

export const metadata: Metadata = {
    title: "Server dashboard | Logi",
    description: "Manage your server community.",
}

function getGreeting(
    dictionary: ReturnType<typeof getDictionary>,
    timezone?: string
) {
    const hour = Number(
        new Intl.DateTimeFormat("en-US", {
            timeZone: timezone,
            hour: "numeric",
            hour12: false,
        }).format(new Date())
    )

    if (hour < 12) return dictionary.dashboard.greetingMorning
    if (hour < 18) return dictionary.dashboard.greetingAfternoon
    return dictionary.dashboard.greetingEvening
}

function getWeekDays(timezone?: string) {
    const today = new Date()
    return Array.from({ length: 7 }, (_, index) => {
        const day = addDays(today, index)
        return {
            date: day,
            key: formatDateKey(day.toISOString(), timezone),
        }
    })
}

export default async function ServerOverviewPage({
    params,
    searchParams,
}: {
    params: Promise<{ locale: string; serverId: string }>
    searchParams: Promise<{ game?: string }>
}) {
    const { locale, serverId } = await params
    const { game } = await searchParams
    const safeLocale = (isLocale(locale) ? locale : "en") as Locale
    const dictionary = getDictionary(safeLocale)
    const gameScope = isGameId(game) ? game : "all"
    const context = await getServerContext(serverId, gameScope)
    if (!context) return null
    const recentMatchSummary = await getRecentMatchSummary(serverId)
    const {
        server,
        events,
        rosters,
        canAdmin,
        assignments = [],
        groups = [],
        squadPresets = [],
        topicPresets = [],
        discordConfig,
    } = context
    const performanceHistory = await getGuildPerformanceHistory(
        server.discordId,
        serverId,
        gameScope
    )

    const user = await getLoggedInUser()

    const publishedRosters = rosters.filter((roster) => roster.published)
    const greeting = getGreeting(dictionary, discordConfig?.timezone)
    const weekDays = getWeekDays(discordConfig?.timezone)
    const eventsByDate = new Map<string, typeof events>()
    for (const event of events) {
        const key = formatDateKey(event.meetingStart, discordConfig?.timezone)
        eventsByDate.set(key, [...(eventsByDate.get(key) ?? []), event])
    }
    const nextEvent = [...events]
        .filter((event) => new Date(event.meetingStart).getTime() >= Date.now())
        .sort(
            (a, b) =>
                new Date(a.meetingStart).getTime() -
                new Date(b.meetingStart).getTime()
        )[0]

    return (
        <>
            <PageHeader
                title={`${greeting}, ${user?.name}`}
                description={
                    server.description || dictionary.dashboard.description
                }
            />
            <div className="space-y-6 px-4 lg:px-6">
                <Card className="border-border/60 overflow-hidden rounded-2xl bg-[linear-gradient(135deg,rgba(90,110,55,.18),rgba(201,168,78,.08))]">
                    <CardHeader>
                        <CardTitle className="text-2xl">
                            {dictionary.sidebar.workspace}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-4">
                            <div>
                                <div className="text-muted-foreground text-sm tracking-[0.22em] uppercase">
                                    {greeting}, {user?.name}
                                </div>
                                <div className="mt-2 text-3xl font-semibold tracking-tight">
                                    {server.name}
                                </div>
                                <p className="text-muted-foreground mt-3 max-w-2xl text-sm">
                                    {nextEvent
                                        ? `${dictionary.clan.upcomingEvents}: ${nextEvent.name}`
                                        : dictionary.calendarCards.noEvents}
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-3">
                                {canAdmin ? (
                                    <Button asChild className="rounded-xl">
                                        <a
                                            href={`/${safeLocale}/dashboard/servers/${serverId}/events/create`}
                                        >
                                            <ListTodo className="size-4" />
                                            {dictionary.common.createEvent}
                                        </a>
                                    </Button>
                                ) : null}
                                {canAdmin ? (
                                    <Button
                                        asChild
                                        variant="outline"
                                        className="rounded-xl"
                                    >
                                        <a
                                            href={`/${safeLocale}/dashboard/servers/${serverId}/rosters/create`}
                                        >
                                            <Radio className="size-4" />
                                            {dictionary.common.createRoster}
                                        </a>
                                    </Button>
                                ) : null}
                                <Button
                                    asChild
                                    variant="outline"
                                    className="rounded-xl"
                                >
                                    <a
                                        href={`/${safeLocale}/dashboard/servers/${serverId}/calendar`}
                                    >
                                        <CalendarDays className="size-4" />
                                        {dictionary.sidebar.calendar}
                                    </a>
                                </Button>
                                {canAdmin ? (
                                    <Button
                                        asChild
                                        variant="ghost"
                                        className="rounded-xl"
                                    >
                                        <a
                                            href={`/${safeLocale}/dashboard/servers/${serverId}/events`}
                                        >
                                            {dictionary.sidebar.events}
                                        </a>
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                        <div className="flex flex-wrap gap-3">
                            <StatCard
                                className="min-w-[220px] flex-1 lg:basis-0"
                                title={dictionary.clan.upcomingEvents}
                                value={events.length}
                                description={
                                    nextEvent
                                        ? nextEvent.name
                                        : dictionary.common.notAvailable
                                }
                                icon={CalendarDays}
                            />
                            <StatCard
                                className="min-w-[220px] flex-1 lg:basis-0"
                                title={dictionary.clan.publishedRosters}
                                value={publishedRosters.length}
                                description={`${rosters.length} ${dictionary.sidebar.rosters.toLowerCase()}`}
                                icon={Radio}
                            />
                            <StatCard
                                className="min-w-[220px] flex-1 lg:basis-0"
                                title={dictionary.clan.members}
                                value={server.memberIds.length}
                                description={`${assignments.length} ${dictionary.userManagement.title.toLowerCase()}`}
                                icon={Users}
                            />
                            <StatCard
                                className="min-w-[220px] flex-1 lg:basis-0"
                                title={dictionary.clan.presets}
                                value={
                                    groups.length +
                                    squadPresets.length +
                                    topicPresets.length
                                }
                                description={dictionary.sidebar.configuration}
                                icon={ClipboardList}
                            />
                        </div>
                    </CardContent>
                </Card>
                <div className="grid gap-6 xl:grid-cols-2">
                    <PerformanceHistoryChart
                        title={dictionary.clan.performanceTrend}
                        matches={performanceHistory}
                        dictionary={dictionary}
                        kind="effectiveness"
                    />
                    <PerformanceHistoryChart
                        title={dictionary.clan.kd}
                        matches={performanceHistory}
                        dictionary={dictionary}
                        kind="combat"
                    />
                    <PerformanceHistoryChart
                        title={dictionary.clan.points}
                        matches={performanceHistory}
                        dictionary={dictionary}
                        kind="points"
                    />
                </div>
                <Card className="border-border/60 overflow-hidden rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                        <div>
                            <CardTitle>{dictionary.clan.recentGames}</CardTitle>
                            <p className="text-muted-foreground mt-1 text-sm">
                                {dictionary.clan.lastTenGames}
                            </p>
                        </div>
                        <Trophy
                            className="size-5 text-amber-500"
                            aria-hidden="true"
                        />
                    </CardHeader>
                    <CardContent>
                        {recentMatchSummary?.recentMatches.length ? (
                            <>
                                <div className="mb-5 grid gap-3 sm:grid-cols-2">
                                    <StatCard
                                        title={dictionary.clan.record}
                                        value={`${recentMatchSummary.wins}W - ${recentMatchSummary.losses}L`}
                                        description={
                                            dictionary.clan.lastTenGames
                                        }
                                        icon={Trophy}
                                    />
                                    <StatCard
                                        title={dictionary.clan.winRate}
                                        value={`${Math.round(recentMatchSummary.winRate * 100)}%`}
                                        description={
                                            dictionary.clan.lastTenGames
                                        }
                                        icon={Trophy}
                                    />
                                </div>
                                <div className="space-y-2">
                                    {recentMatchSummary.recentMatches.map(
                                        (match) => (
                                            <a
                                                key={match.id}
                                                href={`/${safeLocale}/dashboard/servers/${serverId}/matches/${match.id}`}
                                                className="border-border/60 hover:bg-muted/60 flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 transition"
                                            >
                                                <span className="font-medium">
                                                    {match.name}
                                                </span>
                                                <span className="flex items-center gap-3">
                                                    <span
                                                        className={
                                                            match.outcome ===
                                                            "victory"
                                                                ? "text-sm font-medium text-emerald-600 dark:text-emerald-400"
                                                                : match.outcome ===
                                                                    "defeat"
                                                                  ? "text-sm font-medium text-red-600 dark:text-red-400"
                                                                  : "text-muted-foreground text-sm font-medium"
                                                        }
                                                    >
                                                        {match.outcome ===
                                                        "victory"
                                                            ? dictionary
                                                                  .publicProfiles
                                                                  .victory
                                                            : match.outcome ===
                                                                "defeat"
                                                              ? dictionary
                                                                    .publicProfiles
                                                                    .defeat
                                                              : dictionary.clan
                                                                    .draw}
                                                    </span>
                                                    <span className="font-semibold tabular-nums">
                                                        {match.score.sideA} –{" "}
                                                        {match.score.sideB}
                                                    </span>
                                                </span>
                                            </a>
                                        )
                                    )}
                                </div>
                                <div className="border-border/60 mt-6 border-t pt-5">
                                    <div className="mb-3 flex items-center gap-1.5">
                                        <h3 className="font-semibold">
                                            {dictionary.clan.topPlayers}
                                        </h3>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="text-muted-foreground hover:text-foreground rounded-full"
                                                    aria-label={
                                                        dictionary.clan
                                                            .topPlayersCalculation
                                                    }
                                                >
                                                    <Info className="size-4" />
                                                </button>
                                            </TooltipTrigger>
                                            <TooltipContent className="max-w-72">
                                                {
                                                    dictionary.clan
                                                        .topPlayersCalculation
                                                }
                                            </TooltipContent>
                                        </Tooltip>
                                    </div>
                                    {(recentMatchSummary.topPlayers ?? [])
                                        .length ? (
                                        <div className="grid gap-3 lg:grid-cols-5">
                                            {(
                                                recentMatchSummary.topPlayers ??
                                                []
                                            ).map((player, index) => (
                                                <div
                                                    key={player.id}
                                                    className="border-border/60 rounded-xl border p-3"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <span className="truncate font-medium">
                                                            #{index + 1}{" "}
                                                            {player.name}
                                                        </span>
                                                        <span className="flex items-center gap-1 text-sm font-semibold tabular-nums">
                                                            <Target className="text-muted-foreground size-3.5" />
                                                            {player.kills}{" "}
                                                            {
                                                                dictionary.clan
                                                                    .kills
                                                            }
                                                        </span>
                                                    </div>
                                                    <p className="text-muted-foreground mt-1 text-xs">
                                                        {player.matches}{" "}
                                                        {
                                                            dictionary.clan
                                                                .matchesPlayed
                                                        }
                                                    </p>
                                                    {player.roles.length ? (
                                                        <div className="mt-3 flex flex-wrap gap-1.5">
                                                            {player.roles.map(
                                                                (role) => (
                                                                    <Badge
                                                                        key={`${role.name}:${role.icon ?? ""}`}
                                                                        variant="secondary"
                                                                        className="gap-1 rounded-full px-2 py-1 text-xs"
                                                                    >
                                                                        {role.icon ? (
                                                                            <img
                                                                                src={
                                                                                    role.icon
                                                                                }
                                                                                alt=""
                                                                                className="size-3.5 object-contain invert dark:invert-0"
                                                                            />
                                                                        ) : null}
                                                                        {
                                                                            role.name
                                                                        }
                                                                    </Badge>
                                                                )
                                                            )}
                                                        </div>
                                                    ) : null}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-sm">
                                            {dictionary.clan.noPlayerStats}
                                        </p>
                                    )}
                                </div>
                            </>
                        ) : (
                            <p className="border-border/60 text-muted-foreground rounded-xl border border-dashed px-4 py-8 text-center text-sm">
                                {dictionary.clan.noRecentGames}
                            </p>
                        )}
                    </CardContent>
                </Card>
                <Card className="border-border/60 overflow-hidden rounded-2xl">
                    <CardHeader className="flex flex-row items-center justify-between gap-4">
                        <div>
                            <CardTitle>
                                {dictionary.calendarCards.eventCalendar}
                            </CardTitle>
                            <p className="text-muted-foreground mt-1 text-sm">
                                Next 7 days
                            </p>
                        </div>
                        <Button
                            asChild
                            variant="outline"
                            className="rounded-xl"
                        >
                            <a
                                href={`/${safeLocale}/dashboard/servers/${serverId}/calendar`}
                            >
                                {dictionary.common.openAction}
                            </a>
                        </Button>
                    </CardHeader>
                    <CardContent>
                        <div className="grid gap-3 lg:grid-cols-7">
                            {weekDays.map((day) => {
                                const dayEvents =
                                    eventsByDate.get(day.key) ?? []

                                return (
                                    <div
                                        key={day.key}
                                        className="border-border/60 bg-card/60 rounded-2xl border p-3"
                                    >
                                        <div className="flex items-center justify-between gap-2">
                                            <div>
                                                <div className="text-muted-foreground text-xs tracking-[0.18em] uppercase">
                                                    {format(day.date, "EEE")}
                                                </div>
                                                <div className="mt-1 text-lg font-semibold">
                                                    {format(day.date, "d MMM")}
                                                </div>
                                            </div>
                                            <div className="bg-primary/10 text-primary rounded-full px-2 py-1 text-xs font-medium">
                                                {dayEvents.length}
                                            </div>
                                        </div>
                                        <div className="mt-3 space-y-2">
                                            {dayEvents.length ? (
                                                dayEvents
                                                    .slice(0, 3)
                                                    .map((event) => {
                                                        const category =
                                                            getEventCategoryPresentation(
                                                                event,
                                                                server.eventCategories ??
                                                                    []
                                                            )

                                                        return (
                                                            <EventCalendarEventDialog
                                                                key={event.id}
                                                                locale={
                                                                    safeLocale
                                                                }
                                                                serverId={
                                                                    serverId
                                                                }
                                                                event={event}
                                                                groups={groups}
                                                                eventCategories={
                                                                    server.eventCategories ??
                                                                    []
                                                                }
                                                                timezone={
                                                                    discordConfig?.timezone
                                                                }
                                                                dictionary={
                                                                    dictionary
                                                                }
                                                                signupLanguage={
                                                                    discordConfig?.defaultLanguage ??
                                                                    "en"
                                                                }
                                                                trigger={
                                                                    <button
                                                                        type="button"
                                                                        className="hover:border-primary/40 hover:bg-primary/5 block w-full rounded-xl border px-2.5 py-2 text-left transition"
                                                                        style={{
                                                                            borderColor: `${category.color}66`,
                                                                            boxShadow: `inset 3px 0 0 ${category.color}`,
                                                                        }}
                                                                    >
                                                                        <div className="truncate text-sm font-medium">
                                                                            <span className="inline-flex items-center gap-1.5">
                                                                                <EmojiValue
                                                                                    value={
                                                                                        category.emoji
                                                                                    }
                                                                                />
                                                                                <span className="truncate">
                                                                                    {
                                                                                        event.name
                                                                                    }
                                                                                </span>
                                                                            </span>
                                                                        </div>
                                                                        <div className="text-muted-foreground mt-1 text-xs">
                                                                            {formatTime(
                                                                                event.meetingStart,
                                                                                discordConfig?.timezone
                                                                            )}
                                                                            {category.label
                                                                                ? ` • ${category.label}`
                                                                                : ""}
                                                                        </div>
                                                                    </button>
                                                                }
                                                            />
                                                        )
                                                    })
                                            ) : (
                                                <div className="border-border/60 text-muted-foreground rounded-xl border border-dashed px-2.5 py-4 text-center text-xs">
                                                    {
                                                        dictionary.calendarCards
                                                            .noEvents
                                                    }
                                                </div>
                                            )}
                                            {dayEvents.length > 3 ? (
                                                <div className="text-muted-foreground px-1 text-xs">
                                                    +{dayEvents.length - 3}{" "}
                                                    {
                                                        dictionary.calendarPage
                                                            .moreEvents
                                                    }
                                                </div>
                                            ) : null}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </CardContent>
                </Card>
                {nextEvent ? (
                    <Card className="border-border/60 rounded-2xl">
                        <CardHeader>
                            {getEventCategoryPresentation(
                                nextEvent,
                                server.eventCategories ?? []
                            ).label ? (
                                <Badge
                                    variant="outline"
                                    className="mb-2 rounded-full"
                                    style={{
                                        borderColor: `${getEventCategoryPresentation(nextEvent, server.eventCategories ?? []).color}66`,
                                        color: getEventCategoryPresentation(
                                            nextEvent,
                                            server.eventCategories ?? []
                                        ).color,
                                        backgroundColor: `${getEventCategoryPresentation(nextEvent, server.eventCategories ?? []).color}14`,
                                    }}
                                >
                                    <EmojiValue
                                        value={
                                            getEventCategoryPresentation(
                                                nextEvent,
                                                server.eventCategories ?? []
                                            ).emoji
                                        }
                                    />
                                    <span>
                                        {
                                            getEventCategoryPresentation(
                                                nextEvent,
                                                server.eventCategories ?? []
                                            ).label
                                        }
                                    </span>
                                </Badge>
                            ) : null}
                            <CardTitle>{nextEvent.name}</CardTitle>
                            <p className="text-muted-foreground text-sm">
                                {nextEvent.description ||
                                    dictionary.event.listDescription}
                            </p>
                        </CardHeader>
                        <CardContent className="flex flex-wrap items-center gap-3">
                            <Button asChild className="rounded-xl">
                                <a
                                    href={`/${safeLocale}/dashboard/servers/${serverId}/${nextEvent.kind === "training" ? "trainings" : "matches"}/${nextEvent.id}`}
                                >
                                    {dictionary.common.viewDetails}
                                </a>
                            </Button>
                            <Button
                                asChild
                                variant="outline"
                                className="rounded-xl"
                            >
                                <a
                                    href={`/${safeLocale}/dashboard/servers/${serverId}/rosters`}
                                >
                                    {dictionary.sidebar.rosters}
                                </a>
                            </Button>
                        </CardContent>
                    </Card>
                ) : null}
            </div>
        </>
    )
}
