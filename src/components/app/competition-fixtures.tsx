"use client"

import {
    FIXTURE_PHASES,
    FIXTURE_SCORE_MAX,
    FIXTURE_STATUSES,
    type FixturePhase,
    type FixtureStatus,
} from "@/domain/competitions/competition"
import {
    CompetitionRequestError,
    fetchFixtureEventCandidates,
    type CompetitionErrorCode,
} from "@/lib/competitions/competition-client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import type {
    CompetitionFixtureView,
    CompetitionTeamView,
    FixtureEventCandidate,
} from "@/domain/competitions/admin-view"
import {
    fixtureFormInput,
    fixtureFormValues,
    type FixtureFormValues,
} from "@/lib/competitions/competition-form"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    CalendarPlus,
    Link2,
    Loader2,
    Pencil,
    Plus,
    Trash2,
} from "lucide-react"
import type { CompetitionSectionProps } from "@/components/app/competition-manager"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { useEffect, useId, useState, type FormEvent } from "react"
import { EmptyState } from "@/components/app/empty-state"
import { TeamLogo } from "@/components/app/team-logo"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

const ALL = "__all"

/** Viewer-local date and time; client-rendered, so server and browser zones may differ. */
function formatInstant(value: string | null, locale: string) {
    if (!value) return null
    const date = new Date(value)
    return Number.isNaN(date.getTime())
        ? null
        : date.toLocaleString(locale, {
              dateStyle: "medium",
              timeStyle: "short",
          })
}

function TeamCell({ team }: { team: CompetitionTeamView }) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <TeamLogo
                name={team.name}
                shortCode={team.shortCode}
                logoUrl={team.logoUrl}
                className="size-6"
            />
            <span className="truncate">{team.name}</span>
        </span>
    )
}

type DialogState =
    | { kind: "closed" }
    | { kind: "fixture"; fixture: CompetitionFixtureView | null }
    | { kind: "link"; fixture: CompetitionFixtureView }

