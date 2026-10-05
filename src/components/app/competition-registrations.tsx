"use client"

import {
    CompetitionRequestError,
    searchCompetitionTeams,
    type CompetitionErrorCode,
} from "@/lib/competitions/competition-client"
import {
    Command,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
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
import type { CompetitionSectionProps } from "@/components/app/competition-manager"
import type { CompetitionRegistrationView } from "@/domain/competitions/admin-view"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { TEAM_SEARCH_MAX, type TeamRecord } from "@/domain/teams/team"
import { ChevronsUpDown, Loader2, Plus, Trash2 } from "lucide-react"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { useEffect, useId, useState } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

const NO_DIVISION = "__none"

/** Register catalogue teams per division, move, withdraw, reinstate and remove them. */
export function CompetitionRegistrations({
    view,
    dictionary,
    run,
    pending,
}: CompetitionSectionProps) {
    const t = dictionary.competitionAdmin
    const id = useId()
    const [team, setTeam] = useState<TeamRecord | null>(null)
    const [divisionId, setDivisionId] = useState(view.divisions[0]?.id ?? "")
    const registered = new Set(view.registrations.map((row) => row.team.id))
    const division =
        view.divisions.find((row) => row.id === divisionId)?.id ??
        view.divisions[0]?.id ??
        ""
    const groups = [
        ...view.divisions.map((row) => ({ id: row.id, name: row.name })),
        { id: NO_DIVISION, name: t.unassigned },
    ]
        .map((group) => ({
            ...group,
            rows: view.registrations
                .filter((row) => (row.divisionId ?? NO_DIVISION) === group.id)
                .sort((a, b) => a.team.name.localeCompare(b.team.name)),
        }))
        .filter((group) => group.id !== NO_DIVISION || group.rows.length)

    async function register() {
        if (!team || !division) return
        const result = await run({
            action: "registerTeam",
            competitionId: view.competition.id,
            input: { teamId: team.id, divisionId: division },
        })
        if (result.ok) setTeam(null)
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{t.teamsTitle}</CardTitle>
                <p className="text-muted-foreground text-sm">
                    {t.teamsDescription}
                </p>
            </CardHeader>
            <CardContent className="space-y-6">
                {view.divisions.length ? (
                    <div className="grid gap-3 rounded-xl border p-3 md:grid-cols-[minmax(0,1fr)_14rem_auto] md:items-end">
                        <div className="min-w-0 space-y-2">
                            <Label htmlFor={`${id}-team`}>{t.team}</Label>
                            <CatalogueTeamPicker
                                id={`${id}-team`}
                                competitionId={view.competition.id}
                                dictionary={dictionary}
                                value={team}
                                registered={registered}
                                disabled={pending}
                                onChange={setTeam}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor={`${id}-division`}>
                                {t.division}
                            </Label>
                            <Select
                                value={division}
                                onValueChange={setDivisionId}
                                disabled={pending}
                            >
                                <SelectTrigger
                                    id={`${id}-division`}
                                    className="w-full"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {view.divisions.map((row) => (
                                        <SelectItem key={row.id} value={row.id}>
                                            {row.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button
                            disabled={pending || !team}
                            onClick={() => void register()}
                        >
                            <Plus className="size-4" aria-hidden />
                            {t.register}
                        </Button>
                    </div>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {t.addDivisionFirst}
                    </p>
                )}
                {groups.map((group) => (
                    <section key={group.id} className="space-y-2">
                        <h3 className="text-sm font-semibold">{group.name}</h3>
                        {group.rows.length ? (
                            <ul className="divide-y rounded-xl border">
                                {group.rows.map((row) => (
                                    <RegistrationRow
                                        key={row.id}
                                        row={row}
                                        divisions={view.divisions}
                                        hasFixtures={view.fixtures.some(
                                            (fixture) =>
                                                fixture.sideA.id ===
                                                    row.team.id ||
                                                fixture.sideB.id === row.team.id
                                        )}
                                        dictionary={dictionary}
                                        run={run}
                                        pending={pending}
                                    />
                                ))}
                            </ul>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {t.noTeams}
                            </p>
                        )}
                    </section>
                ))}
            </CardContent>
        </Card>
    )
}

function RegistrationRow({
    row,
    divisions,
    hasFixtures,
    dictionary,
    run,
    pending,
}: {
    row: CompetitionRegistrationView
    divisions: CompetitionSectionProps["view"]["divisions"]
    hasFixtures: boolean
    dictionary: Dictionary
    run: CompetitionSectionProps["run"]
    pending: boolean
}) {
    const t = dictionary.competitionAdmin
    const locked = pending || row.team.legacy
    return (
        <li className="flex flex-wrap items-center gap-3 p-3">
            <TeamLogo
                name={row.team.name}
                shortCode={row.team.shortCode}
                logoUrl={row.team.logoUrl}
                className="size-8"
            />
            <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{row.team.name}</p>
                <div className="flex flex-wrap gap-1">
                    {row.withdrawn ? (
                        <Badge variant="secondary">{t.withdrawnBadge}</Badge>
                    ) : null}
                    {row.team.archived ? (
                        <Badge variant="outline">{t.archivedBadge}</Badge>
                    ) : null}
                    {row.team.legacy ? (
                        <Badge variant="outline">{t.legacyBadge}</Badge>
                    ) : null}
                </div>
            </div>
            <Select
                value={row.divisionId ?? NO_DIVISION}
                disabled={locked}
                onValueChange={(divisionId) => {
                    if (divisionId !== NO_DIVISION)
                        void run({
                            action: "updateRegistration",
                            registrationId: row.id,
                            input: { divisionId },
                        })
                }}
            >
                <SelectTrigger
                    className="w-44"
                    aria-label={`${t.moveTo}: ${row.team.name}`}
                >
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {row.divisionId ? null : (
                        <SelectItem value={NO_DIVISION}>
                            {t.unassigned}
                        </SelectItem>
                    )}
                    {divisions.map((division) => (
                        <SelectItem key={division.id} value={division.id}>
                            {division.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
            <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={() =>
                    void run({
                        action: "updateRegistration",
                        registrationId: row.id,
                        input: { withdrawn: !row.withdrawn },
                    })
                }
            >
                {row.withdrawn ? t.reinstate : t.withdraw}
            </Button>
            <Button
                size="icon"
                variant="ghost"
                aria-label={`${t.remove}: ${row.team.name}`}
                disabled={pending || hasFixtures}
                title={
                    hasFixtures ? t.errors.registration_has_fixtures : undefined
                }
                onClick={() => {
                    if (
                        window.confirm(
                            t.confirmRemoveTeam.replace("{name}", row.team.name)
                        )
                    )
                        void run({
                            action: "removeRegistration",
                            registrationId: row.id,
                        })
                }}
            >
                <Trash2 className="size-4" />
            </Button>
        </li>
    )
}

type SearchState =
    | { status: "loading"; items: TeamRecord[] }
    | { status: "ready"; items: TeamRecord[] }
    | { status: "error"; items: TeamRecord[]; code: CompetitionErrorCode }

/** Searchable picker over active catalogue teams of the competition's game. */
function CatalogueTeamPicker({
    id,
    competitionId,
    dictionary,
    value,
    registered,
    disabled,
    onChange,
}: {
    id: string
    competitionId: string
    dictionary: Dictionary
    value: TeamRecord | null
    registered: ReadonlySet<string>
    disabled: boolean
    onChange(team: TeamRecord | null): void
}) {
    const t = dictionary.competitionAdmin
    const [open, setOpen] = useState(false)
    const [query, setQuery] = useState("")
    const term = useDebouncedValue(query.trim(), 250)
    const [state, setState] = useState<SearchState>({
        status: "loading",
        items: [],
    })

    useEffect(() => {
        if (!open) return
        const controller = new AbortController()
        async function load() {
            setState((current) => ({ status: "loading", items: current.items }))
            try {
                const items = await searchCompetitionTeams(
                    competitionId,
                    term,
                    controller.signal
                )
                if (!controller.signal.aborted)
                    setState({ status: "ready", items })
            } catch (error) {
                if (controller.signal.aborted) return
                setState({
                    status: "error",
                    items: [],
                    code:
                        error instanceof CompetitionRequestError
                            ? error.code
                            : "unavailable",
                })
            }
        }
        void load()
        return () => controller.abort()
    }, [open, competitionId, term])

    const available = state.items.filter((team) => !registered.has(team.id))

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
                    disabled={disabled}
                    className="h-auto w-full justify-between py-2"
                >
                    {value ? (
                        <span className="flex min-w-0 items-center gap-2">
                            <TeamLogo
                                name={value.name}
                                shortCode={value.shortCode}
                                logoUrl={value.logoUrl}
                                className="size-6"
                            />
                            <span className="truncate">{value.name}</span>
                        </span>
                    ) : (
                        <span className="text-muted-foreground">
                            {t.chooseTeam}
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
                        maxLength={TEAM_SEARCH_MAX}
                        placeholder={t.searchTeams}
                    />
                    <CommandList>
                        <CommandGroup>
                            {available.map((team) => (
                                <CommandItem
                                    key={team.id}
                                    value={team.id}
                                    onSelect={() => {
                                        onChange(team)
                                        setOpen(false)
                                    }}
                                >
                                    <TeamLogo
                                        name={team.name}
                                        shortCode={team.shortCode}
                                        logoUrl={team.logoUrl}
                                        className="size-6"
                                    />
                                    <span className="truncate">
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
                        {state.status === "loading" ? (
                            <p
                                role="status"
                                className="text-muted-foreground flex items-center justify-center gap-2 py-4 text-sm"
                            >
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden
                                />
                                {t.loadingTeams}
                            </p>
                        ) : state.status === "error" ? (
                            <p
                                role="alert"
                                className="text-destructive px-3 py-4 text-sm"
                            >
                                {t.errors[state.code]}
                            </p>
                        ) : available.length === 0 ? (
                            <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                                {t.noTeamResults}
                            </p>
                        ) : null}
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
