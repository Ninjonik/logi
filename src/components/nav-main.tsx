"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"

import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuAction,
    SidebarMenuBadge,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"

export type NavItem = {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    items?: NavItem[]
    /** A count that needs the person's attention, such as missing settings. */
    badge?: { count: number; label: string }
}

function hasActiveDescendant(item: NavItem, pathname: string): boolean {
    if (item.isActive || pathname === item.url) {
        return true
    }

    return (
        item.items?.some((subItem) => hasActiveDescendant(subItem, pathname)) ??
        false
    )
}

function withGameQuery(url: string, gameQuery: string) {
    return url.includes("/dashboard/servers/") && gameQuery
        ? `${url}?${gameQuery}`
        : url
}

const isHeavyServerRoute = (url: string) => url.includes("/dashboard/servers/")

function SubItems({
    items,
    pathname,
    gameQuery,
    expandLabel,
}: {
    items: NavItem[]
    pathname: string
    gameQuery: string
    expandLabel: (title: string) => string
}) {
    return (
        <SidebarMenuSub>
            {items.map((item) => {
                const url = withGameQuery(item.url, gameQuery)
                return (
                    <SidebarMenuSubItem key={`${item.title}-${url}`}>
                        <SidebarMenuSubButton
                            asChild
                            className="h-8 cursor-pointer px-2 text-sm md:h-7"
                            isActive={item.isActive || pathname === item.url}
                        >
                            <Link
                                href={url}
                                prefetch={!isHeavyServerRoute(url)}
                            >
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuSubButton>
                        {item.items?.length ? (
                            <SubItems
                                items={item.items}
                                pathname={pathname}
                                gameQuery={gameQuery}
                                expandLabel={expandLabel}
                            />
                        ) : null}
                    </SidebarMenuSubItem>
                )
            })}
        </SidebarMenuSub>
    )
}

/** Top-level entries open their page; a chevron beside them shows related pages. */
export function NavMenuItems({
    items,
    expandLabel,
}: {
    items: NavItem[]
    /** Accessible name of the chevron that shows an entry's related pages. */
    expandLabel: (title: string) => string
}) {
    const pathname = usePathname() ?? ""
    const searchParams = useSearchParams()
    const game = searchParams.get("game")
    const gameQuery = game ? `game=${encodeURIComponent(game)}` : ""

    return items.map((item) => {
        const url = withGameQuery(item.url, gameQuery)
        const active = item.isActive || pathname === item.url
        return (
            <Collapsible
                key={`${item.title}-${url}`}
                asChild
                defaultOpen={hasActiveDescendant(item, pathname)}
                className="group/collapsible"
            >
                <SidebarMenuItem>
                    <SidebarMenuButton
                        asChild
                        tooltip={item.title}
                        className="h-10 cursor-pointer px-2 text-sm data-[active=true]:font-semibold md:h-8"
                        isActive={active}
                    >
                        <Link href={url} prefetch={!isHeavyServerRoute(url)}>
                            {item.icon && <item.icon />}
                            <span>{item.title}</span>
                        </Link>
                    </SidebarMenuButton>
                    {item.badge && item.badge.count > 0 ? (
                        <SidebarMenuBadge
                            title={item.badge.label}
                            aria-label={item.badge.label}
                            className="bg-status-warning-muted text-status-warning top-2.5 rounded-full px-1.5 font-semibold md:top-1.5"
                        >
                            {item.badge.count}
                        </SidebarMenuBadge>
                    ) : null}
                    {item.items?.length ? (
                        <>
                            <CollapsibleTrigger asChild>
                                <SidebarMenuAction
                                    aria-label={expandLabel(item.title)}
                                    className="top-2.5 transition-transform group-data-[state=open]/collapsible:rotate-90 md:top-1.5"
                                >
                                    <ChevronRight />
                                </SidebarMenuAction>
                            </CollapsibleTrigger>
                            <CollapsibleContent>
                                <SubItems
                                    items={item.items}
                                    pathname={pathname}
                                    gameQuery={gameQuery}
                                    expandLabel={expandLabel}
                                />
                            </CollapsibleContent>
                        </>
                    ) : null}
                </SidebarMenuItem>
            </Collapsible>
        )
    })
}

export function NavMain({
    label,
    items,
    expandLabel,
}: {
    label: string
    items: NavItem[]
    expandLabel: (title: string) => string
}) {
    return (
        <SidebarGroup className="p-2">
            <SidebarGroupLabel className="h-8 px-2 text-xs">
                {label}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
                <NavMenuItems items={items} expandLabel={expandLabel} />
            </SidebarMenu>
        </SidebarGroup>
    )
}
