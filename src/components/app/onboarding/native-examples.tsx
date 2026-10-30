"use client"
import {
    NewMatchFlow,
    type NewMatchFlowProps,
} from "@/components/app/new-match/new-match-flow"
import {
    PlayersTable,
    type PlayerTableRow,
} from "@/components/app/players-table"
import { PerformanceHistoryChart } from "@/components/app/performance-history-chart"
import { PlayerTrendIndicators } from "@/components/app/player-trend-indicators"
import { newFlowValues } from "@/components/app/new-match/flow-values"
import { TablePageLayout } from "@/components/app/table-page-layout"
import { getWalkthroughCopy } from "@/i18n/messages/walkthrough"
import { examplePlayers, examplePerformance } from "./demo-data"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { PageHeader } from "@/components/app/page-header"
import { useWalkthrough } from "./walkthrough-context"
import { getStratmapMaps } from "@/lib/game-stratmaps"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import type { Group } from "@/types/domain"
import type { Locale } from "@/i18n/config"
import { useMemo } from "react"

export function DemoPlayers({
    dictionary: d,
    locale,
    serverId,
}: {
    dictionary: Dictionary
    locale: Locale
    serverId: string
}) {
    const root = `/${locale}/dashboard/servers/${serverId}`
    const rows: PlayerTableRow[] = examplePlayers.map((p, i) => ({
        id: `sample-${i}`,
        gameId: "hell_let_loose",
        name: p.name,
        avatar: "",
        discordId: `example-${p.name.toLowerCase()}`,
        platformIds: [],
        type: d.userManagement.memberLabel,
        group: p.group,
        score: `${20 + i * 3} • ${d.userManagement.matchKd} ${(p.kills / p.deaths).toLocaleString(locale, { maximumFractionDigits: 2 })}`,
        status: d.userManagement.memberLabel,
        active: true,
        matches: examplePerformance.map((match, j) => ({
            ...match,
            kills: match.kills + i * 2,
            kd: match.kd + (i % 2 ? -0.1 : 0.1),
            offense: match.offense + (i % 2 ? -j * 25 : j * 15),
        })),
        href: `${root}/users/onboarding-example`,
    }))
    return (
        <TablePageLayout
            header={
                <PageHeader
                    title={d.userManagement.title}
                    description={d.userManagement.description}
                    badge={getWalkthroughCopy(locale).example}
                    actions={<Button>{d.userManagement.addPlayer}</Button>}
                />
            }
        >
            <div data-tour-players="">
                <PlayersTable
                    rows={rows}
                    dictionary={d}
                    locale={locale}
                    page={1}
                    pageSize={20}
                    pageCount={1}
                    totalRows={rows.length}
                    search=""
                    showGame
                />
            </div>
        </TablePageLayout>
    )
}
export function DemoPlayerProfile({
    dictionary: d,
    locale,
}: {
    dictionary: Dictionary
    locale: Locale
}) {
    return (
        <div className="space-y-6">
            <PageHeader
                title="Atlas"
                badge={getWalkthroughCopy(locale).example}
            />
            <div className="space-y-6 px-4 lg:px-6">
                <div className="flex items-center gap-4 rounded-xl border p-5">
                    <Avatar className="size-16">
                        <AvatarFallback>At</AvatarFallback>
                    </Avatar>
                    <div>
                        <p className="text-lg font-semibold">Atlas</p>
                        <p className="text-muted-foreground text-sm">
                            NOVA · Alpha · Hell Let Loose
                        </p>
                        <PlayerTrendIndicators
                            matches={examplePerformance}
                            dictionary={d}
                            locale={locale}
                        />
                    </div>
                </div>
                <div
                    data-tour-player-trends=""
                    className="grid gap-5 lg:grid-cols-2"
                >
                    <PerformanceHistoryChart
                        title={d.clan.playerPerformanceTrend}
                        matches={examplePerformance}
                        dictionary={d}
                        locale={locale}
                        kind="kd"
                        gameId="hell_let_loose"
                    />
                    <PerformanceHistoryChart
                        title={d.clan.combatEffectiveness}
                        matches={examplePerformance}
                        dictionary={d}
                        locale={locale}
                        kind="playerEffectiveness"
                        gameId="hell_let_loose"
                    />
                </div>
            </div>
        </div>
    )
}

