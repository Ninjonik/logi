"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { Bell } from "lucide-react";

import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { AppBreadcrumbs } from "@/components/app/breadcrumbs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import type { Locale } from "@/i18n/config";
import type { Dictionary } from "@/i18n/dictionaries";
import type { Guild } from "@/types/domain";
import type { AppUser } from "@/types/domain";

export function SiteHeader({
  locale,
  dictionary,
  servers,
  user,
}: {
  locale: Locale;
  dictionary: Dictionary;
  servers: Guild[];
  user: AppUser;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pathServerId = pathname?.match(/\/servers\/([^/]+)/)?.[1];
  const selectedWorkspaceId = searchParams.get("workspace") ?? undefined;
  const activeServer = servers.find((server) => server.id === (pathServerId ?? selectedWorkspaceId));
  const canAdmin = Boolean(activeServer?.adminIds.includes(user.id));

  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center border-b bg-background/90 backdrop-blur">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <div className="min-w-0 flex-1">
          <AppBreadcrumbs locale={locale} dictionary={dictionary} servers={servers} />
        </div>
        <div className="hidden sm:block">
          <LocaleSwitcher locale={locale} dictionary={dictionary} />
        </div>
      </div>
    </header>
  );
}
