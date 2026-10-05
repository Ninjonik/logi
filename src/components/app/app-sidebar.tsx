"use client"

import {
    CalendarDays,
    ClipboardList,
    LayoutDashboard,
    Settings,
    Shield,
    Swords,
    UserCog,
    ListTodo,
    CalendarIcon,
    Map,
    Radio,
    Globe,
    Ticket,
} from "lucide-react"
import { usePathname, useSearchParams } from "next/navigation"
import { useEffect } from "react"

import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    useSidebar,
} from "@/components/ui/sidebar"
import { useSettingsAttentionCount } from "@/components/app/settings-attention"
import { globalAdminHref, isGlobalAdminPath } from "@/lib/global-admin-routes"
import { NavMain, NavMenuItems, type NavItem } from "@/components/nav-main"
import { globalAdminSection } from "@/lib/navigation/global-admin-routes"
import { ServerSwitcher } from "@/components/app/server-switcher"
import { GameSwitcher } from "@/components/app/game-switcher"
import { AdminSidebar } from "@/components/app/admin-sidebar"
import { canAdminWorkspace } from "@/lib/workspace-admin"
import type { Dictionary } from "@/i18n/dictionaries"
import { NavUser } from "@/components/nav-user"
import type { AppUser } from "@/types/domain"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"

