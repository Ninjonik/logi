"use client";

import { LocaleSwitcher } from "@/components/app/locale-switcher";
import { AppBreadcrumbs } from "@/components/app/breadcrumbs";
import { ThemeSwitcher } from "@/components/app/theme-switcher";
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
  user: _user,
}: {
  locale: Locale;
  dictionary: Dictionary;
  servers: Guild[];
  user: AppUser;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center border-b bg-background/90 backdrop-blur">
      <div className="flex w-full items-center gap-3 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="h-4" />
        <div className="min-w-0 flex-1">
          <AppBreadcrumbs locale={locale} dictionary={dictionary} servers={servers} />
        </div>
        <ThemeSwitcher />
        <div className="hidden sm:block">
          <LocaleSwitcher locale={locale} dictionary={dictionary} />
        </div>
      </div>
    </header>
  );
}
