"use client"

import { usePathname, useSearchParams } from "next/navigation"
import Link from "next/link"

import {
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getLeagueMessages } from "@/i18n/messages/leagues"
import type { Dictionary } from "@/i18n/dictionaries"
import { initialsOf } from "@/lib/initials"
import { isLocale } from "@/i18n/config"
import { Users } from "lucide-react"

/** The person's account at the bottom of the sidebar; opens "My account". */
export function NavUser({
    user,
    locale = "en",
    dictionary,
}: {
    user: {
        name: string
        avatar: string
    }
    locale?: string
    dictionary: Dictionary
}) {
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const pathWorkspace = pathname?.match(/\/servers\/([^/]+)/)?.[1]
    const workspace = pathWorkspace ?? searchParams.get("workspace")
    const accountPath = `/${locale}/dashboard/settings/user`
    const accountHref = workspace
        ? `${accountPath}?workspace=${encodeURIComponent(workspace)}`
        : accountPath

    return (
        <SidebarMenu>
            <SidebarMenuItem>
                <SidebarMenuButton asChild>
                    <Link href={`/${locale}/league-teams`}>
                        <Users />
                        <span>
                            {
                                getLeagueMessages(
                                    isLocale(locale) ? locale : "en"
                                ).manage
                            }
                        </span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
                <SidebarMenuButton
                    asChild
                    size="lg"
                    isActive={pathname === accountPath}
                    className="h-11 gap-2 rounded-lg px-2"
                >
                    <Link
                        href={accountHref}
                        aria-current={
                            pathname === accountPath ? "page" : undefined
                        }
                    >
                        <Avatar className="size-7 rounded-full">
                            <AvatarImage src={user.avatar} alt="" />
                            <AvatarFallback className="bg-primary text-primary-foreground rounded-full text-[11px] font-semibold">
                                {initialsOf(user.name)}
                            </AvatarFallback>
                        </Avatar>
                        <span className="grid min-w-0 flex-1 text-left leading-tight">
                            <span className="truncate font-semibold">
                                {user.name}
                            </span>
                            <span className="text-muted-foreground truncate text-xs">
                                {dictionary.sidebar.myAccount}
                            </span>
                        </span>
                    </Link>
                </SidebarMenuButton>
            </SidebarMenuItem>
        </SidebarMenu>
    )
}
