"use client"

import { CommandsSettingsForm } from "@/components/app/settings/commands/commands-settings-form"
import { MembershipSettingsForm } from "@/components/app/membership-settings-form"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { settingsSnapshot } from "@/components/app/settings/settings-snapshot"
import { SettingsOverview } from "@/components/app/settings/settings-overview"
import { PresetsOverview } from "@/components/app/settings/presets-overview"
import { DiscordMetadataPreviewContext } from "@/hooks/use-discord-metadata"
import { ClanOverview } from "@/components/app/clan-overview/clan-overview"
import { TicketSettingsForm } from "@/components/app/ticket-settings-form"
import { clanFixtures, sampleMetadata, SAMPLE_ID } from "./clan-fixtures"
import { UserSettingsForm } from "@/components/app/user-settings-form"
import { onboardingSamples } from "@/i18n/messages/onboarding-samples"
import { ClanCompetitions } from "@/components/app/clan-competitions"
import { MatchListView } from "@/components/app/match-list-view"
import { getWalkthroughCopy } from "@/i18n/messages/walkthrough"
import { ResourceTable } from "@/components/app/resource-table"
import { getOnboardingCopy } from "@/i18n/messages/onboarding"
import { CalendarView } from "@/components/app/calendar-view"
import { RosterBoard } from "@/components/app/roster-board"
import type { ChapterId } from "@/domain/onboarding/tours"
import { buildMatchListRows } from "@/lib/match-list-rows"
import { PageHeader } from "@/components/app/page-header"
import { useWalkthrough } from "./walkthrough-context"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { CalendarDays, Plus } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { useMemo, type ReactNode } from "react"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Locale } from "@/i18n/config"
import Link from "next/link"

export type SectionChapter = Exclude<
    ChapterId,
    "players" | "performance" | "match"
>

type Props = {
    chapter: SectionChapter | "match"
    dictionary: Dictionary
    locale: Locale
    serverId: string
    limited: boolean
    canManage: boolean
}

