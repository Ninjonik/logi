"use client"

import {
    matchTeamSides,
    matchTeamSlots,
    type MatchTeamAssignment,
    type MatchTeamInput,
    type MatchTeamSlot,
} from "@/domain/teams/match-teams"
import {
    fetchTeamPage,
    fetchTeamRecord,
    requestMatchTeamRefresh,
    TeamRequestError,
    type TeamErrorCode,
} from "@/lib/teams/team-client"
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
} from "@/components/ui/command"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    matchTeamSelectionIssues,
    setSlotSide,
    setSlotTeam,
} from "@/lib/teams/match-team-selection"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown, Loader2, Plus, RefreshCw } from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { TeamFormDialog } from "@/components/app/team-form-dialog"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type { TeamGame, TeamRecord } from "@/domain/teams/team"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

export type MatchTeamPickerProps = {
    serverId: string
    gameId: TeamGame
    dictionary: Dictionary
    value: MatchTeamInput[]
    onChange(value: MatchTeamInput[]): void
    /** Saved assignments; their snapshots are what the match currently shows. */
    existing?: MatchTeamAssignment[]
    /** A saved event; enables explicit snapshot refresh of saved assignments. */
    eventId?: string | null
    disabled?: boolean
    onRefreshed?(matchTeams: MatchTeamAssignment[]): void
}

type Shown = {
    teamId: string
    name: string
    shortCode: string | null
    logoUrl: string | null
    archived: boolean
}
type Message = { tone: "error" | "success"; text: string }
const NO_SIDE = "__none"

/**
 * Team slots of one native match: a searchable directory picker and an optional
 * side per slot. Saved selections show their stored snapshot; archived teams
 * stay selected until replaced.
 */
