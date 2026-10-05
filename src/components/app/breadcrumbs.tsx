"use client"

import { Fragment, useEffect, useMemo, useState } from "react"
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

/** The page's own heading: PageHeader's title, else the first `h1`. */
const PAGE_HEADING =
    '[data-page-title], [data-slot="sidebar-inset"] h1, main h1'

/**
 * The current page's heading, so the trail and the phone title bar can name
 * a record ("VLK vs ROG · Friendly" rather than "Match", design D3). Pages
 * may stream their heading in after the frame, so it is watched for a while
 * after every navigation.
 */
function usePageHeading(pathname: string) {
    const [heading, setHeading] = useState<{ path: string; text: string }>()
    useEffect(() => {
        const read = () => {
            const text = document
                .querySelector(PAGE_HEADING)
                ?.textContent?.replace(/\s+/g, " ")
                .trim()
            if (text) setHeading({ path: pathname, text })
            return Boolean(text)
        }
        if (read()) return
        const observer = new MutationObserver(() => {
            if (read()) observer.disconnect()
        })
        observer.observe(document.body, { childList: true, subtree: true })
        const stop = window.setTimeout(() => observer.disconnect(), 10_000)
        return () => {
            observer.disconnect()
            window.clearTimeout(stop)
        }
    }, [pathname])
    return heading?.path === pathname ? heading.text : undefined
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
    const heading = usePageHeading(pathname)
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
            crumb.isLast && heading ? { ...crumb, label: heading } : crumb
        )
        return {
            ...dashboardPageTrail(crumbs, {
                inWorkspace: pathname.includes("/dashboard/servers/"),
            }),
            server,
        }
    }, [heading, labels, locale, pathname, server, serverId])
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
