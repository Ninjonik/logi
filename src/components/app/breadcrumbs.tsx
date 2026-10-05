"use client"

import {
    createContext,
    Fragment,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react"
import { usePathname, useParams } from "next/navigation"
import Link from "next/link"

import {
    buildDashboardBreadcrumbs,
    dashboardPageTrail,
    type DashboardCrumbLabels,
    type DashboardPageTrail,
} from "@/lib/navigation/dashboard-breadcrumbs"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { SETTINGS_SECTIONS } from "@/domain/workspaces/settings-sections"
import type { Dictionary } from "@/i18n/dictionaries"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"

type PageCrumbState = { pathname: string; label: string } | null

const PageCrumbContext = createContext<{
    value: PageCrumbState
    set: (value: PageCrumbState) => void
} | null>(null)

/** Holds the name a page gives itself for the trail (see `PageCrumb`). */
export function PageCrumbProvider({ children }: { children: ReactNode }) {
    const [value, set] = useState<PageCrumbState>(null)
    const context = useMemo(() => ({ value, set }), [value])
    return (
        <PageCrumbContext.Provider value={context}>
            {children}
        </PageCrumbContext.Provider>
    )
}

/**
 * Names the current record in the trail and the phone title bar, such as
 * "VLK vs ROG · Friendly" instead of "Match" (design D3). Render it anywhere
 * on the page; it shows nothing itself.
 */
export function PageCrumb({ label }: { label: string }) {
    const context = useContext(PageCrumbContext)
    const pathname = usePathname() ?? ""
    const set = context?.set
    useEffect(() => {
        if (!set) return
        set({ pathname, label })
        return () => set(null)
    }, [set, pathname, label])
    return null
}

/** The current page's trail: section, record and the way back. */
export function useDashboardPageTrail({
    dictionary,
    locale,
    servers,
}: {
    dictionary: Dictionary
    locale: Locale
    servers: Guild[]
}): DashboardPageTrail & { server?: Guild } {
    const pathname = usePathname() ?? ""
    const params = useParams()
    const named = useContext(PageCrumbContext)?.value
    const serverId =
        typeof params.serverId === "string" ? params.serverId : undefined
    const server = servers.find((item) => item.id === serverId)
    const labels = useMemo(() => crumbLabels(dictionary), [dictionary])
    return useMemo(() => {
        const crumbs = buildDashboardBreadcrumbs({
            locale,
            pathname,
            serverId,
            serverName: server?.name,
            labels,
        }).map((crumb) =>
            crumb.isLast && named?.pathname === pathname
                ? { ...crumb, label: named.label }
                : crumb
        )
        return {
            ...dashboardPageTrail(crumbs, {
                inWorkspace: pathname.includes("/dashboard/servers/"),
            }),
            server,
        }
    }, [labels, locale, named, pathname, server, serverId])
}

/**
 * The trail above a page below the top level, such as "Settings › Discord ›
 * Channels and language" (design A2). Section pages have none. On phones the
 * title bar's back button takes its place.
 */
export function AppBreadcrumbs({
    dictionary,
    locale,
    servers,
    className,
}: {
    dictionary: Dictionary
    locale: Locale
    servers: Guild[]
    className?: string
}) {
    const { crumbs } = useDashboardPageTrail({ dictionary, locale, servers })
    if (crumbs.length === 0) return null

    return (
        <Breadcrumb className={cn("px-4 lg:px-6", className)}>
            <BreadcrumbList className="gap-1.5 text-sm sm:gap-2 [&_[data-slot=breadcrumb-separator]>svg]:size-3.5">
                {crumbs.map((item, index) => (
                    <Fragment key={`${index}-${item.href}`}>
                        {index > 0 ? <BreadcrumbSeparator /> : null}
                        <BreadcrumbItem>
                            {item.isLast ? (
                                <BreadcrumbPage className="max-w-[min(32rem,60vw)] truncate">
                                    {item.label}
                                </BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink asChild>
                                    <Link href={item.href}>{item.label}</Link>
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    )
}

/** Translated labels for every dashboard route segment and record kind. */
function crumbLabels(dictionary: Dictionary): DashboardCrumbLabels {
    const sidebar = dictionary.sidebar
    const crumbs = sidebar.crumbs
    const settingsHub = dictionary.settingsHub
    return {
        workspace: sidebar.workspace,
        segments: {
            calendar: sidebar.calendar,
            articles: sidebar.articles,
            events: sidebar.events,
            matches: sidebar.matches,
            trainings: sidebar.trainings,
            rosters: sidebar.rosters,
            groups: sidebar.groups,
            "topic-presets": sidebar.topicPresets,
            "squad-presets": sidebar.squadPresets,
            stratmaps: sidebar.stratmaps,
            users: sidebar.members,
            members: sidebar.members,
            memberships: sidebar.memberships,
            tickets: sidebar.tickets,
            teams: sidebar.teams,
            settings: sidebar.settings,
            "signup-activity": sidebar.signupActivity,
            system: sidebar.system,
            "helper-data": dictionary.clan.helperDataTitle,
            imports: dictionary.clan.importsTitle,
            webhooks: dictionary.clan.webhooksTitle,
            recurring: dictionary.event.recurringMatches,
            match: crumbs.matchResult,
            "match-stats": crumbs.matchStatistics,
            create: dictionary.common.create,
        },
        globalSegments: {
            competitions: sidebar.competitions,
            teams: sidebar.teamCatalog,
            "team-requests": sidebar.teamRequests,
            bot: sidebar.bot,
            "platform-settings": sidebar.platformSettings,
            logicomms: sidebar.logiComms,
            user: sidebar.myAccount,
        },
        settingsSections: Object.fromEntries(
            Object.entries(settingsHub.sections).map(([section, value]) => [
                section,
                value.title,
            ])
        ),
        settingsGroups: Object.fromEntries(
            SETTINGS_SECTIONS.map((section) => [
                section.id,
                {
                    label: settingsHub.groups[section.group],
                    anchor: `settings-group-${section.group}`,
                },
            ])
        ),
        records: {
            events: crumbs.event,
            matches: crumbs.event,
            trainings: crumbs.training,
            rosters: dictionary.roster.title,
            groups: crumbs.group,
            articles: crumbs.article,
            stratmaps: crumbs.stratmap,
            users: crumbs.player,
            "squad-presets": dictionary.presets.squadPresetMetaFallback,
            "topic-presets": dictionary.presets.topicPresetMetaFallback,
            competitions: crumbs.competition,
        },
        detail: crumbs.detail,
    }
}