/** Fixture-only page variants. Never receive live clan records or credentials. */
export function SectionExamples({
    chapter,
    dictionary: d,
    locale,
    serverId,
    limited,
    canManage,
}: Props) {
    const { exampleNow } = useWalkthrough()
    const data = useMemo(() => clanFixtures(new Date(exampleNow)), [exampleNow])
    const s = onboardingSamples(locale)
    const root = `/${locale}/dashboard/servers/${serverId}`
    const heading = getOnboardingCopy(locale).chapters[chapter][0]
    const badge = getWalkthroughCopy(locale).example
    const config = { ...data.config, defaultLanguage: locale }
    const snapshot = settingsSnapshot(data.guild.enabledGames, config)
    const header = (title = heading, action?: ReactNode) => (
        <PageHeader title={title} badge={badge} actions={action} />
    )
    const table = (columns: string[], rows: Array<Array<ReactNode>>) => (
        <ResourceTable<{ id: string; cells: ReactNode[] }>
            dictionary={d}
            rows={rows.map((cells, i) => ({ id: `sample-row-${i}`, cells }))}
            columns={columns.map((title, i) => ({
                key: String(i),
                title,
                render: (row) => row.cells[i],
            }))}
            getHref={() => root}
            page={1}
            pageSize={20}
            pageCount={1}
            totalRows={rows.length}
            search=""
        />
    )
    const field = (label: string, value: string) => (
        <div className="space-y-2" key={label}>
            <Label>{label}</Label>
            <Input aria-label={label} value={value} readOnly />
        </div>
    )
    const toggle = (label: string) => (
        <div
            className="flex items-center justify-between gap-4 rounded-lg border p-4"
            key={label}
        >
            <Label>{label}</Label>
            <Switch aria-label={label} checked />
        </div>
    )
    const panel = (title: string, children: ReactNode) => (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">{children}</CardContent>
        </Card>
    )
    const frame = (
        children: ReactNode,
        title = heading,
        action?: ReactNode
    ) => (
        <>
            {header(title, action)}
            <div className="px-4 pb-24 lg:px-6">
                <div data-tour-section={chapter} className="space-y-5">
                    {children}
                </div>
            </div>
        </>
    )
    const create = (href: string, label: string) => (
        <Button asChild>
            <Link href={`${root}${href}`}>
                <Plus className="size-4" />
                {label}
            </Link>
        </Button>
    )
    let content: ReactNode
    switch (chapter) {
        case "welcome":
        case "workspace":
        case "finish":
        case "overview":
            content = limited ? (
                frame(
                    <>
                        {canManage && (
                            <ClanCompetitions
                                dictionary={d}
                                locale={locale}
                                serverId={SAMPLE_ID}
                                view={{
                                    linkedPlayers: 4,
                                    teams: [
                                        {
                                            id: "sample-nova",
                                            name: "NOVA",
                                            gameId: "wardogs",
                                        },
                                    ],
                                    competitions: [
                                        {
                                            id: "sample-cup",
                                            name: s.tournament,
                                            season: s.season,
                                            slug: "sample-cup",
                                            gameId: "wardogs",
                                            registrationMode: "approval",
                                            minimumLinkedPlayers: 3,
                                            registrations: [
                                                {
                                                    teamId: "sample-nova",
                                                    status: "approved",
                                                    withdrawn: false,
                                                },
                                            ],
                                        },
                                    ],
                                }}
                            />
                        )}
                        {table(
                            [s.team, s.players, s.status],
                            [["NOVA", 4, s.registered]]
                        )}
                    </>
                )
            ) : (
                <ClanOverview
                    locale={locale}
                    serverId={serverId}
                    now={data.now}
                    context={{
                        server: data.guild,
                        events: data.events,
                        rosters: [data.roster],
                        canAdmin: canManage,
                        assignments: data.assignments,
                        discordConfig: config,
                        groups: data.groups,
                        squadPresets: [
                            {
                                id: "sample-preset",
                                name: "NOVA",
                                gameId: "wardogs",
                                squads: [],
                                guildId: SAMPLE_ID,
                                createdAt: data.guild.createdAt,
                                updatedAt: data.guild.updatedAt,
                            },
                        ],
                        topicPresets: [],
                    }}
                    extras={{
                        performance: data.performance,
                        recent: {
                            recentMatches: [
                                {
                                    id: data.previous.id,
                                    name: data.previous.name,
                                    endedAt: data.previous.gameEnd,
                                    outcome: "victory",
                                    scores: [100, 72, 58],
                                },
                            ],
                            wins: 1,
                            losses: 0,
                            winRate: 1,
                            topPlayers: data.users.map((p, i) => ({
                                id: p.id,
                                name: p.name,
                                matches: 8,
                                kills: 42 - i * 3,
                                deaths: 18,
                                roles: [],
                            })),
                        },
                        leaders: data.users.map((p, i) => ({
                            userId: p.id,
                            name: p.name,
                            points: 28 - i * 3,
                        })),
                    }}
                />
            )
            break
        case "calendar":
            content = frame(
                <CalendarView
                    locale={locale}
                    serverId={SAMPLE_ID}
                    events={data.events}
                    rosters={[data.roster]}
                    groups={data.groups}
                    eventCategories={[]}
                    timezone="Europe/Prague"
                    dictionary={d}
                    signupLanguage={locale}
                    canAdmin={canManage}
                />
            )
            break
        case "match":
        case "training":
        case "signups":
        case "results":
            {
                const training = chapter === "training"
                const list = buildMatchListRows({
                    events: data.events.filter((e) =>
                        training ? e.kind === "training" : e.kind === "match"
                    ),
                    rosters: [data.roster],
                    categories: [],
                    canAdmin: canManage,
                    serverId,
                    locale,
                    timeZone: "Europe/Prague",
                    dictionary: d,
                    now: data.now,
                })
                content = (
                    <div data-tour-section={training ? "training" : undefined}>
                        <MatchListView
                            dictionary={d}
                            title={training ? s.training : d.matchList.title}
                            description={badge}
                            rows={list.rows}
                            drafts={list.drafts}
                            queue={list.queue}
                            games={[{ id: "wardogs", label: "Wardogs" }]}
                            kinds={training ? ["training"] : ["match"]}
                            canAdmin={canManage}
                            primaryAction={
                                canManage
                                    ? {
                                          href: `${root}/${training ? "trainings" : "matches"}/create`,
                                          label: training
                                              ? s.training
                                              : s.newMatch,
                                          icon: Plus,
                                      }
                                    : undefined
                            }
                            empty={{
                                icon: CalendarDays,
                                title: heading,
                                description: badge,
                            }}
                        />
                        {chapter === "signups" && (
                            <div
                                data-tour-section="signups"
                                className="px-4 lg:px-6"
                            >
                                {table(
                                    [s.players, s.squad, s.status],
                                    data.users.map((p, i) => [
                                        p.name,
                                        i % 2 ? "Bravo" : "Alpha",
                                        s.registered,
                                    ])
                                )}
                            </div>
                        )}
                        {chapter === "results" && (
                            <div
                                data-tour-section="results"
                                className="px-4 lg:px-6"
                            >
                                {table(
                                    [s.team, s.score, s.status],
                                    [
                                        ["NOVA", 100, s.confirmed],
                                        ["WOLF", 72, s.confirmed],
                                        ["RAVN", 58, s.confirmed],
                                    ]
                                )}
                            </div>
                        )}
                    </div>
                )
            }
            break
        case "roster":
        case "attendance":
            content = frame(
                <RosterBoard
                    roster={{
                        ...data.roster,
                        squads: data.roster.squads.map((squad) => ({
                            ...squad,
                            players: squad.players.map((p, i) => ({
                                ...p,
                                roleName: i === 0 ? s.leader : s.rifleman,
                            })),
                        })),
                    }}
                    event={data.upcoming}
                    users={data.users}
                    userAssignments={data.assignments}
                    groups={data.groups}
                    canAdmin={false}
                    dictionary={d}
                    serverId={SAMPLE_ID}
                    locale={locale}
                    defaultMode="view"
                />
            )
            break
        case "settings":
        case "mode":
        case "bot":
            content = (
                <>
                    {chapter === "bot" ? (
                        <div
                            data-tour-bot-setup=""
                            className="mx-4 space-y-3 rounded-xl border p-5 lg:mx-6"
                        >
                            <h2 className="font-semibold">
                                {s.inviteBot} · NOVA
                            </h2>
                            <p>{s.botPermissions}</p>
                            <Button>{s.inviteBot}</Button>
                        </div>
                    ) : null}
                    {chapter === "mode" ? (
                        <div
                            data-tour-workspace-mode=""
                            className="mx-4 space-y-4 rounded-xl border p-5 lg:mx-6"
                        >
                            <h2 className="font-semibold">{heading}</h2>
                            <div className="flex gap-3">
                                <Button
                                    variant={limited ? "outline" : "default"}
                                >
                                    {s.modeFull}
                                </Button>
                                <Button
                                    variant={limited ? "default" : "outline"}
                                >
                                    {s.modeLimited}
                                </Button>
                            </div>
                        </div>
                    ) : null}
                    <div data-tour-section="">
                        <SettingsOverview
                            locale={locale}
                            serverId={serverId}
                            dictionary={d}
                            snapshot={snapshot}
                            facts={{
                                botInside: true,
                                profile: {
                                    name: true,
                                    logo: true,
                                    description: true,
                                },
                                templateCount: 3,
                                collectingServers: 1,
                                failingServers: 0,
                                leagueEnabled: true,
                            }}
                        />
                    </div>
                </>
            )
            break
        case "account":
            content = frame(
                <UserSettingsForm
                    user={data.users[0]}
                    dictionary={d}
                    workspaces={[data.guild]}
                    locale={locale}
                    steamCallbackFailed={false}
                />
            )
            break
        case "competitions":
            content = frame(
                <ClanCompetitions
                    dictionary={d}
                    locale={locale}
                    serverId={SAMPLE_ID}
                    view={{
                        linkedPlayers: 4,
                        teams: [
                            {
                                id: "sample-nova",
                                name: "NOVA",
                                gameId: "wardogs",
                            },
                        ],
                        competitions: [
                            {
                                id: "sample-cup",
                                name: s.tournament,
                                season: s.season,
                                slug: "sample-cup",
                                gameId: "wardogs",
                                registrationMode: "approval",
                                minimumLinkedPlayers: 3,
                                registrations: [
                                    {
                                        teamId: "sample-nova",
                                        status: "approved",
                                        withdrawn: false,
                                    },
                                ],
                            },
                            {
                                id: "sample-open",
                                name: "Wardogs Open",
                                season: s.season,
                                slug: "sample-open",
                                gameId: "wardogs",
                                registrationMode: "automatic",
                                minimumLinkedPlayers: null,
                                registrations: [],
                            },
                        ],
                    }}
                />
            )
            break
        case "teams":
            content = frame(
                table(
                    [s.team, s.game, s.status],
                    ["NOVA", "WOLF", "RAVN"].map((name) => [
                        <span className="flex items-center gap-3" key={name}>
                            <TeamLogo
                                name={name}
                                shortCode={name}
                                logoUrl={null}
                            />
                            {name}
                        </span>,
                        "Wardogs",
                        s.active,
                    ])
                )
            )
            break
        case "membership":
            content = (
                <MembershipSettingsForm
                    serverId={SAMPLE_ID}
                    guildId={SAMPLE_ID}
                    config={{
                        ...config,
                        membershipSettings: {
                            enabled: true,
                            autoAssignRecruitOnApply: true,
                            submitChannelId: "sample-support",
                            categories: [
                                {
                                    id: "sample-membership",
                                    gameId: "wardogs",
                                    label: s.recruitment,
                                    supportRoleIds: ["sample-admin"],
                                    recruitRoleIds: ["sample-recruit"],
                                    finalRoleIds: ["sample-member"],
                                    modalQuestions: [],
                                    assignmentType: "member",
                                },
                            ],
                            panelTitle: "NOVA",
                            panelDescription: s.recruitment,
                        },
                    }}
                    dictionary={d}
                    rolesHref={`${root}/settings/roles`}
                    clanName="NOVA"
                    siteUrl="https://example.invalid"
                    now={data.now.getTime()}
                    locale={locale}
                />
            )
            break
        case "tickets":
            content = (
                <TicketSettingsForm
                    serverId={SAMPLE_ID}
                    dictionary={d}
                    config={{
                        ...config,
                        ticketSettings: {
                            enabled: true,
                            panelTitle: s.support,
                            panelDescription: "NOVA",
                            categories: [
                                {
                                    id: "sample-general",
                                    emoji: "",
                                    label: s.general,
                                    description: s.support,
                                    supportRoleIds: ["sample-admin"],
                                    modalQuestions: [],
                                },
                                {
                                    id: "sample-match-request",
                                    emoji: "",
                                    label: s.matchRequest,
                                    description: "NOVA",
                                    supportRoleIds: ["sample-admin"],
                                    modalQuestions: [],
                                },
                            ],
                        },
                    }}
                />
            )
            break
        case "commands":
            content = (
                <CommandsSettingsForm
                    serverId={SAMPLE_ID}
                    serverName="NOVA"
                    dictionary={d}
                    config={config}
                    enabledGames={["wardogs", "hell_let_loose"]}
                    registration={null}
                    now={data.now.getTime()}
                    hrefs={{
                        gameServers: `${root}/settings/game-servers`,
                        channels: `${root}/settings/channels`,
                        tickets: `${root}/settings/tickets`,
                        membership: `${root}/settings/membership`,
                    }}
                />
            )
            break
        case "presets":
            content = frame(
                <>
                    <PresetsOverview
                        locale={locale}
                        serverId={serverId}
                        squadPresetCount={3}
                        topicPresetCount={2}
                        dictionary={d}
                    />
                    {table(
                        [s.name, s.squad, s.players],
                        [
                            [s.infantry, "Alpha · Bravo", 12],
                            ["Wardogs", "Alpha · Bravo · Charlie", 18],
                        ]
                    )}
                </>
            )
            break
        case "articles":
            content = frame(
                <>
                    {[s.guide, s.rules, s.trainingPlan].map((name, i) => (
                        <Card key={name} className="rounded-2xl">
                            <CardHeader>
                                <CardTitle>{name}</CardTitle>
                                <p className="text-muted-foreground text-sm">
                                    {[s.members, s.fixtures, s.objectives][i]}
                                </p>
                            </CardHeader>
                            <CardContent className="text-muted-foreground flex gap-3 text-xs">
                                <time>
                                    {new Intl.DateTimeFormat(locale, {
                                        dateStyle: "medium",
                                    }).format(data.now)}
                                </time>
                                <span>#NOVA</span>
                                <span>{s.published}</span>
                            </CardContent>
                        </Card>
                    ))}
                </>,
                d.articles.title,
                canManage
                    ? create("/articles/create", d.articles.create)
                    : undefined
            )
            break
        case "maps":
            content = frame(
                table(
                    [s.name, s.map, s.game, s.status],
                    [
                        [s.tacticalPlan, "Bakurani", "Wardogs", s.published],
                        [
                            "Kharkov · Alpha",
                            "Kharkov",
                            "Hell Let Loose",
                            s.published,
                        ],
                    ]
                ),
                heading,
                create("/stratmaps/create", d.common.create)
            )
            break
        case "panels":
            content = frame(
                panel(
                    heading,
                    table(
                        [s.name, s.channel, s.status],
                        [
                            [s.server, "#server-status", s.published],
                            [s.results, "#results", s.published],
                            [s.calendar, "#announcements", s.published],
                            [s.standings, "#league", s.published],
                        ]
                    )
                )
            )
            break
        case "seeding":
            content = frame(
                <>
                    {panel(
                        "NOVA · Wardogs",
                        <>
                            <div className="flex items-center gap-3">
                                <Badge>{s.active}</Badge>
                                <span>24 / 100</span>
                            </div>
                            {toggle(s.seedPlan)}
                            <div className="grid gap-4 sm:grid-cols-2">
                                {field(s.playerThreshold, "30")}
                                {field(s.endThreshold, "60")}
                                {field(s.channel, "#announcements")}
                                {field(s.role, "@NOVA")}
                            </div>
                            {field(s.date, "18:00 – 20:00 · Europe/Prague")}
                        </>
                    )}
                </>
            )
            break
        case "servers":
            content = frame(
                <>
                    {panel(
                        "NOVA · Wardogs",
                        <>
                            <div className="flex flex-wrap gap-2">
                                <Badge>{s.connected}</Badge>
                                <Badge variant="secondary">Warcon</Badge>
                                <Badge variant="secondary">
                                    {s.autoResults}
                                </Badge>
                            </div>
                            {field(s.server, "https://warcon.example.invalid")}
                            {field(s.apiKey, "••••••••••••••••")}
                            {toggle(s.history)}
                            {field(s.retained, `30 ${s.days}`)}
                        </>
                    )}
                    {panel(
                        s.external,
                        <>
                            {field(s.server, "NOVA · Community server")}
                            {field(s.results, s.manualScore)}
                        </>
                    )}
                </>
            )
            break
        case "history":
            content = frame(
                <div id="game-history" className="space-y-4">
                    {panel(
                        s.history,
                        <>
                            {field(s.retained, `30 ${s.days}`)}
                            {table(
                                [s.date, s.map, s.team, s.score],
                                data.performance.slice(0, 4).map((p, i) => [
                                    new Intl.DateTimeFormat(locale, {
                                        dateStyle: "medium",
                                    }).format(new Date(p.playedAt)),
                                    "Bakurani",
                                    i % 2 ? "NOVA vs RAVN" : "NOVA vs WOLF",
                                    "100 : 72 : 58",
                                ])
                            )}
                        </>
                    )}
                </div>
            )
            break
        case "tracking":
            content = frame(
                <>
                    {panel(
                        "Wardogs League",
                        <>
                            {toggle(s.enabled)}
                            {field(s.team, "NOVA")}
                            {field(s.channel, "#league")}
                        </>
                    )}
                    {table(
                        [s.fixtures, s.date, s.status],
                        [
                            [
                                "NOVA vs WOLF vs RAVN",
                                new Intl.DateTimeFormat(locale, {
                                    dateStyle: "medium",
                                }).format(new Date(data.upcoming.gameStart)),
                                s.registered,
                            ],
                            [
                                "NOVA vs RAVN vs WOLF",
                                new Intl.DateTimeFormat(locale, {
                                    dateStyle: "medium",
                                }).format(data.now),
                                s.awaiting,
                            ],
                        ]
                    )}
                </>
            )
            break
        case "integrations":
            content = frame(
                <>
                    {panel(
                        s.apiKey,
                        <>
                            {field(s.name, "NOVA website")}
                            {field(s.apiKey, "logi_••••••••••••••••")}
                            {field(
                                s.permissions,
                                "clan:read · events:read · rosters:read"
                            )}
                        </>
                    )}
                    {panel(
                        s.webhook,
                        <>
                            {field(
                                "URL",
                                "https://nova.example.invalid/webhooks/logi"
                            )}
                            {field(
                                s.notification,
                                "event.updated · roster.published"
                            )}
                            {toggle(s.enabled)}
                        </>
                    )}
                    {panel(
                        s.signIn,
                        field("URL", "https://nova.example.invalid")
                    )}
                </>
            )
            break
    }
    return (
        <DiscordMetadataPreviewContext.Provider value={sampleMetadata}>
            <div data-tour-sample-page="" className="space-y-5">
                {content}
            </div>
        </DiscordMetadataPreviewContext.Provider>
    )
}
