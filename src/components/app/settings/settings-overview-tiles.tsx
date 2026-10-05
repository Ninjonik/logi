"use client"

import {
    ArrowRight,
    Check,
    History,
    KeyRound,
    Lock,
    LogIn,
    Search,
    SearchX,
    TriangleAlert,
    type LucideIcon,
} from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import Link from "next/link"

import { SETTINGS_SECTION_ICONS } from "@/components/app/settings/settings-section-meta"
import type { SettingsSectionId } from "@/domain/workspaces/settings-sections"
import { EmptyState } from "@/components/app/empty-state"
import { cn } from "@/lib/utils"

/** Tiles that open a part of a page rather than a page of their own. */
const EXTRA_ICONS = {
    history: History,
    apiKeys: KeyRound,
    login: LogIn,
    webAccess: Lock,
} satisfies Record<string, LucideIcon>
export type SettingsTileIcon = SettingsSectionId | keyof typeof EXTRA_ICONS

export type SettingsTile = {
    key: string
    icon: SettingsTileIcon
    href: string
    title: string
    description: string
    badge: { tone: "ready" | "attention" | "neutral"; label: string } | null
    /** A page without a state shows an arrow instead (design A1). */
    arrow?: boolean
    /** Extra words the search matches, such as the fields on the page. */
    keywords?: string
}
export type SettingsTileGroup = {
    id: string
    title: string
    hint: string
    /** The maintenance tools are wider, two to a row. */
    wide?: boolean
    tiles: SettingsTile[]
}

const badgeTones = {
    ready: "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200",
    attention:
        "border-amber-500/40 bg-amber-500/10 text-amber-800 dark:text-amber-200",
    neutral: "border-border bg-background text-muted-foreground",
} as const

function iconFor(icon: SettingsTileIcon): LucideIcon {
    return icon in EXTRA_ICONS
        ? EXTRA_ICONS[icon as keyof typeof EXTRA_ICONS]
        : SETTINGS_SECTION_ICONS[icon as SettingsSectionId]
}

function normalize(value: string) {
    return value
        .normalize("NFD")
        .replace(/\p{Diacritic}/gu, "")
        .toLowerCase()
}

function TileBadge({ badge }: { badge: NonNullable<SettingsTile["badge"]> }) {
    const Icon =
        badge.tone === "ready"
            ? Check
            : badge.tone === "attention"
              ? TriangleAlert
              : null
    return (
        <span
            className={cn(
                "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border px-2 text-xs font-medium",
                badgeTones[badge.tone]
            )}
        >
            {Icon ? <Icon className="size-3.5" aria-hidden="true" /> : null}
            {badge.label}
        </span>
    )
}

/**
 * The searchable part of the settings overview (design A1): the header with
 * the search field, the setup checklist and every settings tile by group.
 */
export function SettingsOverviewTiles({
    heading,
    setup,
    groups,
    labels,
}: {
    heading: ReactNode
    setup: ReactNode
    groups: SettingsTileGroup[]
    labels: {
        search: string
        searchPlaceholder: string
        noResults: string
        noResultsDescription: string
    }
}) {
    const [query, setQuery] = useState("")
    const needle = normalize(query.trim())
    const shown = useMemo(
        () =>
            groups
                .map((group) => ({
                    ...group,
                    tiles: needle
                        ? group.tiles.filter((tile) =>
                              normalize(
                                  `${tile.title} ${tile.description} ${tile.keywords ?? ""} ${group.title}`
                              ).includes(needle)
                          )
                        : group.tiles,
                }))
                .filter((group) => group.tiles.length > 0),
        [groups, needle]
    )

    return (
        <div className="space-y-8">
            <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                {heading}
                <label className="border-input bg-background focus-within:border-ring focus-within:ring-ring/50 flex h-10 w-full items-center gap-2 rounded-lg border px-3 focus-within:ring-[3px] lg:w-80">
                    <Search
                        className="text-muted-foreground size-4 shrink-0"
                        aria-hidden="true"
                    />
                    <input
                        type="search"
                        value={query}
                        onChange={(event) => setQuery(event.target.value)}
                        aria-label={labels.search}
                        placeholder={labels.searchPlaceholder}
                        className="placeholder:text-muted-foreground min-w-0 flex-1 bg-transparent text-sm outline-none"
                    />
                </label>
            </header>
            {needle ? null : setup}
            {shown.map((group) => (
                <section
                    key={group.id}
                    aria-labelledby={`settings-group-${group.id}`}
                    className="space-y-3"
                >
                    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:gap-2.5">
                        <h2
                            id={`settings-group-${group.id}`}
                            className="text-base font-semibold"
                        >
                            {group.title}
                        </h2>
                        <span className="text-muted-foreground text-[13px]">
                            {group.hint}
                        </span>
                    </div>
                    <ul
                        className={cn(
                            "grid gap-3",
                            group.wide
                                ? "sm:grid-cols-2"
                                : "sm:grid-cols-2 xl:grid-cols-3"
                        )}
                    >
                        {group.tiles.map((tile) => {
                            const Icon = iconFor(tile.icon)
                            return (
                                <li key={tile.key}>
                                    <Link
                                        href={tile.href}
                                        className={cn(
                                            "bg-card hover:bg-accent/40 focus-visible:ring-ring/50 flex h-full gap-3 rounded-xl border p-4 transition-colors focus-visible:ring-[3px] focus-visible:outline-none",
                                            tile.badge?.tone === "attention"
                                                ? "border-amber-400/70 dark:border-amber-500/50"
                                                : "border-border hover:border-foreground/20"
                                        )}
                                    >
                                        <span className="bg-background flex size-9 shrink-0 items-center justify-center rounded-lg border">
                                            <Icon
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        </span>
                                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                                            <span className="flex items-start justify-between gap-2">
                                                <span className="pt-0.5 font-semibold">
                                                    {tile.title}
                                                </span>
                                                {tile.badge ? (
                                                    <TileBadge
                                                        badge={tile.badge}
                                                    />
                                                ) : tile.arrow ? (
                                                    <ArrowRight
                                                        className="text-muted-foreground mt-1 size-4 shrink-0"
                                                        aria-hidden="true"
                                                    />
                                                ) : null}
                                            </span>
                                            <span className="text-muted-foreground text-[13px] leading-5">
                                                {tile.description}
                                            </span>
                                        </span>
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </section>
            ))}
            {needle && !shown.length ? (
                <EmptyState
                    icon={SearchX}
                    title={labels.noResults}
                    description={labels.noResultsDescription}
                />
            ) : null}
        </div>
    )
}
