"use client"

import { useSearchParams } from "next/navigation"
import { ArrowLeft, Menu } from "lucide-react"
import Link from "next/link"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useDashboardPageTrail } from "@/components/app/breadcrumbs"
import type { Dictionary } from "@/i18n/dictionaries"
import { useSidebar } from "@/components/ui/sidebar"
import type { AppUser } from "@/types/domain"
import type { Guild } from "@/types/domain"
import { initialsOf } from "@/lib/initials"
import type { Locale } from "@/i18n/config"

/**
 * The phone title bar (design K2). On a section page it holds the menu
 * button, the clan's name and the person's avatar; below a section it holds
 * a back button to the page one level up and the page's name. From `md` up
 * the sidebar is always visible and the page trail sits above the content,
 * so the bar is not shown.
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
    const { toggleSidebar } = useSidebar()
    const searchParams = useSearchParams()
    const trail = useDashboardPageTrail({ dictionary, locale, servers })
    const workspaceId = searchParams.get("workspace")
    const clan =
        trail.server ??
        (workspaceId
            ? servers.find((server) => server.id === workspaceId)
            : undefined)
    const accountHref = `/${locale}/dashboard/settings/user${
        clan ? `?workspace=${encodeURIComponent(clan.id)}` : ""
    }`

    return (
        <header
            data-mobile-title-bar=""
            data-back={trail.parent ? "" : undefined}
            className="bg-background/95 supports-[backdrop-filter]:bg-background/85 sticky top-0 z-30 flex h-14 shrink-0 items-center gap-1.5 border-b px-2.5 backdrop-blur md:hidden"
        >
            {trail.parent ? (
                <>
                    <Link
                        href={trail.parent.href}
                        aria-label={dictionary.appStates.backTo.replace(
                            "{page}",
                            trail.parent.label
                        )}
                        className="hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-[10px]"
                    >
                        <ArrowLeft aria-hidden="true" className="size-5" />
                    </Link>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                        {trail.current?.label}
                    </span>
                </>
            ) : (
                <>
                    <button
                        type="button"
                        onClick={toggleSidebar}
                        aria-label={dictionary.appStates.openMenu}
                        className="hover:bg-accent flex size-11 shrink-0 items-center justify-center rounded-[10px]"
                    >
                        <Menu aria-hidden="true" className="size-5" />
                    </button>
                    <span className="min-w-0 flex-1 truncate text-[15px] font-semibold">
                        {clan?.name ??
                            trail.current?.label ??
                            dictionary.app.name}
                    </span>
                    <Link
                        href={accountHref}
                        aria-label={dictionary.sidebar.myAccount}
                        className="flex size-11 shrink-0 items-center justify-center rounded-full"
                    >
                        <Avatar className="size-8">
                            <AvatarImage src={user.avatar} alt="" />
                            <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                                {initialsOf(user.name)}
                            </AvatarFallback>
                        </Avatar>
                    </Link>
                </>
            )}
        </header>
    )
}
