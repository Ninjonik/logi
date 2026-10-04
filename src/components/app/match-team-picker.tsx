"use client"

import {
    followRefreshedTeam,
    matchTeamSelectionIssues,
    requestableTeamName,
    setSlotSide,
    setSlotTeam,
} from "@/lib/teams/match-team-selection"
import {
    fetchTeamPage,
    fetchTeamRecord,
    requestMatchTeamRefresh,
    TeamReadError,
    type TeamReadErrorCode,
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
    matchTeamSides,
    matchTeamSlots,
    type MatchTeamAssignment,
    type MatchTeamInput,
} from "@/domain/teams/match-teams"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { Check, ChevronsUpDown, Loader2, Plus, RefreshCw } from "lucide-react"
import { TeamRequestDialog } from "@/components/app/team-request-dialog"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import type { TeamGame, TeamRecord } from "@/domain/teams/team"
import { fillTeamTemplate } from "@/lib/teams/team-list"
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
    /** Merged into another catalogue team; a snapshot refresh follows the merge. */
    merged: boolean
}
type Message = { tone: "error" | "success"; text: string }
const NO_SIDE = "__none"

/**
 * Team slots of one native match: a searchable picker over the global team
 * catalogue and an optional side per slot. Saved selections show their stored
 * snapshot; archived (and merged) teams stay selected until replaced. A team
 * missing from the catalogue is requested instead of created; it becomes
 * selectable once a global administrator approves it.
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
    // The new-team request opened from a slot's picker, prefilled with the typed name.
    const [request, setRequest] = useState<{
        open: boolean
        name: string
    } | null>(null)
    const [refreshing, setRefreshing] = useState<string | null>(null)
    const [message, setMessage] = useState<Message | null>(null)
    const attempted = useRef(new Set<string>())
    const issues = matchTeamSelectionIssues(value)
    const sides = matchTeamSides(gameId)

    // Catalogue state (archive flag, current presentation) of saved and selected teams.
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
        const archived = Boolean(record?.archivedAt),
            merged = Boolean(record?.mergedIntoTeamId)
        if (saved)
            return {
                teamId,
                name: saved.snapshot.name,
                shortCode: saved.snapshot.shortCode,
                logoUrl: saved.snapshot.logoUrl,
                archived,
                merged,
            }
        return record
            ? {
                  teamId,
                  name: record.name,
                  shortCode: record.shortCode,
                  logoUrl: record.logoUrl,
                  archived,
                  merged,
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
                // A merged team's refresh re-points the slot at the surviving team.
                onChange(
                    followRefreshedTeam(
                        value,
                        teamId,
                        existing,
                        result.matchTeams
                    )
                )
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
                                    onRequest={(name) => {
                                        setMessage(null)
                                        setRequest({ open: true, name })
                                    }}
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
                                                {selection.merged
                                                    ? t.mergedBadge
                                                    : dictionary.teams
                                                          .archivedBadge}
                                            </Badge>
                                            <span className="text-muted-foreground text-xs">
                                                {selection.merged
                                                    ? t.mergedSelection
                                                    : t.archivedSelection}
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
                                                Boolean(
                                                    selection?.archived &&
                                                    !selection.merged
                                                )
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
            {disabled || !request ? null : (
                <TeamRequestDialog
                    serverId={serverId}
                    dictionary={dictionary}
                    open={request.open}
                    target={{ kind: "create", gameId }}
                    initialName={request.name}
                    onOpenChange={(open) =>
                        setRequest((current) =>
                            current ? { ...current, open } : current
                        )
                    }
                    onSubmitted={() =>
                        setMessage({ tone: "success", text: t.requestSent })
                    }
                />
            )}
        </div>
    )
}

type ComboboxState =
    | { status: "loading"; items: TeamRecord[] }
    | { status: "ready"; items: TeamRecord[] }
    | { status: "error"; items: TeamRecord[]; code: TeamReadErrorCode }

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
    onRequest,
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
    /** Opens a new-team request for the typed name (empty when none is requestable). */
    onRequest(name: string): void
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
                    { gameId, search: term },
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
                        error instanceof TeamReadError
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

    // A typed name no listed team carries can be requested by that name.
    const requestable = requestableTeamName(query, state.items)

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
                                            merged: false,
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
                                            {option.merged
                                                ? t.mergedBadge
                                                : dictionary.teams
                                                      .archivedBadge}
                                        </Badge>
                                    </CommandItem>
                                ))}
                            </CommandGroup>
                        ) : null}
                        <CommandSeparator alwaysRender />
                        <CommandGroup>
                            <CommandItem
                                value="__request-team"
                                onSelect={() => {
                                    const name = requestable ?? ""
                                    setOpen(false)
                                    setQuery("")
                                    // Let the popover release focus before the dialog traps it.
                                    setTimeout(() => onRequest(name), 0)
                                }}
                            >
                                <Plus
                                    className="size-4 shrink-0 self-start"
                                    aria-hidden
                                />
                                <span className="flex min-w-0 flex-col">
                                    <span className="truncate">
                                        {requestable
                                            ? fillTeamTemplate(t.requestNamed, {
                                                  name: requestable,
                                              })
                                            : t.requestTeam}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        {t.requestHint}
                                    </span>
                                </span>
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
