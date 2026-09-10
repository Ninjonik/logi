import { notFound } from "next/navigation"
import type { Metadata } from "next"
import Link from "next/link"

import {
    PublicPage,
    PublicSiteShell,
} from "@/components/public/public-site-shell"
import { PerformanceHistoryChart } from "@/components/app/performance-history-chart"
import { PlayerTrendIndicators } from "@/components/app/player-trend-indicators"
import type { PerformanceSnapshot } from "@/lib/read-models/performance-history"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PublicBreadcrumbs } from "@/components/public/public-breadcrumbs"
import { getPublicPlayerProfile } from "@/lib/read-models/public-profiles"
import { PublicStat } from "@/components/public/public-stat"
import { getDictionary } from "@/i18n/dictionaries"
import { isLocale } from "@/i18n/config"

type Props = {
    params: Promise<{ locale: string; playerId: string; eventId: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { playerId, eventId } = await params
    const image = `/api/og/player-match/${playerId}/${eventId}`
    return {
        openGraph: { images: [image] },
        twitter: { card: "summary_large_image", images: [image] },
    }
}

export default async function PublicPlayerMatchPage({ params }: Props) {
    const { locale, playerId, eventId } = await params
    const resolvedLocale = isLocale(locale) ? locale : "en"
    const dictionary = getDictionary(resolvedLocale)
    const player = await getPublicPlayerProfile(playerId)
    const matchIndex = player?.recentMatches.findIndex(
        (item) => item.eventId === eventId
    )
    const match =
        matchIndex === undefined || matchIndex < 0
            ? undefined
            : player?.recentMatches[matchIndex]
    if (!player || !match) notFound()
    const previousMatches = player.recentMatches
        .slice((matchIndex ?? -1) + 1, (matchIndex ?? -1) + 11)
        .filter((item) => item.eventId !== eventId)
    const average = (metric: "kills" | "deaths" | "killDeathRatio") =>
        previousMatches.length
            ? previousMatches.reduce((sum, item) => sum + item[metric], 0) /
              previousMatches.length
            : null
    const trendMatches: PerformanceSnapshot[] = player.recentMatches
        .slice(matchIndex ?? 0, (matchIndex ?? 0) + 11)
        .map((item) => ({
            eventId: item.eventId,
            playedAt: item.endedAt,
            label: item.name,
            combat: Math.round(item.offense + item.defense),
            offense: Math.round(item.offense + item.defense),
            support: Math.round(item.support),
            kills: item.kills,
            deaths: item.deaths,
            points: 0,
            kd: item.killDeathRatio,
        }))

    return (
        <PublicSiteShell locale={resolvedLocale}>
            <PublicPage>
                <div className="space-y-6">
                    <PublicBreadcrumbs
                        items={[
                            {
                                label: dictionary.app.name,
                                href: `/${resolvedLocale}`,
                            },
                            {
                                label: dictionary.publicProfiles.communityTitle,
                                href: `/${resolvedLocale}/community`,
                            },
                            {
                                label: player.name,
                                href: `/${resolvedLocale}/players/${player.id}`,
                            },
                            { label: match.name },
                        ]}
                    />
                    <Card className="border-border/60 rounded-2xl">
                        <CardHeader>
                            <CardTitle>{match.name}</CardTitle>
                            <p className="text-muted-foreground text-sm">
                                {player.name} ·{" "}
                                {match.mapName ?? dictionary.shared.notSet}
                            </p>
                        </CardHeader>
                        <CardContent className="grid grid-cols-3 gap-5 text-center">
                            <PublicStat
                                label={dictionary.publicProfiles.kills}
                                value={String(match.kills)}
                            />
                            <PublicStat
                                label={dictionary.publicProfiles.deaths}
                                value={String(match.deaths)}
                            />
                            <PublicStat
                                label={dictionary.publicProfiles.kd}
                                value={match.killDeathRatio.toFixed(2)}
                            />
                        </CardContent>
                    </Card>
                    {previousMatches.length ? (
                        <>
                            <Card className="border-border/60 rounded-2xl">
                                <CardHeader className="flex flex-row items-center justify-between gap-4">
                                    <CardTitle>
                                        {dictionary.userManagement.averageDescription.replace(
                                            "{count}",
                                            String(previousMatches.length)
                                        )}
                                    </CardTitle>
                                    <PlayerTrendIndicators
                                        matches={trendMatches}
                                        dictionary={dictionary}
                                    />
                                </CardHeader>
                                <CardContent className="grid grid-cols-3 gap-5 text-center">
                                    <PublicStat
                                        label={
                                            dictionary.userManagement
                                                .averageKills
                                        }
                                        value={average("kills")!.toFixed(1)}
                                    />
                                    <PublicStat
                                        label={
                                            dictionary.userManagement
                                                .averageDeaths
                                        }
                                        value={average("deaths")!.toFixed(1)}
                                    />
                                    <PublicStat
                                        label={
                                            dictionary.userManagement.averageKd
                                        }
                                        value={average(
                                            "killDeathRatio"
                                        )!.toFixed(2)}
                                    />
                                </CardContent>
                            </Card>
                            <div className="grid gap-6 xl:grid-cols-2">
                                <PerformanceHistoryChart
                                    title={
                                        dictionary.clan.playerPerformanceTrend
                                    }
                                    matches={trendMatches}
                                    dictionary={dictionary}
                                    kind="playerEffectiveness"
                                />
                                <PerformanceHistoryChart
                                    title={dictionary.clan.kd}
                                    matches={trendMatches}
                                    dictionary={dictionary}
                                    kind="combat"
                                />
                            </div>
                        </>
                    ) : null}
                    <Link
                        href={`/${resolvedLocale}/matches/${eventId}`}
                        className="text-primary text-sm underline"
                    >
                        {dictionary.event.openMatch}
                    </Link>
                </div>
            </PublicPage>
        </PublicSiteShell>
    )
}
