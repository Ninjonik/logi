"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { ChevronRight, type LucideIcon } from "lucide-react"
import type { ReactNode } from "react"
import Link from "next/link"

import {
    SidebarGroup,
    SidebarGroupLabel,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarMenuSub,
    SidebarMenuSubButton,
    SidebarMenuSubItem,
} from "@/components/ui/sidebar"

export type NavItem = {
    title: string
    url: string
    icon?: LucideIcon
    isActive?: boolean
    /** Related pages, listed under the entry while its section is open. */
    items?: NavItem[]
    /** A count that needs the person's attention, such as missing settings. */
    badge?: { count: number; label: string }
    /** A short note after the title, such as "admins only". */
    note?: string
}

function isActiveItem(item: NavItem, pathname: string): boolean {
    return Boolean(item.isActive) || pathname === item.url
}

function hasActiveDescendant(item: NavItem, pathname: string): boolean {
    return (
        isActiveItem(item, pathname) ||
        (item.items?.some((subItem) =>
            hasActiveDescendant(subItem, pathname)
        ) ??
            false)
    )
}

function withGameQuery(url: string, gameQuery: string) {
    return url.includes("/dashboard/servers/") && gameQuery
        ? `${url}?${gameQuery}`
        : url
}

const isHeavyServerRoute = (url: string) => url.includes("/dashboard/servers/")

/**
 * One entry of the sidebar (design AppSidebar): icon, title and an optional
 * attention badge or note. The current page is shaded and bold.
 */
export function NavMenuItems({ items }: { items: NavItem[] }) {
    const pathname = usePathname() ?? ""
    const searchParams = useSearchParams()
    const game = searchParams.get("game")
    const gameQuery = game ? `game=${encodeURIComponent(game)}` : ""

    return items.map((item) => (
        <NavMenuItem
            key={`${item.title}-${withGameQuery(item.url, gameQuery)}`}
            item={item}
            pathname={pathname}
            gameQuery={gameQuery}
        />
    ))
}

function NavMenuItem({
    item,
    pathname,
    gameQuery,
}: {
    item: NavItem
    pathname: string
    gameQuery: string
}) {
    const url = withGameQuery(item.url, gameQuery)
    const active = isActiveItem(item, pathname)
    const showSubItems =
        Boolean(item.items?.length) && hasActiveDescendant(item, pathname)
    const hasBadge = Boolean(item.badge && item.badge.count > 0)
    return (
        <SidebarMenuItem>
            <SidebarMenuButton
                asChild
                tooltip={item.title}
                isActive={active}
                className="h-10 cursor-pointer gap-2 rounded-lg px-2 text-sm data-[active=true]:font-semibold md:h-8"
            >
                <Link
                    href={url}
                    prefetch={!isHeavyServerRoute(url)}
                    aria-current={active ? "page" : undefined}
                >
                    {item.icon && <item.icon aria-hidden="true" />}
                    <span className="min-w-0 flex-1 truncate">
                        {item.title}
                    </span>
                    {hasBadge && item.badge ? (
                        <AttentionBadge label={item.badge.label}>
                            {item.badge.count}
                        </AttentionBadge>
                    ) : null}
                    {item.note ? (
                        <span className="text-status-info shrink-0 text-[11px] font-medium">
                            {item.note}
                        </span>
                    ) : null}
                    {item.items?.length ? (
                        <ChevronRight
                            aria-hidden="true"
                            className={`size-4 shrink-0 transition-transform ${
                                showSubItems ? "rotate-90" : ""
                            }`}
                        />
                    ) : null}
                </Link>
            </SidebarMenuButton>
            {showSubItems && item.items ? (
                <SidebarMenuSub className="mr-0 pr-0">
                    {item.items.map((subItem) => (
                        <NavSubMenuItem
                            key={`${subItem.title}-${withGameQuery(subItem.url, gameQuery)}`}
                            item={subItem}
                            pathname={pathname}
                            gameQuery={gameQuery}
                        />
                    ))}
                </SidebarMenuSub>
            ) : null}
        </SidebarMenuItem>
    )
}

/** A recursive sub-navigation item, used for Matches → Rosters → presets. */
function NavSubMenuItem({
    item,
    pathname,
    gameQuery,
}: {
    item: NavItem
    pathname: string
    gameQuery: string
}) {
    const url = withGameQuery(item.url, gameQuery)
    const active = isActiveItem(item, pathname)
    const showSubItems =
        Boolean(item.items?.length) && hasActiveDescendant(item, pathname)

    return (
        <SidebarMenuSubItem>
            <SidebarMenuSubButton
                asChild
                isActive={active}
                className="h-9 rounded-lg px-2 text-sm data-[active=true]:font-semibold md:h-7"
            >
                <Link
                    href={url}
                    prefetch={!isHeavyServerRoute(url)}
                    aria-current={active ? "page" : undefined}
                >
                    <span>{item.title}</span>
                    {item.items?.length ? (
                        <ChevronRight
                            aria-hidden="true"
                            className={`ml-auto size-3.5 shrink-0 transition-transform ${
                                showSubItems ? "rotate-90" : ""
                            }`}
                        />
                    ) : null}
                </Link>
            </SidebarMenuSubButton>
            {showSubItems && item.items ? (
                <SidebarMenuSub className="mr-0 pr-0">
                    {item.items.map((subItem) => (
                        <NavSubMenuItem
                            key={`${subItem.title}-${withGameQuery(subItem.url, gameQuery)}`}
                            item={subItem}
                            pathname={pathname}
                            gameQuery={gameQuery}
                        />
                    ))}
                </SidebarMenuSub>
            ) : null}
        </SidebarMenuSubItem>
    )
}

/** The amber count beside an entry; screen readers hear the full label. */
function AttentionBadge({
    label,
    children,
}: {
    label: string
    children: ReactNode
}) {
    return (
        <>
            <span
                aria-hidden="true"
                title={label}
                className="bg-status-warning-muted text-status-warning flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums"
            >
                {children}
            </span>
            <span className="sr-only">{`, ${label}`}</span>
        </>
    )
}

/** A labelled group of sidebar entries, such as "Operations". */
export function NavMain({ label, items }: { label: string; items: NavItem[] }) {
    return (
        <SidebarGroup className="px-2 pt-2 pb-0">
            <SidebarGroupLabel className="text-muted-foreground h-8 px-2 text-xs font-medium">
                {label}
            </SidebarGroupLabel>
            <SidebarMenu className="gap-0.5">
                <NavMenuItems items={items} />
            </SidebarMenu>
        </SidebarGroup>
    )
}