export function MatchTeamPicker({
    serverId,
    gameId,
    dictionary,
    value,
    onChange,
    existing = [],
    eventId = null,
    disabled = false,
    onRefreshed,
}: MatchTeamPickerProps) {
    const t = dictionary.teams.picker,
        id = useId()
    const [directory, setDirectory] = useState<ReadonlyMap<string, TeamRecord>>(
        () => new Map()
    )
    const [creatingSlot, setCreatingSlot] = useState<MatchTeamSlot | null>(null)
    const [refreshing, setRefreshing] = useState<string | null>(null)
    const [message, setMessage] = useState<Message | null>(null)
    const attempted = useRef(new Set<string>())
    const issues = matchTeamSelectionIssues(value)
    const sides = matchTeamSides(gameId)

    // Directory state (archive flag, current presentation) of saved and selected teams.
    const unresolved = useMemo(
        () =>
            [
                ...new Set([
                    ...existing.map((assignment) => assignment.teamId),
                    ...value.map((entry) => entry.teamId),
                ]),
            ]
                .filter((teamId) => !directory.has(teamId))
                .sort(),
        [directory, existing, value]
    )
    const unresolvedKey = unresolved.join(",")
    useEffect(() => {
        const pending = unresolvedKey
            .split(",")
            .filter((teamId) => teamId && !attempted.current.has(teamId))
        if (!pending.length) return
        const controller = new AbortController()
        async function load() {
            const found = await Promise.all(
                pending.map((teamId) =>
                    fetchTeamRecord(serverId, teamId, controller.signal).catch(
                        () => null
                    )
                )
            )
            if (controller.signal.aborted) return
            for (const teamId of pending) attempted.current.add(teamId)
            setDirectory((current) => {
                const next = new Map(current)
                for (const team of found) if (team) next.set(team.id, team)
                return next
            })
        }
        void load()
        return () => controller.abort()
    }, [serverId, unresolvedKey])

    function remember(team: TeamRecord) {
        setDirectory((current) => new Map(current).set(team.id, team))
    }

    function shown(teamId: string): Shown | null {
        const saved = existing.find(
            (assignment) => assignment.teamId === teamId
        )
        const record = directory.get(teamId)
        const archived = Boolean(record?.archivedAt)
        if (saved)
            return {
                teamId,
                name: saved.snapshot.name,
                shortCode: saved.snapshot.shortCode,
                logoUrl: saved.snapshot.logoUrl,
                archived,
            }
        return record
            ? {
                  teamId,
                  name: record.name,
                  shortCode: record.shortCode,
                  logoUrl: record.logoUrl,
                  archived,
              }
            : null
    }

    async function refresh(teamId: string) {
        if (!eventId) return
        setRefreshing(teamId)
        setMessage(null)
        try {
            const result = await requestMatchTeamRefresh(
                serverId,
                eventId,
                teamId
            )
            if (result.ok) {
                onRefreshed?.(result.matchTeams)
                setMessage({ tone: "success", text: t.snapshotRefreshed })
            } else setMessage({ tone: "error", text: t.errors[result.code] })
        } finally {
            setRefreshing(null)
        }
    }

    const savedOptions = existing
        .map((assignment) => shown(assignment.teamId))
        .filter((option): option is Shown => option !== null)

    return (
        <div
            role="group"
            aria-labelledby={`${id}-title`}
            aria-describedby={`${id}-description`}
            className="border-border/60 space-y-4 rounded-2xl border p-4"
        >
            <div className="space-y-1">
                <h3 id={`${id}-title`} className="text-sm font-semibold">
                    {t.title}
                </h3>
                <p
                    id={`${id}-description`}
                    className="text-muted-foreground text-xs"
                >
                    {t.description}
                </p>
            </div>
            <div className="space-y-4">
                {matchTeamSlots(gameId).map((slot) => {
                    const entry = value.find((item) => item.slot === slot)
                    const selection = entry ? shown(entry.teamId) : null
                    const issue = issues[slot]
                    const saved = entry
                        ? existing.some(
                              (assignment) => assignment.teamId === entry.teamId
                          )
                        : false
                    const issueId = `${id}-${slot}-issue`
                    return (
                        <div
                            key={slot}
                            className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-end"
                        >
                            <div className="min-w-0 space-y-2">
                                <Label htmlFor={`${id}-${slot}-team`}>
                                    {t.slots[slot]}
                                </Label>
                                <TeamCombobox
                                    id={`${id}-${slot}-team`}
                                    serverId={serverId}
                                    gameId={gameId}
                                    dictionary={dictionary}
                                    selectedId={entry?.teamId ?? null}
                                    selection={selection}
                                    savedOptions={savedOptions}
                                    disabled={disabled}
                                    invalid={Boolean(issue)}
                                    describedBy={issue ? issueId : undefined}
                                    onSelect={(teamId, record) => {
                                        if (record) remember(record)
                                        onChange(
                                            setSlotTeam(value, slot, teamId)
                                        )
                                    }}
                                    onAdd={() => setCreatingSlot(slot)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-${slot}-side`}>
                                    {t.side}
                                </Label>
                                <Select
                                    value={entry?.side ?? NO_SIDE}
                                    disabled={disabled || !entry}
                                    onValueChange={(side) =>
                                        onChange(
                                            setSlotSide(
                                                value,
                                                slot,
                                                side === NO_SIDE ? null : side
                                            )
                                        )
                                    }
                                >
                                    <SelectTrigger
                                        id={`${id}-${slot}-side`}
                                        className="w-full rounded-xl"
                                        aria-invalid={
                                            issue === "duplicateSide"
                                                ? true
                                                : undefined
                                        }
                                    >
                                        <SelectValue placeholder={t.noSide} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value={NO_SIDE}>
                                            {t.noSide}
                                        </SelectItem>
                                        {sides.map((side) => (
                                            <SelectItem key={side} value={side}>
                                                {side}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            {selection?.archived || (saved && eventId) ? (
                                <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
                                    {selection?.archived ? (
                                        <>
                                            <Badge variant="secondary">
                                                {dictionary.teams.archivedBadge}
                                            </Badge>
                                            <span className="text-muted-foreground text-xs">
                                                {t.archivedSelection}
                                            </span>
                                        </>
                                    ) : null}
                                    {saved && eventId && entry && !disabled ? (
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={
                                                refreshing !== null ||
                                                Boolean(selection?.archived)
                                            }
                                            aria-label={`${t.refreshSnapshot}: ${selection?.name ?? t.slots[slot]}`}
                                            onClick={() =>
                                                void refresh(entry.teamId)
                                            }
                                        >
                                            {refreshing === entry.teamId ? (
                                                <Loader2
                                                    className="size-4 animate-spin"
                                                    aria-hidden
                                                />
                                            ) : (
                                                <RefreshCw
                                                    className="size-4"
                                                    aria-hidden
                                                />
                                            )}
                                            {refreshing === entry.teamId
                                                ? t.refreshing
                                                : t.refreshSnapshot}
                                        </Button>
                                    ) : null}
                                </div>
                            ) : null}
                            {issue ? (
                                <p
                                    id={issueId}
                                    role="alert"
                                    className="text-destructive text-sm sm:col-span-2"
                                >
                                    {issue === "duplicateTeam"
                                        ? t.duplicateTeam
                                        : t.duplicateSide}
                                </p>
                            ) : null}
                        </div>
                    )
                })}
            </div>
            <div aria-live="polite">
                {message ? (
                    <p
                        role={message.tone === "error" ? "alert" : "status"}
                        className={
                            message.tone === "error"
                                ? "text-destructive text-sm"
                                : "text-muted-foreground text-sm"
                        }
                    >
                        {message.text}
                    </p>
                ) : null}
            </div>
            {disabled ? null : (
                <TeamFormDialog
                    serverId={serverId}
                    gameId={gameId}
                    dictionary={dictionary}
                    open={creatingSlot !== null}
                    onOpenChange={(open) => {
                        if (!open) setCreatingSlot(null)
                    }}
                    onSaved={(team) => {
                        remember(team)
                        if (creatingSlot)
                            onChange(setSlotTeam(value, creatingSlot, team.id))
                    }}
                />
            )}
        </div>
    )
}

type ComboboxState =
    | { status: "loading"; items: TeamRecord[] }
    | { status: "ready"; items: TeamRecord[] }
    | { status: "error"; items: TeamRecord[]; code: TeamErrorCode }

function TeamCombobox({
    id,
    serverId,
    gameId,
    dictionary,
    selectedId,
    selection,
    savedOptions,
    disabled,
    invalid,
    describedBy,
    onSelect,
    onAdd,
}: {
    id: string
    serverId: string
    gameId: TeamGame
    dictionary: Dictionary
    selectedId: string | null
    selection: Shown | null
    savedOptions: readonly Shown[]
    disabled: boolean
    invalid: boolean
    describedBy?: string
    onSelect(teamId: string | null, record?: TeamRecord): void
    onAdd(): void
}) {
    const t = dictionary.teams.picker
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const term = useDebouncedValue(query.trim(), 250)
    const [state, setState] = useState<ComboboxState>({
        status: "loading",
        items: [],
    })

    useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        async function load() {
            setState((current) => ({ status: "loading", items: current.items }))
            try {
                const page = await fetchTeamPage(
                    serverId,
                    { gameId, archived: false, search: term },
                    controller.signal
                )
                if (!controller.signal.aborted)
                    setState({ status: "ready", items: page.items })
            } catch (error) {
                if (controller.signal.aborted) return
                setState({
                    status: "error",
                    items: [],
                    code:
                        error instanceof TeamRequestError
                            ? error.code
                            : "unavailable",
                })
            }
        }
        void load()
        return () => controller.abort()
    }, [open, serverId, gameId, term])

    const active = new Set(state.items.map((team) => team.id))
    const lowered = term.toLowerCase()
    // Saved selections no longer listed as active (archived) can still be put back.
    const preserved = savedOptions.filter(
        (option) =>
            !active.has(option.teamId) &&
            option.archived &&
            (!lowered ||
                option.name.toLowerCase().includes(lowered) ||
                option.shortCode?.toLowerCase().includes(lowered))
    )

    function choose(teamId: string | null, record?: TeamRecord) {
        onSelect(teamId, record)
        setOpen(false)
    }

    return (
        <Popover
            open={open}
            onOpenChange={(next) => {
                setOpen(next)
                if (!next) setQuery("")
            }}
        >
            <PopoverTrigger asChild>
                <Button
                    id={id}
                    type="button"
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    aria-invalid={invalid || undefined}
                    aria-describedby={describedBy}
                    disabled={disabled}
                    className="h-auto w-full justify-between rounded-xl py-2"
                >
                    {selection ? (
                        <TeamOption option={selection} />
                    ) : selectedId ? (
                        <span className="text-muted-foreground truncate">
                            {t.unknownTeam}
                        </span>
                    ) : (
                        <span className="text-muted-foreground">
                            {t.noTeam}
                        </span>
                    )}
                    <ChevronsUpDown
                        className="size-4 shrink-0 opacity-50"
                        aria-hidden
                    />
                </Button>
            </PopoverTrigger>
            <PopoverContent
                className="w-[min(420px,calc(100vw-2rem))] p-0"
                align="start"
            >
                <Command shouldFilter={false} label={t.team}>
                    <CommandInput
                        value={query}
                        onValueChange={setQuery}
                        maxLength={64}
                        placeholder={t.search}
                    />
                    <CommandList>
                        <CommandGroup>
                            <CommandItem
                                value="__no-team"
                                onSelect={() => choose(null)}
                            >
                                <Check
                                    className={cn(
                                        "size-4",
                                        selectedId ? "opacity-0" : "opacity-100"
                                    )}
                                    aria-hidden
                                />
                                {t.noTeam}
                            </CommandItem>
                            {state.items.map((team) => (
                                <CommandItem
                                    key={team.id}
                                    value={team.id}
                                    onSelect={() => choose(team.id, team)}
                                >
                                    <Check
                                        className={cn(
                                            "size-4 shrink-0",
                                            selectedId === team.id
                                                ? "opacity-100"
                                                : "opacity-0"
                                        )}
                                        aria-hidden
                                    />
                                    <TeamOption
                                        option={{
                                            teamId: team.id,
                                            name: team.name,
                                            shortCode: team.shortCode,
                                            logoUrl: team.logoUrl,
                                            archived: false,
                                        }}
                                    />
                                </CommandItem>
                            ))}
                        </CommandGroup>
                        {state.status === "loading" ? (
                            <p
                                role="status"
                                className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm"
                            >
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden
                                />
                                {dictionary.teams.loading}
                            </p>
                        ) : state.status === "error" ? (
                            <p
                                role="alert"
                                className="text-destructive px-3 py-4 text-sm"
                            >
                                {dictionary.teams.errors[state.code]}
                            </p>
                        ) : state.items.length === 0 ? (
                            <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                                {t.noResults}
                            </p>
                        ) : null}
                        {preserved.length ? (
                            <CommandGroup heading={t.savedSelections}>
                                {preserved.map((option) => (
                                    <CommandItem
                                        key={option.teamId}
                                        value={`saved-${option.teamId}`}
                                        onSelect={() => choose(option.teamId)}
                                    >
                                        <Check
                                            className={cn(
                                                "size-4 shrink-0",
                                                selectedId === option.teamId
                                                    ? "opacity-100"
                                                    : "opacity-0"
                                            )}
                                            aria-hidden
                                        />
                                        <TeamOption option={option} />
                                        <Badge
                                            variant="secondary"
                                            className="ml-auto"
                                        >
                                            {dictionary.teams.archivedBadge}
                                        </Badge>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ) : null}
                        <CommandSeparator alwaysRender />
                        <CommandGroup>
                            <CommandItem
                                value="__add-team"
                                onSelect={() => {
                                    setOpen(false)
                                    setQuery("")
                                    // Let the popover release focus before the dialog traps it.
                                    setTimeout(onAdd, 0)
                                }}
                            >
                                <Plus className="size-4" aria-hidden />
                                {t.addTeam}
                            </CommandItem>
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function TeamOption({ option }: { option: Shown }) {
    return (
        <span className="flex min-w-0 items-center gap-2 text-left">
            <TeamLogo
                name={option.name}
                shortCode={option.shortCode}
                logoUrl={option.logoUrl}
                className="size-7"
            />
            <span className="flex min-w-0 flex-col">
                <span className="truncate font-medium">{option.name}</span>
                {option.shortCode ? (
                    <span className="text-muted-foreground truncate text-xs">
                        {option.shortCode}
                    </span>
                ) : null}
            </span>
        </span>
    )
}
