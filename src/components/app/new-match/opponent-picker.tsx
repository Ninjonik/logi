"use client"

import { ChevronsUpDown, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type { TeamGame, TeamRecord } from "@/domain/teams/team"
import { fetchTeamPage } from "@/lib/teams/team-client"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"

const LIMIT = 20

/** Searchable list of active catalogue teams of one game (the opponent). */
export function OpponentPicker({
    serverId,
    gameId,
    excludeIds,
    onPick,
    dictionary,
    label,
}: {
    serverId: string
    gameId: TeamGame
    /** Teams already in the match (your own team) are not offered. */
    excludeIds: string[]
    onPick(team: TeamRecord): void
    dictionary: Dictionary
    /** The button text; "Choose opponent" by default. */
    label?: string
}) {
    const t = dictionary.newMatch.match
    const [open, setOpen] = useState(false)
    const [search, setSearch] = useState("")
    const term = useDebouncedValue(search.trim(), 250)
    // Results remember the query they answer; a newer query reads as loading.
    const key = `${gameId}|${term}`
    const [result, setResult] = useState<{
        key: string
        teams: TeamRecord[]
        failed: boolean
    } | null>(null)

    useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        fetchTeamPage(
            serverId,
            { gameId, search: term, limit: LIMIT },
            controller.signal
        )
            .then((page) =>
                setResult({
                    key,
                    teams: page.items.filter((team) => !team.archivedAt),
                    failed: false,
                })
            )
            .catch(() => {
                if (!controller.signal.aborted)
                    setResult({ key, teams: [], failed: true })
            })
        return () => controller.abort()
    }, [gameId, key, open, serverId, term])

    const status =
        result?.key !== key ? "loading" : result.failed ? "error" : "ready"
    const listed = (result?.key === key ? result.teams : []).filter(
        (team) => !excludeIds.includes(team.id)
    )

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="h-auto min-h-[54px] w-full justify-between rounded-[10px] px-3 py-2.5 font-normal"
                >
                    <span className="text-muted-foreground">
                        {label ?? t.chooseOpponent}
                    </span>
                    <ChevronsUpDown className="size-4 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                align="start"
                className="w-[var(--radix-popover-trigger-width)] p-0"
            >
                <Command shouldFilter={false}>
                    <CommandInput
                        value={search}
                        onValueChange={setSearch}
                        placeholder={t.searchOpponent}
                    />
                    <CommandList>
                        {status === "loading" ? (
                            <p className="text-muted-foreground flex items-center gap-2 px-3 py-4 text-sm">
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden
                                />
                                {t.loadingTeams}
                            </p>
                        ) : status === "error" ? (
                            <p
                                role="alert"
                                className="text-destructive px-3 py-4 text-sm"
                            >
                                {t.teamsError}
                            </p>
                        ) : !listed.length ? (
                            <p className="text-muted-foreground px-3 py-4 text-sm">
                                {t.noTeams}
                            </p>
                        ) : (
                            <CommandGroup>
                                {listed.map((team) => (
                                    <CommandItem
                                        key={team.id}
                                        value={team.id}
                                        onSelect={() => {
                                            onPick(team)
                                            setOpen(false)
                                        }}
                                        className="gap-2"
                                    >
                                        <TeamLogo
                                            name={team.name}
                                            shortCode={team.shortCode}
                                            logoUrl={team.logoUrl}
                                            className="size-7"
                                        />
                                        <span className="min-w-0 flex-1 truncate">
                                            {team.name}
                                        </span>
                                        {team.shortCode ? (
                                            <span className="text-muted-foreground text-xs">
                                                {team.shortCode}
                                            </span>
                                        ) : null}
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        )}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
