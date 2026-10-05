"use client"

import {
    ArrowLeft,
    Bot,
    Inbox,
    Settings,
    Shield,
    Trophy,
    UsersRound,
    type LucideIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import Link from "next/link"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import {
    pendingBadgeLabel,
    type GlobalAdminSection,
} from "@/lib/navigation/global-admin-routes"
import { fetchTeamRequestQueue } from "@/lib/teams-admin/team-admin-client"
import { TEAM_REQUEST_PAGE_MAX } from "@/domain/teams/team-request"
import { getPrimaryDisplayedScore } from "@/lib/user-scores"
import type { Dictionary } from "@/i18n/dictionaries"
import type { AppUser, Guild } from "@/types/domain"
import { NavUser } from "@/components/nav-user"
import type { Locale } from "@/i18n/config"

/** Sent by the request queue after a decision so the badge re-counts. */
export const TEAM_REQUESTS_CHANGED_EVENT = "logi:team-requests-changed"

type AdminLink = {
    section: GlobalAdminSection
    title: string
    icon: LucideIcon
    badge?: string | null
    badgeTitle?: string
}

/**
 * Navigation of Logi's global administration (design: AdminSidebar). It
 * replaces the clan navigation on global pages, names the scope, and leads
 * back to the clan the administrator came from.
 */
export function AdminSidebar({
    locale,
    dictionary,
    user,
    servers,
    activeSection,
    workspaceId,
    ...props
}: React.ComponentProps<typeof Sidebar> & {
    locale: Locale
    dictionary: Dictionary
    user: AppUser
    servers: Guild[]
    activeSection: GlobalAdminSection
    /** The clan the administrator came from (`?workspace=`), if any. */
    workspaceId?: string
}) {
    const t = dictionary.sidebar.adminNav
    const pending = usePendingRequestCount(activeSection)
    const clan = workspaceId
        ? servers.find((server) => server.id === workspaceId)
        : undefined
    const query = workspaceId
        ? `?workspace=${encodeURIComponent(workspaceId)}`
        : ""
    const href = (section: GlobalAdminSection) =>
        `/${locale}/dashboard/${section}${query}`
    const badge = pending
        ? pendingBadgeLabel(pending.count, pending.more)
        : null

    const groups: Array<{ label: string; items: AdminLink[] }> = [
        {
            label: t.competitionsAndTeams,
            items: [
                {
                    section: "competitions",
                    title: dictionary.sidebar.competitions,
                    icon: Trophy,
                },
                {
                    section: "teams",
                    title: dictionary.sidebar.teamCatalog,
                    icon: UsersRound,
                },
                {
                    section: "team-requests",
                    title: dictionary.sidebar.teamRequests,
                    icon: Inbox,
                    badge,
                    badgeTitle: badge
                        ? t.pendingRequests.replace("{count}", badge)
                        : undefined,
                },
            ],
        },
        {
            label: t.operations,
            items: [
                { section: "bot", title: t.botLogs, icon: Bot },
                {
                    section: "platform-settings",
                    title: dictionary.sidebar.platformSettings,
                    icon: Settings,
                },
            ],
        },
    ]

    return (
        <Sidebar id="onboarding-sidebar" {...props}>
            <SidebarHeader className="border-sidebar-border/70 gap-2 border-b px-2 py-2 2xl:px-3 2xl:py-4">
                <div className="flex items-center gap-2 p-1.5">
                    <span className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg">
                        <Shield className="size-4" aria-hidden />
                    </span>
                    <span className="grid min-w-0 leading-tight">
                        <span className="truncate text-sm font-semibold">
                            {t.title}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                            {t.subtitle}
                        </span>
                    </span>
                </div>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            asChild
                            className="text-muted-foreground h-8 text-[13px]"
                        >
                            <Link
                                href={
                                    clan
                                        ? `/${locale}/dashboard/servers/${clan.id}`
                                        : `/${locale}/dashboard`
                                }
                            >
                                <ArrowLeft aria-hidden />
                                <span className="truncate">
                                    {clan
                                        ? t.backToClan.replace(
                                              "{clan}",
                                              clan.name
                                          )
                                        : t.backToDashboard}
                                </span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>
            <SidebarContent>
                <nav aria-label={t.label}>
                    {groups.map((group) => (
                        <SidebarGroup key={group.label}>
                            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
                            <SidebarMenu>
                                {group.items.map((item) => {
                                    const active =
                                        item.section === activeSection
                                    return (
                                        <SidebarMenuItem key={item.section}>
                                            <SidebarMenuButton
                                                asChild
                                                isActive={active}
                                                tooltip={item.title}
                                                className="h-8 text-[13px] 2xl:text-sm"
                                            >
                                                <Link
                                                    href={href(item.section)}
                                                    aria-current={
                                                        active
                                                            ? "page"
                                                            : undefined
                                                    }
                                                >
                                                    <item.icon aria-hidden />
                                                    <span>{item.title}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                            {item.badge ? (
                                                <SidebarMenuBadge
                                                    title={item.badgeTitle}
                                                    className="bg-primary/15 text-primary rounded-full"
                                                >
                                                    <span className="sr-only">
                                                        {item.badgeTitle}
                                                    </span>
                                                    <span aria-hidden>
                                                        {item.badge}
                                                    </span>
                                                </SidebarMenuBadge>
                                            ) : null}
                                        </SidebarMenuItem>
                                    )
                                })}
                            </SidebarMenu>
                        </SidebarGroup>
                    ))}
                </nav>
            </SidebarContent>
            <SidebarFooter className="border-sidebar-border/70 border-t p-1.5 2xl:p-2">
                <NavUser
                    user={{
                        name: user.name,
                        email: `${getPrimaryDisplayedScore(user)} ${dictionary.navUser.scoreSuffix}`,
                        avatar: user.avatar,
                    }}
                    locale={locale}
                    dictionary={dictionary}
                />
            </SidebarFooter>
        </Sidebar>
    )
}

/**
 * Pending team requests, read from the moderation queue: re-counted when
 * the administrator moves between pages or decides a request.
 */
function usePendingRequestCount(section: GlobalAdminSection) {
    const [pending, setPending] = useState<{
        count: number
        more: boolean
    } | null>(null)
    const [changes, setChanges] = useState(0)

    useEffect(() => {
        const onChange = () => setChanges((value) => value + 1)
        window.addEventListener(TEAM_REQUESTS_CHANGED_EVENT, onChange)
        return () =>
            window.removeEventListener(TEAM_REQUESTS_CHANGED_EVENT, onChange)
    }, [])

    useEffect(() => {
        const controller = new AbortController()
        fetchTeamRequestQueue(
            { status: "pending", limit: TEAM_REQUEST_PAGE_MAX },
            { signal: controller.signal }
        )
            .then((page) =>
                setPending({
                    count: page.items.length,
                    more: page.nextCursor !== null,
                })
            )
            // A failed count only hides the badge; the queue page reports errors.
            .catch(() => {
                if (!controller.signal.aborted) setPending(null)
            })
        return () => controller.abort()
    }, [section, changes])

    return pending
}
