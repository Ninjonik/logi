"use client"

import {
    CalendarDays,
    ClipboardList,
    LayoutDashboard,
    Settings,
    Shield,
    UserCog,
    ListTodo,
    CalendarIcon,
    Map,
    Bot,
    Radio,
    Trophy,
} from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ServerSwitcher } from "@/components/app/server-switcher"
import { getPrimaryDisplayedScore } from "@/lib/user-scores"
import type { Dictionary } from "@/i18n/dictionaries"
import { AppLogo } from "@/components/app/app-logo"
import { NavUser } from "@/components/nav-user"
import { NavMain } from "@/components/nav-main"
import type { AppUser } from "@/types/domain"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"

export function AppSidebar({
    locale,
    dictionary,
    user,
    servers,
    activeServerId,
    canAdmin,
    isSuperadmin,
    ...props
}: React.ComponentProps<typeof Sidebar> & {
    locale: Locale
    dictionary: Dictionary
    user: AppUser
    servers: Guild[]
    activeServerId?: string
    canAdmin: boolean
    isSuperadmin: boolean
}) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const pathServerId = pathname?.match(/\/servers\/([^/]+)/)?.[1]
    const selectedWorkspaceId = searchParams.get("workspace") ?? undefined
    const resolvedServerId =
        pathServerId ?? selectedWorkspaceId ?? activeServerId
    const resolvedServer = resolvedServerId
        ? servers.find((server) => server.id === resolvedServerId)
        : undefined
    const adminAccessOverride =
        resolvedServer?.adminAccessOverrides?.[user.discordId]
    const resolvedCanAdmin =
        adminAccessOverride ??
        Boolean(
            resolvedServerId &&
            (resolvedServer?.canAdmin ||
                resolvedServer?.adminIds.includes(user.discordId) ||
                canAdmin)
        )
    const workspaceEnabled = Boolean(
        resolvedServer &&
        (resolvedServer.botInside || pathServerId || isSuperadmin)
    )
    const base = resolvedServerId
        ? `/${locale}/dashboard/servers/${resolvedServerId}`
        : `/${locale}/dashboard`
    const superadminWorkspaceQuery = resolvedServerId
        ? `?workspace=${encodeURIComponent(resolvedServerId)}`
        : ""

    const navGroups = [
        ...(resolvedServerId && workspaceEnabled
            ? [
                  {
                      label: dictionary.sidebar.workspace,
                      items: [
                          {
                              title: dictionary.sidebar.overview,
                              url: base,
                              icon: LayoutDashboard,
                          },
                          {
                              title: dictionary.sidebar.calendar,
                              url: `${base}/calendar`,
                              icon: CalendarDays,
                          },
                          {
                              title: dictionary.sidebar.articles,
                              url: `${base}/articles`,
                              icon: ClipboardList,
                          },
                      ],
                  },
                  {
                      label: dictionary.sidebar.operations,
                      items: [
                          ...(resolvedCanAdmin
                              ? [
                                    {
                                        title: dictionary.sidebar.matches,
                                        url: `${base}/matches`,
                                        icon: CalendarIcon,
                                        items: [
                                            {
                                                title: dictionary.sidebar
                                                    .matches,
                                                url: `${base}/matches`,
                                            },
                                            {
                                                title: dictionary.sidebar
                                                    .topicPresets,
                                                url: `${base}/topic-presets`,
                                            },
                                            {
                                                title: dictionary.sidebar
                                                    .stratmaps,
                                                url: `${base}/stratmaps`,
                                                icon: Map,
                                            },
                                            {
                                                title: dictionary.sidebar
                                                    .rosters,
                                                url: `${base}/rosters`,
                                                items: [
                                                    {
                                                        title: dictionary
                                                            .sidebar.rosters,
                                                        url: `${base}/rosters`,
                                                    },
                                                    {
                                                        title: dictionary
                                                            .sidebar
                                                            .squadPresets,
                                                        url: `${base}/squad-presets`,
                                                    },
                                                ],
                                            },
                                        ],
                                    },
                                    {
                                        title: dictionary.sidebar.trainings,
                                        url: `${base}/trainings`,
                                        icon: Shield,
                                    },
                                ]
                              : [
                                    {
                                        title: dictionary.sidebar.events,
                                        url: `${base}/events`,
                                        icon: ListTodo,
                                    },
                                    {
                                        title: dictionary.sidebar.matches,
                                        url: `${base}/matches`,
                                        icon: CalendarIcon,
                                    },
                                    {
                                        title: dictionary.sidebar.trainings,
                                        url: `${base}/trainings`,
                                        icon: Shield,
                                    },
                                    {
                                        title: dictionary.sidebar.stratmaps,
                                        url: `${base}/stratmaps`,
                                        icon: Map,
                                    },
                                    {
                                        title: dictionary.sidebar.rosters,
                                        url: `${base}/rosters`,
                                        icon: ClipboardList,
                                    },
                                    {
                                        title: dictionary.sidebar.users,
                                        url: `${base}/users`,
                                        icon: UserCog,
                                    },
                                ]),
                      ],
                  },
                  ...(resolvedCanAdmin
                      ? [
                            {
                                label: dictionary.sidebar.configuration,
                                items: [
                                    {
                                        title: dictionary.sidebar.members,
                                        url: `${base}/members`,
                                        icon: UserCog,
                                        items: [
                                            {
                                                title: dictionary.sidebar.users,
                                                url: `${base}/users`,
                                            },
                                            {
                                                title: dictionary.sidebar
                                                    .memberships,
                                                url: `${base}/memberships`,
                                            },
                                            {
                                                title: dictionary.sidebar
                                                    .groups,
                                                url: `${base}/groups`,
                                            },
                                        ],
                                    },
                                    {
                                        title: dictionary.sidebar.tickets,
                                        url: `${base}/tickets`,
                                        icon: ListTodo,
                                    },
                                    {
                                        title: dictionary.sidebar
                                            .serverSettings,
                                        url: `${base}/settings`,
                                        icon: Settings,
                                    },
                                ],
                            },
                        ]
                      : []),
              ]
            : []),
        ...(isSuperadmin
            ? [
                  {
                      label: dictionary.sidebar.bot,
                      items: [
                          {
                              title: dictionary.sidebar.competitions,
                              url: `/${locale}/dashboard/competitions${superadminWorkspaceQuery}`,
                              icon: Trophy,
                          },
                          {
                              title: dictionary.sidebar.bot,
                              url: `/${locale}/dashboard/bot${superadminWorkspaceQuery}`,
                              icon: Bot,
                          },
                      ],
                  },
              ]
            : []),
        {
            label: dictionary.sidebar.logiComms,
            items: [
                {
                    title: dictionary.sidebar.logiComms,
                    url: `/${locale}/dashboard/logicomms${superadminWorkspaceQuery}`,
                    icon: Radio,
                },
            ],
        },
    ]

    return (
        <Sidebar {...props}>
            <SidebarHeader className="border-sidebar-border/70 gap-2 border-b px-2 py-2 2xl:gap-4 2xl:px-3 2xl:py-4">
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton
                            size="lg"
                            asChild
                            isActive={pathname === `/${locale}/dashboard`}
                            className="h-10 gap-2 p-1.5 text-[13px] 2xl:h-12 2xl:p-2 2xl:text-sm"
                        >
                            <Link
                                href={`/${locale}/dashboard${superadminWorkspaceQuery}`}
                            >
                                <AppLogo />
                                <div className="grid flex-1 text-left text-[13px] leading-tight 2xl:text-sm">
                                    <span className="truncate font-semibold">
                                        {dictionary.app.name}
                                    </span>
                                    <span className="text-muted-foreground truncate text-[10px] 2xl:text-xs">
                                        {dictionary.app.tagline}
                                    </span>
                                </div>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
                <ServerSwitcher
                    locale={locale}
                    servers={servers}
                    activeServerId={resolvedServerId}
                    labels={{
                        selectWorkspace: dictionary.workspace.selectWorkspace,
                        activeWorkspace: dictionary.workspace.activeWorkspace,
                        noWorkspaceSelected:
                            dictionary.workspace.noWorkspaceSelected,
                        searchWorkspace: dictionary.workspace.searchWorkspace,
                        noMatchingResults: dictionary.shared.noMatchingResults,
                    }}
                />
            </SidebarHeader>
            <SidebarContent>
                {navGroups.map((group) => (
                    <NavMain
                        key={group.label}
                        label={group.label}
                        items={group.items}
                    />
                ))}
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
