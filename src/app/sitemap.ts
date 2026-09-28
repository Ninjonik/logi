import type { MetadataRoute } from "next"

import {
    listPublicClans,
    listPublicMatches,
} from "@/lib/read-models/public-profiles"
import { getPublicUrl, getLocalizedAlternates } from "@/lib/seo"
import { GAME_IDS } from "@/domain/games/game"
import { locales } from "@/i18n/config"

const localizedRoutes = [
    { path: "", changeFrequency: "weekly", priority: 1 },
    { path: "/community", changeFrequency: "daily", priority: 0.9 },
    { path: "/competitions", changeFrequency: "daily", priority: 0.8 },
    { path: "/competitions/ecl-2026", changeFrequency: "daily", priority: 0.8 },
    { path: "/privacy-policy", changeFrequency: "yearly", priority: 0.3 },
    { path: "/tos", changeFrequency: "yearly", priority: 0.3 },
    { path: "/gdpr", changeFrequency: "yearly", priority: 0.3 },
] as const

const wikiRoutes = [
    "",
    "/getting-started",
    "/concepts",
    "/administration",
    "/discord-bot-setup",
    "/dashboard",
    "/dashboard/calendar-and-articles",
    "/dashboard/my-account",
    "/configuration/members",
    "/configuration/presets-and-templates",
    "/configuration/settings",
    "/configuration/single-sign-on",
    "/configuration/tickets",
    "/operations/briefings-and-stratmaps",
    "/operations/events",
    "/operations/matches",
    "/operations/rosters",
    "/operations/trainings",
    "/public",
    "/public/community",
    "/public/matches-and-competitions",
]

type PublicDiscoveryEntry = {
    path: string
    lastModified?: string
    changeFrequency: "weekly"
    priority: number
}

async function collectPublicPages<T>(
    getPage: (cursor: string | null) => Promise<{
        page: T[]
        continueCursor: string
        isDone: boolean
    }>
) {
    const items: T[] = []
    let cursor: string | null = null

    do {
        const result = await getPage(cursor)
        items.push(...result.page)
        cursor = result.isDone ? null : result.continueCursor
    } while (cursor)

    return items
}

async function getPublicDiscoveryEntries(): Promise<PublicDiscoveryEntry[]> {
    const entries = await Promise.all(
        GAME_IDS.map(async (game) => {
            const [clans, matches] = await Promise.all([
                collectPublicPages((cursor) => listPublicClans(cursor, game)),
                collectPublicPages((cursor) =>
                    listPublicMatches(cursor, 100, [], game)
                ),
            ])
            return [
                ...clans.map((clan) => ({
                    path: `/clans/${clan.id}`,
                    changeFrequency: "weekly" as const,
                    priority: 0.7,
                })),
                ...matches.map((match) => ({
                    path: `/matches/${match.eventId}`,
                    lastModified: match.gameEnd,
                    changeFrequency: "weekly" as const,
                    priority: 0.7,
                })),
            ]
        })
    )

    return entries.flat()
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    const localizedEntries = localizedRoutes.flatMap((route) =>
        locales.map((locale) => ({
            url: getPublicUrl(`/${locale}${route.path}`),
            changeFrequency: route.changeFrequency,
            priority: route.priority,
            alternates: getLocalizedAlternates(route.path),
        }))
    )

    // Crawlers must always receive the stable public routes, even if the
    // separately deployed Convex read service is temporarily unavailable.
    const publicDiscoveryEntries = await getPublicDiscoveryEntries().catch(
        () => []
    )
    const dynamicEntries = publicDiscoveryEntries.flatMap((entry) =>
        locales.map((locale) => ({
            url: getPublicUrl(`/${locale}${entry.path}`),
            lastModified: entry.lastModified,
            changeFrequency: entry.changeFrequency,
            priority: entry.priority,
            alternates: getLocalizedAlternates(entry.path),
        }))
    )

    return [
        ...localizedEntries,
        ...dynamicEntries,
        ...wikiRoutes.map((path) => ({
            url: getPublicUrl(`/wiki${path}`),
            changeFrequency: "monthly" as const,
            priority: path === "" ? 0.8 : 0.6,
        })),
    ]
}
