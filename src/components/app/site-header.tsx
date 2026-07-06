"use client";

import { usePathname } from "next/navigation";
import { Bell, Languages } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Guild } from "@/types/domain";
import type { AppUser } from "@/types/domain";

export function SiteHeader({
  dictionary,
  servers,
  user,
}: {
  dictionary: Dictionary;
  servers: Guild[];
  user: AppUser;
}) {
  const pathname = usePathname();
  const pathServerId = pathname?.match(/\/servers\/([^/]+)/)?.[1];
  const activeServer =
    servers.find((server) => server.id === pathServerId) ??
    servers.find((server) => server.id === user.guildId);
  const canAdmin = Boolean(activeServer?.adminIds.includes(user.id));

  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center border-b bg-background/90 backdrop-blur">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-semibold">
            {activeServer?.name ?? dictionary.dashboard.title}
          </div>
          <div className="truncate text-xs text-muted-foreground">
            {activeServer?.description ?? dictionary.dashboard.description}
          </div>
        </div>
        <Badge variant="secondary" className="hidden rounded-full px-3 sm:inline-flex">
          <Languages className="mr-1 size-3.5" />
          EN ready
        </Badge>
        <Badge variant={canAdmin ? "default" : "secondary"} className="rounded-full px-3">
          {canAdmin ? dictionary.common.adminOnly : dictionary.common.membersOnly}
        </Badge>
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="size-4" />
        </Button>
      </div>
    </header>
  );
}
