"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react"
import * as React from "react"
import Link from "next/link"

import {
    Command,
    CommandEmpty,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import {
    rankWorkspaces,
    WORKSPACE_SWITCHER_PREVIEW,
} from "@/lib/workspace-search"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { CLAN_LIST_QUERY } from "@/domain/workspaces/dashboard-landing"
import { Button } from "@/components/ui/button"
import type { Guild } from "@/types/domain"
import type { Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"

export function ServerSwitcher({
    locale,
    servers,
    activeServerId,
    labels,
}: {
    locale: Locale
    servers: Guild[]
    activeServerId?: string
    labels: {
        selectWorkspace: string
        activeWorkspace: string
        noWorkspaceSelected: string
        searchWorkspace: string
        noMatchingResults: string
        missingWorkspaceHelp: string
        showAllResults: string
        allClans: string
    }
}) {
    const [open, setOpen] = React.useState(false)
    const [query, setQuery] = React.useState("")
    const [showAll, setShowAll] = React.useState(false)
    const pathname = usePathname()
    const router = useRouter()
    const searchParams = useSearchParams()
    const selectedServerId =
        activeServerId ?? searchParams.get("workspace") ?? undefined
    const activeServer = selectedServerId
        ? servers.find((server) => server.id === selectedServerId)
        : undefined

    const rankedServers = React.useMemo(
        () => rankWorkspaces(servers, query),
        [query, servers]
    )
    const visibleServers = showAll
        ? rankedServers
        : rankedServers.slice(0, WORKSPACE_SWITCHER_PREVIEW)
    const hiddenCount = rankedServers.length - visibleServers.length
    const clanListHref = `/${locale}/dashboard?${CLAN_LIST_QUERY.key}=${CLAN_LIST_QUERY.value}`

    return (
        <Popover
            open={open}
            onOpenChange={(nextOpen) => {
                setOpen(nextOpen)
                if (!nextOpen) {
                    setQuery("")
                    setShowAll(false)
                }
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    id="onboarding-workspace-switcher"
                    variant="outline"
                    className="h-10 w-full justify-between rounded-lg px-2 2xl:h-12 2xl:rounded-xl 2xl:px-4"
                >
                    <div className="flex min-w-0 items-center gap-2 2xl:gap-3">
                        <Avatar className="size-7 rounded-md 2xl:size-8 2xl:rounded-lg">
                            <AvatarImage
                                src={activeServer?.avatar}
                                alt={activeServer?.name}
                            />
                            <AvatarFallback>
                                {activeServer?.name?.slice(0, 2) ?? "WS"}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 text-left">
                            <div className="truncate text-xs font-semibold 2xl:text-sm">
                                {activeServer?.name ?? labels.selectWorkspace}
                            </div>
                            <div className="text-muted-foreground truncate text-[10px] 2xl:text-xs">
                                {activeServer
                                    ? labels.activeWorkspace
                                    : labels.noWorkspaceSelected}
                            </div>
                        </div>
                    </div>
                    <ChevronsUpDown className="text-muted-foreground size-3.5 2xl:size-4" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[min(22rem,calc(100vw-2rem))] p-0"
                align="start"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        value={query}
                        onValueChange={setQuery}
                        placeholder={labels.searchWorkspace}
                    />
                    <CommandList>
                        <CommandEmpty>{labels.noMatchingResults}</CommandEmpty>
                        {visibleServers.map((server) => {
                            const target =
                                pathname?.includes("/servers/") &&
                                selectedServerId &&
                                pathname.includes(`/${selectedServerId}/`)
                                    ? pathname.replace(
                                          `/servers/${selectedServerId}`,
                                          `/servers/${server.id}`
                                      )
                                    : `/${locale}/dashboard/servers/${server.id}`

                            return (
                                <CommandItem
                                    key={server.id}
                                    value={`${server.name} ${server.description ?? ""}`}
                                    onSelect={() => {
                                        setOpen(false)
                                        setQuery("")
                                    }}
                                    onMouseEnter={() => router.prefetch(target)}
                                    asChild
                                >
                                    <Link
                                        href={target}
                                        prefetch
                                        className="flex items-center gap-3"
                                    >
                                        <Avatar className="size-8 rounded-lg">
                                            <AvatarImage
                                                src={server.avatar}
                                                alt={server.name}
                                            />
                                            <AvatarFallback>
                                                {server.name.slice(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <div className="truncate font-medium">
                                                {server.name}
                                            </div>
                                            <div className="text-muted-foreground truncate text-xs">
                                                {server.description}
                                            </div>
                                        </div>
                                        <Check
                                            className={cn(
                                                "text-muted-foreground size-4",
                                                selectedServerId === server.id
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                        />
                                    </Link>
                                </CommandItem>
                            )
                        })}
                        {hiddenCount > 0 ? (
                            <CommandItem
                                value="__show-all"
                                onSelect={() => setShowAll(true)}
                                className="text-muted-foreground justify-center text-sm"
                            >
                                {labels.showAllResults.replace(
                                    "{count}",
                                    String(rankedServers.length)
                                )}
                            </CommandItem>
                        ) : null}
                    </CommandList>
                    <div className="border-t p-1">
                        <Link
                            href={clanListHref}
                            onClick={() => setOpen(false)}
                            className="hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium"
                        >
                            <LayoutGrid className="size-4" />
                            {labels.allClans}
                        </Link>
                    </div>
                    <p className="text-muted-foreground border-t px-3 py-2.5 text-xs leading-5">
                        {labels.missingWorkspaceHelp}
                    </p>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
