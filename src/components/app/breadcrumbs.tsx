"use client"

import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import {
    buildDashboardBreadcrumbs,
    type DashboardCrumbLabels,
} from "@/lib/navigation/dashboard-breadcrumbs"
import { usePathname, useParams } from "next/navigation"
import type { Dictionary } from "@/i18n/dictionaries"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"
import React, { useMemo } from "react"
import Link from "next/link"

export function AppBreadcrumbs({
    dictionary,
    locale,
    servers,
}: {
    dictionary: Dictionary
    locale: Locale
    servers: Guild[]
}) {
    const pathname = usePathname()
    const params = useParams()
    const serverId =
        typeof params.serverId === "string" ? params.serverId : undefined
    const server = servers.find((item) => item.id === serverId)
    const labels = useMemo(() => crumbLabels(dictionary), [dictionary])
    const items = buildDashboardBreadcrumbs({
        locale,
        pathname,
        serverId,
        serverName: server?.name,
        labels,
    })

    if (items.length === 0) return null

    return (
        <Breadcrumb>
            <BreadcrumbList className="gap-1 text-[11px] md:gap-1.5 md:text-xs 2xl:gap-2.5 2xl:text-sm [&_[data-slot=breadcrumb-separator]>svg]:size-3 2xl:[&_[data-slot=breadcrumb-separator]>svg]:size-3.5">
                <BreadcrumbItem>
                    <BreadcrumbLink asChild>
                        <Link href={`/${locale}/dashboard`}>
                            {dictionary.sidebar.home}
                        </Link>
                    </BreadcrumbLink>
                </BreadcrumbItem>
                {items.map((item) => (
                    <React.Fragment key={item.href}>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                            {item.isLast ? (
                                <BreadcrumbPage>{item.label}</BreadcrumbPage>
                            ) : (
                                <BreadcrumbLink asChild>
                                    <Link href={item.href}>{item.label}</Link>
                                </BreadcrumbLink>
                            )}
                        </BreadcrumbItem>
                    </React.Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    )
}

/** Translated labels for every dashboard route segment and record kind. */
function crumbLabels(dictionary: Dictionary): DashboardCrumbLabels {
    const sidebar = dictionary.sidebar
    const crumbs = sidebar.crumbs
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
            users: sidebar.users,
            members: sidebar.members,
            memberships: sidebar.memberships,
            tickets: sidebar.tickets,
            teams: sidebar.teams,
            settings: sidebar.serverSettings,
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
            user: sidebar.userSettings,
        },
        settingsSections: Object.fromEntries(
            Object.entries(dictionary.settingsHub.sections).map(
                ([section, value]) => [section, value.title]
            )
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