/**
 * The clan sidebar (design AppSidebar): the clan switcher, then the clan's
 * pages in three groups, then global administration for Logi's admins and the
 * person's account at the bottom.
 */
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
    const { isMobile, setOpenMobile } = useSidebar()
    const pathServerId = pathname?.match(/\/servers\/([^/]+)/)?.[1]
    const selectedWorkspaceId = searchParams.get("workspace") ?? undefined
    // Global administration has its own navigation (see AdminSidebar). It is
    // swapped in at the end, after every hook of this component has run.
    const adminSection = isSuperadmin ? globalAdminSection(pathname) : null
    const resolvedServerId =
        pathServerId ?? selectedWorkspaceId ?? activeServerId
    const resolvedServer = resolvedServerId
        ? servers.find((server) => server.id === resolvedServerId)
        : undefined
    const resolvedCanAdmin = Boolean(
        resolvedServerId &&
        (resolvedServer
            ? canAdminWorkspace(resolvedServer, user.discordId) ||
              (canAdmin &&
                  resolvedServer.adminAccessOverrides?.[user.discordId] ===
                      undefined)
            : canAdmin)
    )
    const workspaceEnabled = Boolean(
        resolvedServer &&
        (resolvedServer.botInside || pathServerId || isSuperadmin)
    )
    const settingsAttention = useSettingsAttentionCount(resolvedServerId)

    // On phones the menu is a sheet over the page; close it after navigating.
    useEffect(() => {
        if (isMobile) setOpenMobile(false)
    }, [pathname, isMobile, setOpenMobile])

    const base = resolvedServerId
        ? `/${locale}/dashboard/servers/${resolvedServerId}`
        : `/${locale}/dashboard`
    const superadminWorkspaceQuery = resolvedServerId
        ? `?workspace=${encodeURIComponent(resolvedServerId)}`
        : ""
    const t = dictionary.sidebar

    const navGroups: Array<{ label: string; id?: string; items: NavItem[] }> =
        resolvedServerId && workspaceEnabled
            ? [
                  {
                      label: t.workspace,
                      items: [
                          {
                              title: t.dashboard,
                              url: base,
                              icon: LayoutDashboard,
                          },
                          {
                              title: t.calendar,
                              url: `${base}/calendar`,
                              icon: CalendarDays,
                          },
                          {
                              title: t.articles,
                              url: `${base}/articles`,
                              icon: ClipboardList,
                          },
                      ],
                  },
                  {
                      label: t.operations,
                      id: "onboarding-sidebar-operations",
                      items: resolvedCanAdmin
                          ? [
                                {
                                    title: t.matches,
                                    url: `${base}/matches`,
                                    icon: CalendarIcon,
                                    items: [
                                        {
                                            title: t.topicPresets,
                                            url: `${base}/topic-presets`,
                                        },
                                    ],
                                },
                                {
                                    title: t.trainings,
                                    url: `${base}/trainings`,
                                    icon: Shield,
                                },
                                {
                                    title: t.signupActivity,
                                    url: `${base}/signup-activity`,
                                    icon: ListTodo,
                                },
                                {
                                    title: t.rosters,
                                    url: `${base}/rosters`,
                                    icon: ClipboardList,
                                    items: [
                                        {
                                            title: t.squadPresets,
                                            url: `${base}/squad-presets`,
                                        },
                                    ],
                                },
                                {
                                    title: t.stratmaps,
                                    url: `${base}/stratmaps`,
                                    icon: Map,
                                },
                            ]
                          : [
                                {
                                    title: t.events,
                                    url: `${base}/events`,
                                    icon: ListTodo,
                                },
                                {
                                    title: t.matches,
                                    url: `${base}/matches`,
                                    icon: CalendarIcon,
                                },
                                {
                                    title: t.trainings,
                                    url: `${base}/trainings`,
                                    icon: Shield,
                                },
                                {
                                    title: t.signupActivity,
                                    url: `${base}/signup-activity`,
                                    icon: ListTodo,
                                },
                                {
                                    title: t.rosters,
                                    url: `${base}/rosters`,
                                    icon: ClipboardList,
                                },
                                {
                                    title: t.stratmaps,
                                    url: `${base}/stratmaps`,
                                    icon: Map,
                                },
                                {
                                    title: t.users,
                                    url: `${base}/users`,
                                    icon: UserCog,
                                },
                            ],
                  },
                  ...(resolvedCanAdmin
                      ? [
                            {
                                label: t.configuration,
                                id: "onboarding-sidebar-configuration",
                                items: [
                                    {
                                        title: t.members,
                                        url: `${base}/users`,
                                        icon: UserCog,
                                        isActive: pathname?.startsWith(
                                            `${base}/users`
                                        ),
                                        items: [
                                            {
                                                title: t.groups,
                                                url: `${base}/groups`,
                                            },
                                        ],
                                    },
                                    {
                                        title: t.teams,
                                        url: `${base}/teams`,
                                        icon: Swords,
                                    },
                                    {
                                        title: t.tickets,
                                        url: `${base}/tickets`,
                                        icon: Ticket,
                                    },
                                    {
                                        title: t.settings,
                                        url: `${base}/settings`,
                                        icon: Settings,
                                        isActive: pathname?.startsWith(
                                            `${base}/settings`
                                        ),
                                        badge: {
                                            count: settingsAttention,
                                            label: t.settingsAttention.replace(
                                                "{count}",
                                                String(settingsAttention)
                                            ),
                                        },
                                    },
                                ],
                            },
                        ]
                      : []),
              ]
            : []

    // Global administration is reachable from the "Global administration"
    // entry below; on its pages the AdminSidebar replaces this sidebar.
    const onGlobalAdminPage = isGlobalAdminPath(pathname)
    const footerItems: NavItem[] = [
        {
            title: t.logiComms,
            url: `/${locale}/dashboard/logicomms${superadminWorkspaceQuery}`,
            icon: Radio,
        },
        ...(isSuperadmin
            ? [
                  {
                      title: t.globalAdmin,
                      url: globalAdminHref(
                          locale,
                          "teams",
                          superadminWorkspaceQuery
                      ),
                      icon: Globe,
                      isActive: onGlobalAdminPage,
                      items: [
                          {
                              title: t.competitions,
                              url: globalAdminHref(
                                  locale,
                                  "competitions",
                                  superadminWorkspaceQuery
                              ),
                          },
                          {
                              title: t.teamCatalog,
                              url: globalAdminHref(
                                  locale,
                                  "teams",
                                  superadminWorkspaceQuery
                              ),
                          },
                          {
                              title: t.teamRequests,
                              url: globalAdminHref(
                                  locale,
                                  "team-requests",
                                  superadminWorkspaceQuery
                              ),
                          },
                          {
                              title: t.bot,
                              url: globalAdminHref(
                                  locale,
                                  "bot",
                                  superadminWorkspaceQuery
                              ),
                          },
                          {
                              title: t.platformSettings,
                              url: globalAdminHref(
                                  locale,
                                  "platform-settings",
                                  superadminWorkspaceQuery
                              ),
                          },
                      ],
                  },
              ]
            : []),
    ]
    const expandLabel = (title: string) =>
        t.showSubpages.replace("{item}", title)

    if (adminSection)
        return (
            <AdminSidebar
                locale={locale}
                dictionary={dictionary}
                user={user}
                servers={servers}
                activeSection={adminSection}
                workspaceId={selectedWorkspaceId ?? activeServerId}
                {...props}
            />
        )

    return (
        <Sidebar id="onboarding-sidebar" {...props}>
            <SidebarHeader className="gap-2 p-2">
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
                        missingWorkspaceHelp:
                            dictionary.workspace.missingWorkspaceHelp,
                        showAllResults: dictionary.workspace.showAllResults,
                        allClans: dictionary.workspace.allClans,
                    }}
                />
                {resolvedServerId ? (
                    <GameSwitcher
                        enabledGames={resolvedServer?.enabledGames}
                        dictionary={dictionary}
                    />
                ) : null}
            </SidebarHeader>
            <SidebarContent
                role="navigation"
                aria-label={dictionary.appStates.mainNavigation}
            >
                {navGroups.map((group) => (
                    <div key={group.label} id={group.id}>
                        <NavMain
                            label={group.label}
                            items={group.items}
                            expandLabel={expandLabel}
                        />
                    </div>
                ))}
            </SidebarContent>
            <SidebarFooter
                id="onboarding-account-menu"
                className="border-sidebar-border gap-1 border-t p-2"
            >
                <SidebarMenu className="gap-0.5">
                    <NavMenuItems
                        items={footerItems}
                        expandLabel={expandLabel}
                    />
                </SidebarMenu>
                <NavUser
                    user={{ name: user.name, avatar: user.avatar }}
                    locale={locale}
                    dictionary={dictionary}
                />
            </SidebarFooter>
        </Sidebar>
    )
}
