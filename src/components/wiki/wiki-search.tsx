"use client"

import { useMemo, useState } from "react"
import { Search } from "lucide-react"
import Link from "next/link"

const pages = [
    ["Welcome", "/wiki", "start sign in workspace search"],
    [
        "Getting started",
        "/wiki/getting-started",
        "login Discord access permissions workspace",
    ],
    [
        "Key concepts",
        "/wiki/concepts",
        "event match training roster groups status",
    ],
    ["Public site overview", "/wiki/public", "visitor player public browse"],
    [
        "Community, clans, and players",
        "/wiki/public/community",
        "directory profile clan community player",
    ],
    [
        "Matches and competitions",
        "/wiki/public/matches-and-competitions",
        "fixture result public competition",
    ],
    [
        "Dashboard overview",
        "/wiki/dashboard",
        "workspace sidebar manager access",
    ],
    [
        "Calendar and articles",
        "/wiki/dashboard/calendar-and-articles",
        "schedule announcement guide article",
    ],
    [
        "Your account",
        "/wiki/dashboard/my-account",
        "privacy export Discord platform ID",
    ],
    [
        "Events",
        "/wiki/operations/events",
        "create schedule sign-up attendance conclude map",
    ],
    [
        "Matches",
        "/wiki/operations/matches",
        "competitive result opponent fixture briefing",
    ],
    [
        "Trainings",
        "/wiki/operations/trainings",
        "practice session complete start end",
    ],
    [
        "Rosters",
        "/wiki/operations/rosters",
        "squad reserve publish attendance assignment",
    ],
    [
        "Briefings and stratmaps",
        "/wiki/operations/briefings-and-stratmaps",
        "topic preset tactical map strategy",
    ],
    [
        "Members and groups",
        "/wiki/configuration/members",
        "Discord import merge assignment membership group",
    ],
    [
        "Presets and templates",
        "/wiki/configuration/presets-and-templates",
        "squad topic preset roster template",
    ],
    [
        "Server settings",
        "/wiki/configuration/settings",
        "API key Discord configuration",
    ],
    [
        "Tickets",
        "/wiki/configuration/tickets",
        "support membership ticket channel permissions",
    ],
    [
        "Set up the Discord bot",
        "/wiki/discord-bot-setup",
        "install token Convex permissions channel role sign-up forum tickets",
    ],
    [
        "Administrator reference",
        "/wiki/administration",
        "superadmin bot log competitions LogiComms",
    ],
] as const

export function WikiSearch() {
    const [query, setQuery] = useState("")
    const normalizedQuery = query.trim().toLowerCase()
    const results = useMemo(() => {
        if (!normalizedQuery) return []

        return pages
            .filter(([title, , keywords]) =>
                `${title} ${keywords}`.toLowerCase().includes(normalizedQuery)
            )
            .slice(0, 7)
    }, [normalizedQuery])

    return (
        <div className="relative w-full max-w-sm">
            <label className="sr-only" htmlFor="wiki-search">
                Search the Logi Wiki
            </label>
            <Search
                aria-hidden="true"
                className="pointer-events-none absolute top-2.5 left-3 size-4 text-gray-500"
            />
            <input
                id="wiki-search"
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search the wiki"
                className="w-full rounded-md border border-gray-300 bg-white py-2 pr-3 pl-9 text-sm text-gray-900 shadow-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100 dark:focus:border-blue-400 dark:focus:ring-blue-900"
            />
            {normalizedQuery && (
                <div className="absolute top-full right-0 left-0 z-50 mt-1 overflow-hidden rounded-md border border-gray-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                    {results.length ? (
                        results.map(([title, href, keywords]) => (
                            <Link
                                key={href}
                                href={href}
                                onClick={() => setQuery("")}
                                className="block border-b border-gray-100 px-3 py-2 text-sm last:border-b-0 hover:bg-gray-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
                            >
                                <span className="block font-medium">
                                    {title}
                                </span>
                                <span className="block truncate text-xs text-gray-500 dark:text-neutral-400">
                                    {keywords}
                                </span>
                            </Link>
                        ))
                    ) : (
                        <p className="px-3 py-2 text-sm text-gray-500 dark:text-neutral-400">
                            No wiki pages match that search.
                        </p>
                    )}
                </div>
            )}
        </div>
    )
}
