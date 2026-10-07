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
    ListChecks,
    CalendarIcon,
    Map,
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
    const within = (segment: string) =>
        Boolean(pathname?.startsWith(`${base}/${segment}`))

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
                              isActive: within("calendar"),
                          },
                          {
                              title: t.articles,
                              url: `${base}/articles`,
                              icon: ClipboardList,
                              isActive: within("articles"),
                          },
                      ],
                  },
                  {
                      label: t.operations,
                      id: "onboarding-sidebar-operations",
                      items: [
                          // Members see every event in one list; managers
                          // work from matches and trainings.
                          ...(resolvedCanAdmin
                              ? []
                              : [
                                    {
                                        title: t.events,
                                        url: `${base}/events`,
                                        icon: ListTodo,
                                        isActive: within("events"),
                                    },
                                ]),
                          {
                              title: t.matches,
                              url: `${base}/matches`,
                              icon: CalendarIcon,
                              isActive: within("matches"),
                          },
                          {
                              title: t.trainings,
                              url: `${base}/trainings`,
                              icon: Shield,
                              isActive: within("trainings"),
                          },
                          {
                              title: t.signupActivity,
                              url: `${base}/signup-activity`,
                              icon: ListChecks,
                          },
                          {
                              title: t.rosters,
                              url: `${base}/rosters`,
                              icon: ClipboardList,
                              isActive: within("rosters"),
                          },
                          {
                              title: t.stratmaps,
                              url: `${base}/stratmaps`,
                              icon: Map,
                              isActive: within("stratmaps"),
                          },
                          ...(resolvedCanAdmin
                              ? []
                              : [
                                    {
                                        title: t.users,
                                        url: `${base}/users`,
                                        icon: UserCog,
                                        isActive: within("users"),
                                    },
                                ]),
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
                                        isActive: within("users"),
                                        // Listed under Members while that part is open.
                                        items: [
                                            {
                                                title: t.groups,
                                                url: `${base}/groups`,
                                                isActive: within("groups"),
                                            },
                                        ],
                                    },
                                    {
                                        title: t.teams,
                                        url: `${base}/teams`,
                                        icon: Swords,
                                        isActive: within("teams"),
                                    },
                                    {
                                        title: t.tickets,
                                        url: `${base}/tickets`,
                                        icon: Ticket,
                                        isActive: within("tickets"),
                                    },
                                    {
                                        title: t.settings,
                                        url: `${base}/settings`,
                                        icon: Settings,
                                        // Presets open from Settings > Presets.
                                        isActive:
                                            within("settings") ||
                                            within("system") ||
                                            within("topic-presets") ||
                                            within("squad-presets"),
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

    // Global administration has its own sidebar (AdminSidebar); this entry
    // leads there and is shown to Logi's administrators only.
    const footerItems: NavItem[] = isSuperadmin
        ? [
              {
                  title: t.globalAdmin,
                  url: globalAdminHref(
                      locale,
                      "teams",
                      superadminWorkspaceQuery
                  ),
                  icon: Globe,
                  isActive: isGlobalAdminPath(pathname),
                  note: t.adminNav.adminsOnly,
              },
          ]
        : []

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
            <SidebarHeader className="p-2 pb-0">
                <ServerSwitcher
                    locale={locale}
                    servers={servers}
                    activeServerId={resolvedServerId}
                    enabledGames={resolvedServer?.enabledGames}
                    labels={{
                        selectWorkspace: dictionary.workspace.selectWorkspace,
                        noWorkspaceSelected:
                            dictionary.workspace.noWorkspaceSelected,
                        searchWorkspace: dictionary.workspace.searchWorkspace,
                        noMatchingResults: dictionary.shared.noMatchingResults,
                        missingWorkspaceHelp:
                            dictionary.workspace.missingWorkspaceHelp,
                        showAllResults: dictionary.workspace.showAllResults,
                        allClans: dictionary.workspace.allClans,
                        allGames: dictionary.workspace.allGames,
                        gameHeading: dictionary.workspace.gameHeading,
                        clanHeading: dictionary.workspace.clanHeading,
                    }}
                />
            </SidebarHeader>
            <SidebarContent
                role="navigation"
                aria-label={dictionary.appStates.mainNavigation}
                // The account follows the menu directly, as in the design.
                className="flex-initial gap-0"
            >
                {navGroups.map((group) => (
                    <div key={group.label} id={group.id}>
                        <NavMain label={group.label} items={group.items} />
                    </div>
                ))}
            </SidebarContent>
            <SidebarFooter id="onboarding-account-menu" className="p-2 pt-0">
                <div className="border-sidebar-border flex flex-col gap-0.5 border-t pt-2">
                    {footerItems.length ? (
                        <SidebarMenu className="gap-0.5">
                            <NavMenuItems items={footerItems} />
                        </SidebarMenu>
                    ) : null}
                    <NavUser
                        user={{ name: user.name, avatar: user.avatar }}
                        locale={locale}
                        dictionary={dictionary}
                    />
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
