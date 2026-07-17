"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  FolderKanban,
  Home,
  LayoutDashboard,
  Settings,
  Shield,
  UserCog,
  Users,
  LayoutGrid,
  FileText,
  ListTodo,
  CalendarIcon,
  UserRoundPlus,
} from "lucide-react";

import { AppLogo } from "@/components/app/app-logo";
import { ServerSwitcher } from "@/components/app/server-switcher";
import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Locale } from "@/i18n/config";
import type { Guild } from "@/types/domain";
import type { AppUser } from "@/types/domain";

export function AppSidebar({
  locale,
  dictionary,
  user,
  servers,
  activeServerId,
  canAdmin,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  locale: Locale;
  dictionary: Dictionary;
  user: AppUser;
  servers: Guild[];
  activeServerId?: string;
  canAdmin: boolean;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathServerId = pathname?.match(/\/servers\/([^/]+)/)?.[1];
  const selectedWorkspaceId = searchParams.get("workspace") ?? undefined;
  const resolvedServerId = pathServerId ?? selectedWorkspaceId ?? activeServerId;
  const resolvedServer = resolvedServerId ? servers.find((server) => server.id === resolvedServerId) : undefined;
  const resolvedCanAdmin = Boolean(
    resolvedServerId &&
      (
        resolvedServer?.canAdmin ||
        resolvedServer?.adminIds.includes(user.discordId) ||
        canAdmin
      ),
  );
  const workspaceEnabled = Boolean(resolvedServer?.botInside || pathServerId);
  const base = resolvedServerId
    ? `/${locale}/dashboard/servers/${resolvedServerId}`
    : `/${locale}/dashboard`;
  const homeUrl = resolvedServerId
    ? `/${locale}/dashboard?workspace=${encodeURIComponent(resolvedServerId)}`
    : `/${locale}/dashboard`;

  const navGroups = [
    {
      label: dictionary.sidebar.home,
      items: [
        {
          title: dictionary.sidebar.home,
          url: homeUrl,
          icon: Home,
        },
      ],
    },
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
                    },
                    {
                      title: dictionary.sidebar.trainings,
                      url: `${base}/trainings`,
                      icon: Shield,
                    },
                    {
                      title: dictionary.sidebar.rosters,
                      url: `${base}/rosters`,
                      icon: ClipboardList,
                    },
                  ]
                : [
                    {
                      title: dictionary.sidebar.rosters,
                      url: `${base}/rosters`,
                      icon: ClipboardList,
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
                      title: dictionary.sidebar.topicPresets,
                      url: `${base}/topic-presets`,
                      icon: FileText,
                    },
                    {
                      title: dictionary.sidebar.squadPresets,
                      url: `${base}/squad-presets`,
                      icon: LayoutGrid,
                    },
                    {
                      title: dictionary.sidebar.groups,
                      url: `${base}/groups`,
                      icon: Users,
                    },
                    {
                      title: dictionary.sidebar.users,
                      url: `${base}/users`,
                      icon: UserCog,
                    },
                    {
                      title: dictionary.sidebar.serverSettings,
                      url: `${base}/settings`,
                      icon: Settings,
                    },
                    {
                      title: dictionary.sidebar.memberships,
                      url: `${base}/memberships`,
                      icon: UserRoundPlus,
                    },
                    {
                      title: dictionary.sidebar.tickets,
                      url: `${base}/tickets`,
                      icon: ListTodo,
                    },
                  ],
                },
              ]
            : []),
        ]
      : []),
  ];

  return (
    <Sidebar {...props}>
      <SidebarHeader className="gap-4 border-b border-sidebar-border/70 px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild isActive={pathname === `/${locale}/dashboard`}>
              <Link href={homeUrl}>
                <AppLogo />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{dictionary.app.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{dictionary.app.tagline}</span>
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
            noWorkspaceSelected: dictionary.workspace.noWorkspaceSelected,
          }}
        />
      </SidebarHeader>
      <SidebarContent>
        {navGroups.map((group) => (
          <NavMain key={group.label} label={group.label} items={group.items} />
        ))}
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/70">
        <NavUser
          user={{
            name: user.name,
            email: `${user.score} ${dictionary.navUser.scoreSuffix}`,
            avatar: user.avatar,
          }}
          locale={locale}
          dictionary={dictionary}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