/** Fixture table with create, edit (score, status, schedule), delete and event links. */
export function CompetitionFixtures({
    view,
    dictionary,
    run,
    pending,
    locale,
}: CompetitionSectionProps & { locale: string }) {
    const t = dictionary.competitionAdmin
    const [filter, setFilter] = useState(ALL)
    const [dialog, setDialog] = useState<DialogState>({ kind: "closed" })
    const divisionNames = new Map(
        view.divisions.map((division) => [division.id, division.name])
    )
    const shown = view.fixtures.filter(
        (fixture) => filter === ALL || fixture.divisionId === filter
    )

    return (
        <Card>
            <CardHeader className="flex-row flex-wrap items-start justify-between gap-3 space-y-0">
                <div className="space-y-1">
                    <CardTitle>{t.fixturesTitle}</CardTitle>
                    <p className="text-muted-foreground text-sm">
                        {t.fixturesDescription}
                    </p>
                </div>
                <div className="flex flex-wrap gap-2">
                    <Select value={filter} onValueChange={setFilter}>
                        <SelectTrigger className="w-44" aria-label={t.division}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={ALL}>
                                {t.allDivisions}
                            </SelectItem>
                            {view.divisions.map((division) => (
                                <SelectItem
                                    key={division.id}
                                    value={division.id}
                                >
                                    {division.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        disabled={pending || view.registrations.length < 2}
                        onClick={() =>
                            setDialog({ kind: "fixture", fixture: null })
                        }
                    >
                        <Plus className="size-4" aria-hidden />
                        {t.addFixture}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="p-0">
                {shown.length ? (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead className="pl-6">
                                    {t.division}
                                </TableHead>
                                <TableHead>{t.teamA}</TableHead>
                                <TableHead className="text-center">
                                    {t.score}
                                </TableHead>
                                <TableHead>{t.teamB}</TableHead>
                                <TableHead>{t.status}</TableHead>
                                <TableHead>{t.event}</TableHead>
                                <TableHead className="pr-6 text-right">
                                    <span className="sr-only">{t.actions}</span>
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {shown.map((fixture) => {
                                const legacy =
                                    fixture.sideA.legacy || fixture.sideB.legacy
                                const label = `${fixture.sideA.name} – ${fixture.sideB.name}`
                                return (
                                    <TableRow key={fixture.id}>
                                        <TableCell className="pl-6">
                                            <div className="text-sm">
                                                {(fixture.divisionId &&
                                                    divisionNames.get(
                                                        fixture.divisionId
                                                    )) ||
                                                    t.unassigned}
                                            </div>
                                            <div
                                                className="text-muted-foreground text-xs"
                                                suppressHydrationWarning
                                            >
                                                {t.phases[fixture.phase]}
                                                {fixture.scheduledAt
                                                    ? ` · ${formatInstant(fixture.scheduledAt, locale) ?? ""}`
                                                    : ""}
                                            </div>
                                        </TableCell>
                                        <TableCell className="max-w-48">
                                            <TeamCell team={fixture.sideA} />
                                        </TableCell>
                                        <TableCell className="text-center font-semibold tabular-nums">
                                            {fixture.scoreA ?? "–"} :{" "}
                                            {fixture.scoreB ?? "–"}
                                        </TableCell>
                                        <TableCell className="max-w-48">
                                            <TeamCell team={fixture.sideB} />
                                        </TableCell>
                                        <TableCell>
                                            <Badge
                                                variant={
                                                    fixture.status ===
                                                    "scheduled"
                                                        ? "outline"
                                                        : "secondary"
                                                }
                                            >
                                                {t.statuses[fixture.status]}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="max-w-48 text-sm">
                                            {fixture.event ? (
                                                <span className="block truncate">
                                                    {fixture.event.name}
                                                    {fixture.event.workspace
                                                        ? ` · ${fixture.event.workspace}`
                                                        : ""}
                                                </span>
                                            ) : (
                                                <span className="text-muted-foreground">
                                                    –
                                                </span>
                                            )}
                                        </TableCell>
                                        <TableCell className="pr-6 text-right whitespace-nowrap">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                aria-label={`${t.editFixture}: ${label}`}
                                                disabled={pending}
                                                onClick={() =>
                                                    setDialog({
                                                        kind: "fixture",
                                                        fixture,
                                                    })
                                                }
                                            >
                                                <Pencil className="size-4" />
                                            </Button>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                aria-label={`${t.linkEvent}: ${label}`}
                                                disabled={pending || legacy}
                                                onClick={() =>
                                                    setDialog({
                                                        kind: "link",
                                                        fixture,
                                                    })
                                                }
                                            >
                                                <Link2 className="size-4" />
                                            </Button>
                                            <ConfirmActionDialog
                                                trigger={
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        aria-label={`${t.delete}: ${label}`}
                                                        disabled={pending}
                                                    >
                                                        <Trash2 className="size-4" />
                                                    </Button>
                                                }
                                                title={t.confirmDeleteFixture}
                                                description={t.confirmDeleteFixtureDescription.replace(
                                                    "{teams}",
                                                    label
                                                )}
                                                confirmLabel={t.delete}
                                                cancelLabel={t.cancel}
                                                onConfirm={async () =>
                                                    (
                                                        await run({
                                                            action: "deleteFixture",
                                                            fixtureId:
                                                                fixture.id,
                                                        })
                                                    ).ok
                                                }
                                            />
                                        </TableCell>
                                    </TableRow>
                                )
                            })}
                        </TableBody>
                    </Table>
                ) : (
                    <div className="px-6 pb-6">
                        <EmptyState
                            icon={CalendarPlus}
                            title={t.noFixtures}
                            description={t.fixturesDescription}
                        />
                    </div>
                )}
            </CardContent>
            <Dialog
                open={dialog.kind !== "closed"}
                onOpenChange={(open) => {
                    if (!open) setDialog({ kind: "closed" })
                }}
            >
                <DialogContent className="sm:max-w-xl">
                    {dialog.kind === "fixture" ? (
                        <FixtureForm
                            view={view}
                            dictionary={dictionary}
                            run={run}
                            pending={pending}
                            fixture={dialog.fixture}
                            defaultDivisionId={
                                filter === ALL
                                    ? (view.divisions[0]?.id ?? "")
                                    : filter
                            }
                            onDone={() => setDialog({ kind: "closed" })}
                        />
                    ) : dialog.kind === "link" ? (
                        <LinkEventForm
                            dictionary={dictionary}
                            run={run}
                            pending={pending}
                            fixture={dialog.fixture}
                            locale={locale}
                            onDone={() => setDialog({ kind: "closed" })}
                        />
                    ) : null}
                </DialogContent>
            </Dialog>
        </Card>
    )
}

function FixtureForm({
    view,
    dictionary,
    run,
    pending,
    fixture,
    defaultDivisionId,
    onDone,
}: CompetitionSectionProps & {
    fixture: CompetitionFixtureView | null
    defaultDivisionId: string
    onDone(): void
}) {
    const t = dictionary.competitionAdmin
    const id = useId()
    const [values, setValues] = useState<FixtureFormValues>(() =>
        fixtureFormValues(fixture, defaultDivisionId)
    )
    const [failure, setFailure] = useState<string | null>(null)
    const set = <K extends keyof FixtureFormValues>(
        key: K,
        value: FixtureFormValues[K]
    ) => setValues((current) => ({ ...current, [key]: value }))
    // League fixtures are played inside one division; playoffs may cross divisions.
    const teams = view.registrations
        .filter(
            (row) =>
                !row.team.legacy &&
                (values.phase !== "league" ||
                    row.divisionId === values.divisionId)
        )
        .sort((a, b) => a.team.name.localeCompare(b.team.name))
    const scored = values.status !== "scheduled"

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const input = fixtureFormInput(values)
        if (!input) {
            setFailure(t.invalidFixture)
            return
        }
        setFailure(null)
        const result = await run(
            fixture
                ? { action: "updateFixture", fixtureId: fixture.id, input }
                : {
                      action: "createFixture",
                      competitionId: view.competition.id,
                      input,
                  },
            t.saved
        )
        if (result.ok) onDone()
    }

    const teamSelect = (key: "sideATeamId" | "sideBTeamId", label: string) => (
        <div className="space-y-2">
            <Label htmlFor={`${id}-${key}`}>{label}</Label>
            <Select
                value={values[key] || undefined}
                onValueChange={(value) => set(key, value)}
                disabled={pending}
            >
                <SelectTrigger id={`${id}-${key}`} className="w-full">
                    <SelectValue placeholder={t.chooseTeam} />
                </SelectTrigger>
                <SelectContent>
                    {teams.map((row) => (
                        <SelectItem key={row.team.id} value={row.team.id}>
                            {row.team.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    )

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            <DialogHeader>
                <DialogTitle>
                    {fixture ? t.editFixture : t.addFixture}
                </DialogTitle>
                <DialogDescription>{t.fixtureHelp}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor={`${id}-division`}>{t.division}</Label>
                    <Select
                        value={values.divisionId || undefined}
                        onValueChange={(value) => set("divisionId", value)}
                        disabled={pending}
                    >
                        <SelectTrigger id={`${id}-division`} className="w-full">
                            <SelectValue placeholder={t.division} />
                        </SelectTrigger>
                        <SelectContent>
                            {view.divisions.map((division) => (
                                <SelectItem
                                    key={division.id}
                                    value={division.id}
                                >
                                    {division.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-phase`}>{t.phase}</Label>
                    <Select
                        value={values.phase}
                        onValueChange={(value) =>
                            set("phase", value as FixturePhase)
                        }
                        disabled={pending}
                    >
                        <SelectTrigger id={`${id}-phase`} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {FIXTURE_PHASES.map((phase) => (
                                <SelectItem key={phase} value={phase}>
                                    {t.phases[phase]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {teamSelect("sideATeamId", t.teamA)}
                {teamSelect("sideBTeamId", t.teamB)}
                <div className="space-y-2">
                    <Label htmlFor={`${id}-scheduled`}>{t.scheduledAt}</Label>
                    <Input
                        id={`${id}-scheduled`}
                        type="datetime-local"
                        value={values.scheduledAt}
                        disabled={pending}
                        onChange={(event) =>
                            set("scheduledAt", event.target.value)
                        }
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-status`}>{t.status}</Label>
                    <Select
                        value={values.status}
                        onValueChange={(value) =>
                            set("status", value as FixtureStatus)
                        }
                        disabled={pending}
                    >
                        <SelectTrigger id={`${id}-status`} className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {FIXTURE_STATUSES.map((status) => (
                                <SelectItem key={status} value={status}>
                                    {t.statuses[status]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                {(["scoreA", "scoreB"] as const).map((key) => (
                    <div key={key} className="space-y-2">
                        <Label htmlFor={`${id}-${key}`}>{t[key]}</Label>
                        <Input
                            id={`${id}-${key}`}
                            type="number"
                            inputMode="numeric"
                            min={0}
                            max={FIXTURE_SCORE_MAX}
                            step={1}
                            value={scored ? values[key] : ""}
                            disabled={pending || !scored}
                            required={scored}
                            onChange={(event) => set(key, event.target.value)}
                        />
                    </div>
                ))}
            </div>
            {failure ? (
                <p role="alert" className="text-destructive text-sm">
                    {failure}
                </p>
            ) : null}
            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={onDone}
                >
                    {t.cancel}
                </Button>
                <Button type="submit" disabled={pending}>
                    {pending ? t.saving : t.save}
                </Button>
            </DialogFooter>
        </form>
    )
}

type CandidateState =
    | { status: "loading" }
    | { status: "ready"; events: FixtureEventCandidate[] }
    | { status: "error"; code: CompetitionErrorCode }

function LinkEventForm({
    dictionary,
    run,
    pending,
    fixture,
    locale,
    onDone,
}: Omit<CompetitionSectionProps, "view"> & {
    fixture: CompetitionFixtureView
    locale: string
    onDone(): void
}) {
    const t = dictionary.competitionAdmin
    const id = useId()
    const [state, setState] = useState<CandidateState>({ status: "loading" })
    const [eventId, setEventId] = useState(fixture.event?.id ?? "")

    useEffect(() => {
        const controller = new AbortController()
        fetchFixtureEventCandidates(fixture.id, controller.signal)
            .then((events) => {
                if (!controller.signal.aborted)
                    setState({ status: "ready", events })
            })
            .catch((error: unknown) => {
                if (!controller.signal.aborted)
                    setState({
                        status: "error",
                        code:
                            error instanceof CompetitionRequestError
                                ? error.code
                                : "unavailable",
                    })
            })
        return () => controller.abort()
    }, [fixture.id])

    async function link(next: string | null) {
        const result = await run(
            {
                action: "linkEvent",
                fixtureId: fixture.id,
                input: { eventId: next },
            },
            t.saved
        )
        if (result.ok) onDone()
    }

    return (
        <form
            className="space-y-5"
            noValidate
            onSubmit={(event) => {
                event.preventDefault()
                if (eventId.trim()) void link(eventId.trim())
            }}
        >
            <DialogHeader>
                <DialogTitle>{t.linkEventTitle}</DialogTitle>
                <DialogDescription>{t.linkEventDescription}</DialogDescription>
            </DialogHeader>
            <p className="text-sm font-medium">
                {fixture.sideA.name} – {fixture.sideB.name}
            </p>
            {fixture.event ? (
                <p className="text-muted-foreground text-sm">
                    {t.linked.replace("{name}", fixture.event.name)}
                </p>
            ) : null}
            <fieldset className="space-y-2">
                <legend className="text-sm font-medium">{t.candidates}</legend>
                {state.status === "loading" ? (
                    <p
                        role="status"
                        className="text-muted-foreground flex items-center gap-2 text-sm"
                    >
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                        {t.loadingCandidates}
                    </p>
                ) : state.status === "error" ? (
                    <p role="alert" className="text-destructive text-sm">
                        {t.errors[state.code]}
                    </p>
                ) : state.events.length ? (
                    <ul className="max-h-64 space-y-1 overflow-y-auto">
                        {state.events.map((event) => (
                            <li key={event.id}>
                                <label
                                    className={cn(
                                        "hover:bg-muted/50 flex cursor-pointer items-start gap-3 rounded-lg border p-2 text-sm",
                                        eventId === event.id &&
                                            "border-primary bg-muted/40"
                                    )}
                                >
                                    <input
                                        type="radio"
                                        name={`${id}-event`}
                                        className="mt-1"
                                        checked={eventId === event.id}
                                        onChange={() => setEventId(event.id)}
                                    />
                                    <span className="min-w-0 flex-1">
                                        <span className="block font-medium">
                                            {event.name}
                                        </span>
                                        <span
                                            className="text-muted-foreground block text-xs"
                                            suppressHydrationWarning
                                        >
                                            {event.workspace} ·{" "}
                                            {formatInstant(
                                                event.gameStart,
                                                locale
                                            ) ?? event.gameStart}
                                        </span>
                                        <span className="mt-1 flex flex-wrap gap-1">
                                            <Badge
                                                variant={
                                                    event.teamsMatch
                                                        ? "secondary"
                                                        : "outline"
                                                }
                                            >
                                                {event.teamsMatch
                                                    ? t.teamsMatch
                                                    : t.teamsUnassigned}
                                            </Badge>
                                            {event.hasResult ? (
                                                <Badge variant="outline">
                                                    {t.hasResult}
                                                </Badge>
                                            ) : null}
                                        </span>
                                    </span>
                                </label>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="text-muted-foreground text-sm">
                        {t.noCandidates}
                    </p>
                )}
            </fieldset>
            <div className="space-y-2">
                <Label htmlFor={`${id}-manual`}>{t.eventId}</Label>
                <Input
                    id={`${id}-manual`}
                    value={eventId}
                    maxLength={64}
                    spellCheck={false}
                    autoComplete="off"
                    disabled={pending}
                    aria-describedby={`${id}-manual-help`}
                    onChange={(event) => setEventId(event.target.value)}
                />
                <p
                    id={`${id}-manual-help`}
                    className="text-muted-foreground text-xs"
                >
                    {t.eventIdHelp}
                </p>
            </div>
            <DialogFooter className="gap-2">
                {fixture.event ? (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void link(null)}
                    >
                        {t.unlink}
                    </Button>
                ) : null}
                <Button
                    type="button"
                    variant="ghost"
                    disabled={pending}
                    onClick={onDone}
                >
                    {t.cancel}
                </Button>
                <Button type="submit" disabled={pending || !eventId.trim()}>
                    {t.link}
                </Button>
            </DialogFooter>
        </form>
    )
}