const channels = {
    wardogs: {
        announcementChannelId: "example-signups",
        eventInfoChannelId: "example-events",
        eventResultsChannelId: "example-results",
    },
}
const groups: Group[] = ["Alpha", "Bravo"].map((name, i) => ({
    id: `sample-${name}`,
    guildId: "sample",
    gameId: "wardogs",
    name,
    color: i ? "#3b82f6" : "#f59e0b",
    order: i,
    createdAt: "2026-10-30T00:00:00Z",
    updatedAt: "2026-10-30T00:00:00Z",
}))
export function DemoNewMatch({
    dictionary: d,
    locale,
    serverId,
}: {
    dictionary: Dictionary
    locale: Locale
    serverId: string
}) {
    const runtime = useWalkthrough()
    const now = useMemo(
        () => new Date(runtime.exampleNow),
        [runtime.exampleNow]
    )
    const date = new Date(now.getTime() + 3 * 86400000)
        .toISOString()
        .slice(0, 10)
    const phase = runtime.step?.watch ? runtime.phase : 6
    const values = newFlowValues({
        kind: "match",
        gameId: "wardogs",
        timezone: "Europe/Prague",
        groups,
        templates: [],
        channelDefaults: channels,
        now,
    })
    Object.assign(values, {
        date,
        time: "20:00",
        meetingMinutes: 30,
        registrationHours: 2,
        announcementHours: null,
        ownSide: "Valkyra",
        opponentSide: "Manticore",
        extraSide: "Lonestar",
        nameTouched: true,
        name:
            phase > 0
                ? "NOVA vs WOLF vs RAVN".slice(0, Math.floor(phase * 24))
                : "",
        opponent:
            phase >= 1
                ? {
                      teamId: "sample-wolf",
                      name: "WOLF",
                      shortCode: "WOLF",
                      logoUrl: null,
                  }
                : null,
        extraTeam:
            phase >= 2
                ? {
                      teamId: "sample-ravn",
                      name: "RAVN",
                      shortCode: "RAVN",
                      logoUrl: null,
                  }
                : null,
        mapId:
            phase >= 3
                ? (getStratmapMaps("wardogs").find((map) =>
                      map.name.toLowerCase().includes("bakurani")
                  )?.id ??
                  getStratmapMaps("wardogs")[0]?.id ??
                  "")
                : "",
        timeOfDay: "day",
        signupGroupIds: groups.map((g) => g.id),
        signupGroupLimits: groups.map((g) => ({ groupId: g.id, max: 6 })),
        createForumChannel: true,
        createSquadVoiceChannels: true,
        createParticipantRoles: true,
    })
    const props: NewMatchFlowProps = {
        serverId,
        locale,
        dictionary: d,
        previewCopy: d.newMatch.preview,
        botLanguage: locale,
        initialKind: "match",
        initialGameId: "wardogs",
        enabledGames: ["wardogs"],
        gameCatalogue: [
            {
                id: "wardogs",
                name: "Wardogs",
                capabilities: { maps: true, stratmaps: true },
                eventSelection: {
                    primaryLabel: "",
                    primaryOptions: [],
                    targetOptional: true,
                },
            },
        ],
        templates: [],
        groups,
        squadPresets: [],
        eventCategories: [],
        topicPresets: [],
        stratmaps: [],
        timezone: "Europe/Prague",
        clan: { name: "NOVA" },
        linkedTeams: [
            {
                id: "sample-nova",
                gameId: "wardogs",
                name: "NOVA",
                shortCode: "NOVA",
                logoUrl: null,
                description: null,
                links: [],
                revision: 1,
                updatedAt: "2026-10-30T00:00:00Z",
            },
        ],
        channelDefaults: channels,
        forumCategoryConfigured: true,
        draft: null,
        demo: {
            values,
            step: runtime.step?.formStep ?? "match",
            onContinue: runtime.next,
            onPublish: runtime.next,
            metadata: {
                roles: [{ id: "example-clan", name: "NOVA" }],
                channels: [
                    { id: "example-signups", name: "match-signups", type: 0 },
                    { id: "example-events", name: "events", type: 0 },
                    { id: "example-results", name: "results", type: 0 },
                    { id: "example-meeting", name: "meeting", type: 2 },
                ],
            },
        },
    }
    return (
        <div data-tour-match="">
            <NewMatchFlow {...props} />
        </div>
    )
}
