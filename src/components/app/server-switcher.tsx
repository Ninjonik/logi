"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Check, ChevronsUpDown, LayoutGrid } from "lucide-react"
import * as React from "react"
import Link from "next/link"

import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    DEFAULT_GAME_ID,
    GAME_LABELS,
    isGameId,
    type GameId,
} from "@/domain/games/game"
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
import type { Guild } from "@/types/domain"
import { initialsOf } from "@/lib/initials"
import type { Locale } from "@/i18n/config"
import { cn } from "@/lib/utils"

/**
 * The clan switcher at the top of the sidebar (design AppSidebar): the clan's
 * picture and name with the games in view underneath. It opens a search over
 * the person's clans and, inside a clan, the choice of game.
 */
export function ServerSwitcher({
    locale,
    servers,
    activeServerId,
    enabledGames,
    labels,
}: {
    locale: Locale
    servers: Guild[]
    activeServerId?: string
    /** Games of the open clan; the game choice is offered when it has any. */
    enabledGames?: GameId[]
    labels: {
        selectWorkspace: string
        noWorkspaceSelected: string
        searchWorkspace: string
        noMatchingResults: string
        missingWorkspaceHelp: string
        showAllResults: string
        allClans: string
        allGames: string
        gameHeading: string
        clanHeading: string
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
    const games = activeServer
        ? (enabledGames ?? [DEFAULT_GAME_ID])
        : ([] as GameId[])
    const requestedGame = searchParams.get("game")
    const selectedGame =
        isGameId(requestedGame) && games.includes(requestedGame)
            ? requestedGame
            : "all"

    const rankedServers = React.useMemo(
        () => rankWorkspaces(servers, query),
        [query, servers]
    )
    const visibleServers = showAll
        ? rankedServers
        : rankedServers.slice(0, WORKSPACE_SWITCHER_PREVIEW)
    const hiddenCount = rankedServers.length - visibleServers.length
    const clanListHref = `/${locale}/dashboard?${CLAN_LIST_QUERY.key}=${CLAN_LIST_QUERY.value}`

    function gameHref(game: GameId | "all") {
        const params = new URLSearchParams(searchParams.toString())
        if (game === "all") params.delete("game")
        else params.set("game", game)
        const search = params.toString()
        return `${pathname}${search ? `?${search}` : ""}`
    }

    function close() {
        setOpen(false)
        setQuery("")
        setShowAll(false)
    }

    const scopeLabel = activeServer
        ? selectedGame === "all"
            ? games.length === 1
                ? GAME_LABELS[games[0]]
                : labels.allGames
            : GAME_LABELS[selectedGame]
        : labels.noWorkspaceSelected

    return (
        <Popover
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) setOpen(true)
                else close()
            }}
        >
            <PopoverTrigger asChild>
                <button
                    id="onboarding-workspace-switcher"
                    type="button"
                    className="hover:bg-sidebar-accent focus-visible:ring-sidebar-ring data-[state=open]:bg-sidebar-accent flex w-full items-center gap-2 rounded-lg p-2 text-left text-sm outline-hidden focus-visible:ring-2"
                >
                    <Avatar className="size-8 rounded-lg">
                        <AvatarImage
                            src={activeServer?.avatar}
                            alt=""
                            className="rounded-lg"
                        />
                        <AvatarFallback className="bg-primary text-primary-foreground rounded-lg text-[13px] font-semibold">
                            {initialsOf(activeServer?.name, "L")}
                        </AvatarFallback>
                    </Avatar>
                    <span className="flex min-w-0 flex-1 flex-col leading-[18px]">
                        <span className="truncate font-semibold">
                            {activeServer?.name ?? labels.selectWorkspace}
                        </span>
                        <span className="text-muted-foreground truncate text-xs">
                            {scopeLabel}
                        </span>
                    </span>
                    <ChevronsUpDown
                        aria-hidden="true"
                        className="size-4 shrink-0"
                    />
                </button>
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
                    <CommandList className="max-h-[min(26rem,60dvh)]">
                        <CommandEmpty>{labels.noMatchingResults}</CommandEmpty>
                        {games.length > 1 && !query ? (
                            <>
                                <CommandGroup heading={labels.gameHeading}>
                                    {(["all", ...games] as const).map(
                                        (game) => {
                                            const target = gameHref(game)
                                            return (
                                                <CommandItem
                                                    key={game}
                                                    value={`__game-${game}`}
                                                    onSelect={() => {
                                                        close()
                                                        router.push(target)
                                                    }}
                                                    asChild
                                                >
                                                    <Link
                                                        href={target}
                                                        onClick={close}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <span className="flex-1">
                                                            {game === "all"
                                                                ? labels.allGames
                                                                : GAME_LABELS[
                                                                      game
                                                                  ]}
                                                        </span>
                                                        <Check
                                                            aria-hidden="true"
                                                            className={cn(
                                                                "size-4",
                                                                selectedGame ===
                                                                    game
                                                                    ? "opacity-100"
                                                                    : "opacity-0"
                                                            )}
                                                        />
                                                    </Link>
                                                </CommandItem>
                                            )
                                        }
                                    )}
                                </CommandGroup>
                                <CommandSeparator />
                            </>
                        ) : null}
                        <CommandGroup heading={labels.clanHeading}>
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
                                        value={server.id}
                                        onSelect={() => {
                                            close()
                                            router.push(target)
                                        }}
                                        onMouseEnter={() =>
                                            router.prefetch(target)
                                        }
                                        asChild
                                    >
                                        <Link
                                            href={target}
                                            prefetch
                                            onClick={close}
                                            className="flex items-center gap-3"
                                        >
                                            <Avatar className="size-8 rounded-lg">
                                                <AvatarImage
                                                    src={server.avatar}
                                                    alt=""
                                                    className="rounded-lg"
                                                />
                                                <AvatarFallback className="rounded-lg text-xs font-semibold">
                                                    {initialsOf(server.name)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0 flex-1">
                                                <div className="truncate font-medium">
                                                    {server.name}
                                                </div>
                                                {server.description ? (
                                                    <div className="text-muted-foreground truncate text-xs">
                                                        {server.description}
                                                    </div>
                                                ) : null}
                                            </div>
                                            <Check
                                                aria-hidden="true"
                                                className={cn(
                                                    "size-4",
                                                    selectedServerId ===
                                                        server.id
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
                        </CommandGroup>
                    </CommandList>
                    <div className="border-t p-1">
                        <Link
                            href={clanListHref}
                            onClick={close}
                            className="hover:bg-accent hover:text-accent-foreground flex items-center gap-2 rounded-sm px-2 py-2 text-sm font-medium"
                        >
                            <LayoutGrid aria-hidden="true" className="size-4" />
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
