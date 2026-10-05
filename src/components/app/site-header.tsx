"use client"

import { BookOpen, CirclePlay, Menu } from "lucide-react"
import { usePathname } from "next/navigation"
import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { SidebarTrigger, useSidebar } from "@/components/ui/sidebar"
import { LocaleSwitcher } from "@/components/app/locale-switcher"
import { ThemeSwitcher } from "@/components/app/theme-switcher"
import { AppBreadcrumbs } from "@/components/app/breadcrumbs"
import { Separator } from "@/components/ui/separator"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import type { AppUser } from "@/types/domain"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"

/**
 * The dashboard top bar. On phones (design K2) it is the menu button, the
 * current clan and the person's avatar; the full menu opens as a sheet.
 */
export function SiteHeader({
    locale,
    dictionary,
    servers,
    user,
}: {
    locale: Locale
    dictionary: Dictionary
    servers: Guild[]
    user: AppUser
}) {
    const pathname = usePathname()
    const { toggleSidebar } = useSidebar()
    const serverId = pathname?.match(/\/servers\/([^/]+)/)?.[1]
    const clan = serverId
        ? servers.find((server) => server.id === serverId)
        : undefined

    return (
        <header className="bg-background/90 sticky top-0 z-30 flex h-(--header-height) shrink-0 items-center border-b backdrop-blur">
            <div className="flex w-full min-w-0 items-center gap-1.5 px-2 md:gap-2 md:px-4 2xl:gap-3 2xl:px-6">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={toggleSidebar}
                    aria-label={dictionary.appStates.openMenu}
                    className="size-11 md:hidden"
                >
                    <Menu className="size-5" />
                </Button>
                <SidebarTrigger
                    aria-label={dictionary.appStates.openMenu}
                    className="-ml-1 hidden size-7 md:inline-flex"
                />
                <Separator
                    orientation="vertical"
                    className="hidden h-4 md:block"
                />
                <div className="min-w-0 flex-1">
                    {clan ? (
                        <span className="block truncate text-[15px] font-semibold md:hidden">
                            {clan.name}
                        </span>
                    ) : null}
                    <div className={clan ? "hidden md:block" : undefined}>
                        <AppBreadcrumbs
                            locale={locale}
                            dictionary={dictionary}
                            servers={servers}
                        />
                    </div>
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
                    className="text-muted-foreground hover:text-foreground hidden items-center gap-1.5 text-xs font-medium transition-colors hover:cursor-pointer sm:inline-flex"
                >
                    <CirclePlay className="size-3.5" />
                    {dictionary.publicNavigation.restartTour}
                </button>
                <div className="hidden sm:block">
                    <ThemeSwitcher dictionary={dictionary} />
                </div>
                <div className="hidden sm:block">
                    <LocaleSwitcher locale={locale} dictionary={dictionary} />
                </div>
                <Link
                    href={`/${locale}/dashboard/settings/user`}
                    aria-label={dictionary.sidebar.myAccount}
                    className="flex size-11 items-center justify-center rounded-full sm:hidden"
                >
                    <Avatar className="size-8">
                        <AvatarImage src={user.avatar} alt="" />
                        <AvatarFallback className="text-xs font-semibold">
                            {user.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                </Link>
            </div>
        </header>
    )
}
