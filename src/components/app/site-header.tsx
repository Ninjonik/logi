"use client"

import { LocaleSwitcher } from "@/components/app/locale-switcher"
import { ThemeSwitcher } from "@/components/app/theme-switcher"
import { AppBreadcrumbs } from "@/components/app/breadcrumbs"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import type { Dictionary } from "@/i18n/dictionaries"
import { BookOpen, CirclePlay } from "lucide-react"
import type { AppUser } from "@/types/domain"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"
import Link from "next/link"

export function SiteHeader({
    locale,
    dictionary,
    servers,
    user: _user,
}: {
    locale: Locale
    dictionary: Dictionary
    servers: Guild[]
    user: AppUser
}) {
    return (
        <header className="bg-background/90 sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center border-b backdrop-blur">
            <div className="flex w-full items-center gap-1.5 px-3 md:gap-2 md:px-4 2xl:gap-3 2xl:px-6">
                <SidebarTrigger className="-ml-1 size-7" />
                <Separator orientation="vertical" className="h-3 sm:h-4" />
                <div className="min-w-0 flex-1">
                    <AppBreadcrumbs
                        locale={locale}
                        dictionary={dictionary}
                        servers={servers}
                    />
                </div>
                <Link
                    href="/wiki"
                    className="text-muted-foreground hover:text-foreground hidden items-center gap-1.5 text-xs font-medium transition-colors sm:inline-flex"
                >
                    <BookOpen className="size-3.5" />
                    {dictionary.publicNavigation.wiki}
                </Link>
                <button
                    type="button"
                    onClick={() =>
                        window.dispatchEvent(
                            new Event("logi:restart-onboarding")
                        )
                    }
                    className="text-muted-foreground hover:text-foreground hidden items-center gap-1.5 text-xs font-medium transition-colors sm:inline-flex"
                >
                    <CirclePlay className="size-3.5" />
                    {dictionary.publicNavigation.restartTour}
                </button>
                <ThemeSwitcher />
                <div className="hidden sm:block">
                    <LocaleSwitcher locale={locale} dictionary={dictionary} />
                </div>
            </div>
        </header>
    )
}
