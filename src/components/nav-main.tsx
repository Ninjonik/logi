"use client"

import { ChevronRight, type LucideIcon } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
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

type NavItem = {
  title: string
  url: string
  icon?: LucideIcon
  isActive?: boolean
  items?: NavItem[]
}

function hasActiveDescendant(item: NavItem, pathname: string): boolean {
  if (item.isActive || pathname === item.url) {
    return true
  }

  return item.items?.some((subItem) => hasActiveDescendant(subItem, pathname)) ?? false
}

function renderNavItems(items: NavItem[], pathname: string, depth = 0) {
  const isHeavyServerRoute = (url: string) => url.includes("/dashboard/servers/")

  return items.map((item) => (
    <Collapsible
      key={`${depth}-${item.title}-${item.url}`}
      asChild
      defaultOpen={hasActiveDescendant(item, pathname)}
      className="group/collapsible"
    >
      {depth === 0 ? (
        <SidebarMenuItem>
          {item.items?.length ? (
            <>
              <CollapsibleTrigger asChild>
                <SidebarMenuButton tooltip={item.title} className="cursor-pointer" isActive={pathname === item.url}>
                  {item.icon && <item.icon />}
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub>
                  {renderNavItems(item.items, pathname, depth + 1)}
                </SidebarMenuSub>
              </CollapsibleContent>
            </>
          ) : (
            <SidebarMenuButton asChild tooltip={item.title} className="cursor-pointer" isActive={pathname === item.url}>
              <Link href={item.url} prefetch={!isHeavyServerRoute(item.url)}>
                {item.icon && <item.icon />}
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          )}
        </SidebarMenuItem>
      ) : (
        <SidebarMenuSubItem>
          {item.items?.length ? (
            <>
              <CollapsibleTrigger asChild>
                <SidebarMenuSubButton className="cursor-pointer" isActive={pathname === item.url}>
                  <span>{item.title}</span>
                  <ChevronRight className="ml-auto size-4 transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
                </SidebarMenuSubButton>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <SidebarMenuSub className="mx-2 mt-1">
                  {renderNavItems(item.items, pathname, depth + 1)}
                </SidebarMenuSub>
              </CollapsibleContent>
            </>
          ) : (
            <SidebarMenuSubButton asChild className="cursor-pointer" isActive={pathname === item.url}>
              <Link href={item.url} prefetch={!isHeavyServerRoute(item.url)}>
                <span>{item.title}</span>
              </Link>
            </SidebarMenuSubButton>
          )}
        </SidebarMenuSubItem>
      )}
    </Collapsible>
  ))
}

export function NavMain({
  label,
  items,
}: {
  label: string
  items: NavItem[]
}) {
  const pathname = usePathname()

  return (
    <SidebarGroup>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>{renderNavItems(items, pathname)}</SidebarMenu>
    </SidebarGroup>
  )
}
