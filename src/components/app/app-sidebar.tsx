"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  FolderKanban,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
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
  const pathServerId = pathname?.match(/\/servers\/([^/]+)/)?.[1];
  const resolvedServerId = pathServerId ?? activeServerId;
  const resolvedCanAdmin = Boolean(resolvedServerId && servers.find((server) => server.id === resolvedServerId)?.adminIds.includes(user.id));
  const base = resolvedServerId
    ? `/${locale}/dashboard/servers/${resolvedServerId}`
    : `/${locale}/dashboard`;

  const navGroups = [
    {
      label: dictionary.sidebar.workspace,
      items: [
        {
          title: dictionary.sidebar.home,
          url: `/${locale}/dashboard`,
          icon: LayoutDashboard,
        },
        ...(resolvedServerId
          ? [
              {
                title: dictionary.sidebar.overview,
                url: base,
                icon: Shield,
              },
              {
                title: dictionary.sidebar.calendar,
                url: `${base}/calendar`,
                icon: CalendarDays,
              },
            ]
          : []),
      ],
    },
    ...(resolvedServerId
      ? [
          {
            label: dictionary.sidebar.operations,
            items: [
              ...(resolvedCanAdmin
                ? [
                    {
                      title: dictionary.sidebar.events,
                      url: `${base}/events`,
                      icon: ClipboardList,
                    },
                    {
                      title: dictionary.sidebar.topicPresets,
                      url: `${base}/topic-presets`,
                      icon: FolderKanban,
                    },
                    {
                      title: dictionary.sidebar.users,
                      url: `${base}/users`,
                      icon: Users,
                    },
                    {
                      title: dictionary.sidebar.squadPresets,
                      url: `${base}/squad-presets`,
                      icon: Users,
                    },
                    {
                      title: dictionary.sidebar.rosters,
                      url: `${base}/rosters`,
                      icon: Shield,
                    },
                  ]
                : [
                    {
                      title: dictionary.sidebar.rosters,
                      url: `${base}/rosters`,
                      icon: Shield,
                    },
                  ]),
            ],
          },
          {
            label: dictionary.sidebar.configuration,
            items: [
              {
                title: dictionary.sidebar.userSettings,
                url: `/${locale}/dashboard/settings/user`,
                icon: Settings,
              },
              ...(resolvedCanAdmin
                ? [
                    {
                      title: dictionary.sidebar.serverSettings,
                      url: `${base}/settings`,
                      icon: Settings,
                    },
                  ]
                : []),
            ],
          },
        ]
      : []),
  ];

  return (
    <Sidebar {...props}>
      <SidebarHeader className="gap-4 border-b border-sidebar-border/70 px-3 py-4">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild isActive={pathname === `/${locale}/dashboard`}>
              <Link href={`/${locale}/dashboard`}>
                <AppLogo />
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{dictionary.app.name}</span>
                  <span className="truncate text-xs text-muted-foreground">{dictionary.app.tagline}</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <ServerSwitcher locale={locale} servers={servers} activeServerId={resolvedServerId} />
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
            email: `${user.score} score`,
            avatar: user.avatar,
          }}
          locale={locale}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
