"use client"
import {
    ArrowRight,
    Check,
    Copy,
    Loader2,
    Plus,
    Server,
    Users,
} from "lucide-react"
import { getLeagueMessages, type LeagueMessages } from "@/i18n/messages/leagues"
import type { LeagueCommand, LeaguePortalView } from "@/domain/leagues/portal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getTeamManagementMessages } from "@/i18n/messages/team-management"
import type { PublicCompetition } from "@/domain/competitions/competition"
import { useRef, useState, useTransition, type FormEvent } from "react"
import { TeamWorkspaceLinks } from "./team-workspace-links"
import { TeamProfileEditor } from "./team-profile-editor"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { useRouter } from "next/navigation"
import type { Locale } from "@/i18n/config"
import Link from "next/link"
import { z } from "zod"
const resultSchema = z.union([
    z.object({ ok: z.literal(true), registrationError: z.string().optional() }),
    z.object({ error: z.string() }),
])
const selectClass =
    "flex h-10 w-full rounded-md border bg-background px-3 text-sm"
function errorMessage(code: string, t: LeagueMessages) {
    if (code === "forbidden" || code === "team_not_owned") return t.forbidden
    if (code === "revision_conflict") return t.error
    if (code === "duplicate_name") return t.duplicate
    if (code === "minimum_players") return t.minimumError
    if (code === "registration_closed") return t.closed
    if (code === "server_unavailable") return t.unavailable
    if (code === "hosting_locked" || code === "result_locked") return t.locked
    if (code === "manual_scores_external_only") return t.manualOnly
    if (code === "not_found") return t.notFound
    if (code.endsWith("limit") || code === "limit_reached") return t.limit
    if (code === "invalid_input" || code === "invalid_scores") return t.invalid
    return t.error
}
type Run = (input: LeagueCommand) => Promise<boolean>
export function LeagueAccount({
    view,
    competition,
    locale,
    invite,
    workspaceGuildId,
}: {
    view: LeaguePortalView
    competition: PublicCompetition | null
    locale: Locale
    invite?: string
    workspaceGuildId?: string
}) {
    const t = getLeagueMessages(locale),
        router = useRouter()
    const [busy, setBusy] = useState(false),
        [refreshing, startTransition] = useTransition(),
        [message, setMessage] = useState<string | null>(null),
        [failed, setFailed] = useState(false)
    const m = getTeamManagementMessages(locale)
    const visibleTeams = workspaceGuildId
        ? view.teams.filter((team) => team.linkedGuildId === workspaceGuildId)
        : view.teams
    const pending = busy || refreshing
    const owned = view.teams.filter(
        (team) =>
            team.owner && (!competition || team.gameId === competition.gameId)
    )
    async function run(input: LeagueCommand) {
        setBusy(true)
        setMessage(null)
        setFailed(false)
        try {
            const response = await fetch("/api/v1/me/leagues", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(input),
            })
            const parsed = resultSchema.safeParse(await response.json())
            if (!response.ok || !parsed.success || "error" in parsed.data) {
                setFailed(true)
                const code =
                    parsed.success && "error" in parsed.data
                        ? parsed.data.error
                        : "unavailable"
                setMessage(
                    code === "revision_conflict"
                        ? m.stale
                        : errorMessage(code, t)
                )
                return false
            }
            const registrationError = parsed.data.registrationError
            setFailed(Boolean(registrationError))
            setMessage(
                registrationError === "minimum_players"
                    ? m.createdNeedsPlayers
                    : registrationError
                      ? m.createdRegistrationFailed
                      : input.action === "createAndEnroll"
                        ? m.teamCreated
                        : t.done
            )
            startTransition(() => router.refresh())
            return true
        } catch {
            setFailed(true)
            setMessage(t.error)
            return false
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="space-y-8">
            {message && (
                <p
                    role={failed ? "alert" : "status"}
                    className={`rounded-xl border p-4 text-sm ${failed ? "border-destructive/30 text-destructive" : "border-emerald-500/30 text-emerald-700 dark:text-emerald-400"}`}
                >
                    {message}
                </p>
            )}
            {invite && (
                <JoinTeam initial={invite} t={t} run={run} pending={pending} />
            )}

            {competition && (
                <section className="bg-card rounded-2xl border p-6">
                    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
                        <div>
                            <p className="text-muted-foreground text-xs font-medium tracking-wider uppercase">
                                {competition.season} ·{" "}
                                {GAME_LABELS[competition.gameId]}
                            </p>
                            <h2 className="mt-1 text-2xl font-semibold">
                                {competition.name}
                            </h2>
                            <p className="text-muted-foreground mt-3 text-sm">
                                {t[competition.registrationMode ?? "closed"]} ·{" "}
                                {competition.minimumLinkedPlayers
                                    ? t.minimum.replace(
                                          "{count}",
                                          String(
                                              competition.minimumLinkedPlayers
                                          )
                                      )
                                    : t.noMinimum}
                            </p>
                        </div>
                        <Button asChild variant="outline">
                            <Link
                                href={`/${locale}/leagues/${competition.slug}`}
                            >
                                {t.back}
                                <ArrowRight className="size-4" />
                            </Link>
                        </Button>
                    </div>
                    <p className="text-muted-foreground mb-4 text-sm leading-6">
                        {t.registerHint}
                    </p>
                    {!owned.length && (
                        <p className="rounded-lg border border-dashed p-4 text-sm">
                            {t.noTeams}
                        </p>
                    )}
                    <ul className="space-y-3">
                        {owned.map((team) => {
                            const registration = view.registrations.find(
                                (row) =>
                                    row.competitionId === competition.id &&
                                    row.teamId === team.id
                            )
                            const enrolled =
                                registration &&
                                !registration.withdrawn &&
                                registration.status !== "rejected"
                            const blocked =
                                (competition.registrationMode ?? "closed") ===
                                    "closed" ||
                                team.members <
                                    (competition.minimumLinkedPlayers ?? 0)
                            return (
                                <li
                                    key={team.id}
                                    className="flex flex-wrap items-center gap-3 rounded-xl border p-4"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="font-semibold">
                                            {team.name}
                                        </p>
                                        <p className="text-muted-foreground mt-1 text-xs">
                                            {t.members.replace(
                                                "{count}",
                                                String(team.members)
                                            )}
                                        </p>
                                    </div>
                                    {registration && (
                                        <span className="bg-muted rounded-md px-2.5 py-1 text-xs font-medium">
                                            {
                                                t[
                                                    registration.withdrawn
                                                        ? "withdrawn"
                                                        : registration.status
                                                ]
                                            }
                                        </span>
                                    )}
                                    <Button
                                        disabled={
                                            pending || (!enrolled && blocked)
                                        }
                                        variant={
                                            enrolled ? "outline" : "default"
                                        }
                                        onClick={() => {
                                            if (
                                                enrolled &&
                                                !window.confirm(
                                                    t.confirmWithdraw
                                                )
                                            )
                                                return
                                            void run({
                                                action: enrolled
                                                    ? "withdraw"
                                                    : "enroll",
                                                teamId: team.id,
                                                competitionId: competition.id,
                                            })
                                        }}
                                    >
                                        {pending ? (
                                            <Loader2 className="size-4 animate-spin" />
                                        ) : null}
                                        {enrolled ? t.withdraw : t.register}
                                    </Button>
                                </li>
                            )
                        })}
                    </ul>
                </section>
            )}
            {!workspaceGuildId && (
                <div className="flex flex-wrap items-center gap-3 rounded-xl border p-4">
                    <Button asChild variant="outline">
                        <Link href={`/${locale}/leagues`}>{t.browse}</Link>
                    </Button>
                    <p className="text-muted-foreground text-sm">
                        {t.browseHint}
                    </p>
                </div>
            )}
            {!workspaceGuildId && (
                <p className="text-muted-foreground text-sm leading-6">
                    {t.playerSteps}
                </p>
            )}
            <div
                className={
                    workspaceGuildId && visibleTeams.length
                        ? "space-y-6"
                        : "grid items-start gap-6 lg:grid-cols-[1.2fr_1fr]"
                }
            >
                <section className="space-y-4">
                    <div>
                        <h2 className="text-xl font-semibold">
                            {workspaceGuildId ? m.title : t.accountTitle}
                        </h2>
                    </div>
                    {visibleTeams.map((team) => (
                        <TeamCard
                            key={`${team.id}-${team.revision}`}
                            team={team}
                            locale={locale}
                            t={t}
                            view={view}
                            run={run}
                            pending={pending}
                        />
                    ))}
                    {!visibleTeams.length && (
                        <div className="text-muted-foreground rounded-xl border border-dashed p-8 text-center text-sm">
                            <Users className="mx-auto mb-3 size-6" />
                            {workspaceGuildId ? m.noClanTeam : t.noTeams}
                        </div>
                    )}
                </section>
                <div className="space-y-5">
                    {!invite && (!workspaceGuildId || !visibleTeams.length) && (
                        <CreateTeam
                            competition={competition}
                            guildId={workspaceGuildId}
                            locale={locale}
                            t={t}
                            run={run}
                            pending={pending}
                        />
                    )}
                    {workspaceGuildId && !visibleTeams.length && (
                        <TeamWorkspaceLinks
                            view={view}
                            locale={locale}
                            guildId={workspaceGuildId}
                        />
                    )}
                    {!invite && !workspaceGuildId && (
                        <JoinTeam
                            initial=""
                            t={t}
                            run={run}
                            pending={pending}
                        />
                    )}
                </div>
            </div>
            {competition && (
                <section className="space-y-5">
                    <h2 className="text-2xl font-semibold">{t.fixtureTitle}</h2>
                    {!view.fixtures.length && (
                        <p className="text-muted-foreground rounded-xl border border-dashed p-6 text-sm">
                            {t.noFixtures}
                        </p>
                    )}
                    {view.fixtures.map((fixture) => (
                        <FixtureManager
                            key={`${fixture.id}-${fixture.host?.kind ?? "none"}-${fixture.status}`}
                            fixture={fixture}
                            view={view}
                            competition={competition}
                            t={t}
                            run={run}
                            pending={pending}
                            locale={locale}
                        />
                    ))}
                </section>
            )}
        </div>
    )
}
function TeamCard({
    team,
    locale,
    t,
    view,
    run,
    pending,
}: {
    run: Run
    pending: boolean
    view: LeaguePortalView
    team: LeaguePortalView["teams"][number]
    locale: Locale
    t: LeagueMessages
}) {
    const m = getTeamManagementMessages(locale)
    const entries = view.registrations.filter(
        (row) => row.teamId === team.id && row.competitionSlug
    )
    const [copied, setCopied] = useState(false),
        [copyError, setCopyError] = useState(false)
    return (
        <article className="bg-card rounded-xl border p-5">
            <div className="flex items-start gap-3">
                <Avatar className="size-14 rounded-xl">
                    <AvatarImage src={team.logoUrl ?? undefined} alt="" />
                    <AvatarFallback>
                        {team.shortCode ?? team.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h3 className="font-semibold">
                        {team.name}{" "}
                        {team.shortCode && (
                            <span className="text-muted-foreground ml-2 text-xs">
                                {team.shortCode}
                            </span>
                        )}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                        {team.gameId === "wardogs"
                            ? "Wardogs"
                            : "Hell Let Loose"}{" "}
                        · {team.clanLinked ? t.clanLinked : t.basic}
                    </p>
                </div>
                <span className="ml-auto rounded-md border px-2 py-1 text-xs">
                    {team.accountOwner
                        ? t.owner
                        : team.owner
                          ? m.clanAdministrator
                          : t.member}
                </span>
            </div>
            <p className="text-muted-foreground mt-4 flex items-center gap-2 text-sm">
                <Users className="size-4" />
                {t.members.replace("{count}", String(team.members))}
            </p>
            {team.description && (
                <p className="text-muted-foreground mt-3 text-sm">
                    {team.description}
                </p>
            )}
            {team.owner && (
                <div className="mt-4">
                    <TeamProfileEditor
                        team={team}
                        locale={locale}
                        run={run}
                        pending={pending}
                    />
                </div>
            )}
            <section className="mt-5 space-y-3 border-t pt-4">
                <h4 className="font-medium">{m.entries}</h4>
                {!entries.length && (
                    <p className="text-muted-foreground text-sm">
                        {m.noEntries}
                    </p>
                )}
                {entries.map((entry) => (
                    <Link
                        key={entry.competitionId}
                        className="hover:bg-muted/50 flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
                        href={`/${locale}/leagues/${entry.competitionSlug}/join`}
                    >
                        <span>
                            {entry.competitionName}{" "}
                            <span className="text-muted-foreground">
                                {entry.season}
                            </span>
                        </span>
                        <span>
                            {t[entry.withdrawn ? "withdrawn" : entry.status]}
                        </span>
                    </Link>
                ))}
                <Button asChild variant="outline" size="sm">
                    <Link href={`/${locale}/leagues`}>
                        {m.browseCompetitions}
                    </Link>
                </Button>
            </section>
            {team.accountOwner && !team.clanLinked && (
                <details className="mt-5 border-t pt-4">
                    <summary className="cursor-pointer font-medium">
                        {m.connection}
                    </summary>
                    <p className="text-muted-foreground my-3 text-sm">
                        {m.connectionHint}
                    </p>
                    <TeamWorkspaceLinks
                        view={{ ...view, teams: [team] }}
                        locale={locale}
                        compact
                    />
                </details>
            )}
            {team.linkedGuildId &&
                (() => {
                    const workspace = view.workspaces.find(
                        (w) => w.guildId === team.linkedGuildId
                    )
                    return workspace ? (
                        <Button asChild variant="outline" className="mt-4">
                            <Link
                                href={`/${locale}/dashboard/servers/${workspace.workspaceId}/competitions`}
                            >
                                {t.linkedWorkspace}: {workspace.name}
                            </Link>
                        </Button>
                    ) : null
                })()}
            {team.inviteToken && (
                <div className="mt-4 border-t pt-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={async () => {
                            try {
                                await navigator.clipboard.writeText(
                                    `${window.location.origin}/${locale}/league-teams?invite=${team.inviteToken}`
                                )
                                setCopied(true)
                                setCopyError(false)
                            } catch {
                                setCopyError(true)
                            }
                        }}
                    >
                        {copied ? (
                            <Check className="size-3.5" />
                        ) : (
                            <Copy className="size-3.5" />
                        )}
                        {copied ? t.copied : t.copy}
                    </Button>
                    <p className="text-muted-foreground mt-2 text-xs leading-5">
                        {t.inviteHint}
                    </p>
                    {copyError && (
                        <p
                            role="alert"
                            className="text-destructive mt-2 text-xs"
                        >
                            {t.error}
                        </p>
                    )}
                </div>
            )}
        </article>
    )
}
function CreateTeam({
    competition,
    guildId,
    locale,
    t,
    run,
    pending,
}: {
    competition: PublicCompetition | null
    guildId?: string
    locale: Locale
    t: LeagueMessages
    run: Run
    pending: boolean
}) {
    const m = getTeamManagementMessages(locale)
    const key = useRef<string | null>(null)
    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const form = event.currentTarget,
            data = new FormData(form)
        key.current ??= crypto.randomUUID()
        const game = competition?.gameId ?? data.get("game")
        if (game !== "hell_let_loose" && game !== "wardogs") return
        const details = {
            name: String(data.get("name") ?? ""),
            shortCode: String(data.get("code") ?? "").trim() || null,
            description: String(data.get("about") ?? "").trim() || null,
            idempotencyKey: key.current,
        }
        const ok = await run(
            competition
                ? {
                      ...details,
                      action: "createAndEnroll",
                      competitionId: competition.id,
                  }
                : {
                      ...details,
                      action: "createTeam",
                      gameId: game,
                      ...(guildId ? { guildId } : {}),
                  }
        )
        if (ok) {
            key.current = null
            form.reset()
        }
    }
    return (
        <section className="bg-muted/20 rounded-xl border p-5">
            <h2 className="flex items-center gap-2 font-semibold">
                <Plus className="size-4" />
                {competition
                    ? m.createAndEnroll
                    : guildId
                      ? m.createAndConnect
                      : t.create}
            </h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
                {competition ? m.createAndEnrollHint : t.createHint}
            </p>
            <form onSubmit={submit} className="mt-5 space-y-4">
                <fieldset
                    disabled={
                        pending ||
                        (competition?.registrationMode ?? "automatic") ===
                            "closed"
                    }
                    className="space-y-4"
                >
                    {competition ? (
                        <p className="text-muted-foreground text-sm">
                            {GAME_LABELS[competition.gameId]}
                        </p>
                    ) : (
                        <Label className="grid gap-2">
                            {t.game}
                            <select
                                name="game"
                                className={selectClass}
                                defaultValue="hell_let_loose"
                            >
                                <option value="hell_let_loose">
                                    Hell Let Loose
                                </option>
                                <option value="wardogs">Wardogs</option>
                            </select>
                        </Label>
                    )}
                    <Label className="grid gap-2">
                        {t.name}
                        <Input
                            name="name"
                            maxLength={120}
                            required
                            autoComplete="organization"
                        />
                    </Label>
                    <Label className="grid gap-2">
                        {t.shortCode}
                        <Input name="code" maxLength={16} />
                    </Label>
                    <Label className="grid gap-2">
                        {t.about}
                        <Input name="about" maxLength={500} />
                    </Label>
                    <Button type="submit" className="w-full">
                        {pending ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Plus className="size-4" />
                        )}
                        {competition
                            ? m.createAndEnroll
                            : guildId
                              ? m.createAndConnect
                              : t.create}
                    </Button>
                </fieldset>
            </form>
        </section>
    )
}
function JoinTeam({
    initial,
    t,
    run,
    pending,
}: {
    initial: string
    t: LeagueMessages
    run: Run
    pending: boolean
}) {
    const [value, setValue] = useState(initial)
    async function submit(event: FormEvent) {
        event.preventDefault()
        let token = value.trim()
        try {
            token = new URL(token).searchParams.get("invite") ?? token
        } catch {}
        await run({ action: "joinTeam", token })
    }
    return (
        <section className="rounded-xl border p-5">
            <h2 className="font-semibold">{t.joinInvite}</h2>
            <p className="text-muted-foreground mt-2 text-sm leading-6">
                {t.inviteDescription}
            </p>
            <form onSubmit={submit} className="mt-4 flex flex-col gap-3">
                <Label className="grid gap-2">
                    {t.inviteCode}
                    <Input
                        required
                        value={value}
                        onChange={(event) => setValue(event.target.value)}
                        maxLength={512}
                    />
                </Label>
                <Button type="submit" variant="outline" disabled={pending}>
                    {t.join}
                </Button>
            </form>
        </section>
    )
}
function FixtureManager({
    fixture,
    view,
    competition,
    t,
    run,
    pending,
    locale,
}: {
    fixture: LeaguePortalView["fixtures"][number]
    view: LeaguePortalView
    competition: PublicCompetition
    t: LeagueMessages
    run: Run
    pending: boolean
    locale: Locale
}) {
    const [kind, setKind] = useState<"linked" | "external">(
        fixture.host?.kind ??
            (view.servers.some((server) => server.gameId === competition.gameId)
                ? "linked"
                : "external")
    )
    const [source, setSource] = useState("")
    const [label, setLabel] = useState(
        fixture.host?.kind === "external" ? fixture.host.label : ""
    )
    const own = view.teams.filter(
        (team) =>
            team.owner &&
            fixture.participants.some(
                (participant) => participant.id === team.id
            )
    )
    const [reportTeam, setReportTeam] = useState(own[0]?.id ?? "")
    const [scores, setScores] = useState(fixture.participants.map(() => ""))
    const editable =
        (own.length > 0 || view.organiser) && fixture.status === "scheduled"
    return (
        <article className="bg-card rounded-xl border p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap justify-between gap-2">
                <div>
                    <h3 className="font-semibold">
                        {fixture.participants
                            .map((team) => team.name)
                            .join(" vs ")}
                    </h3>
                    <p className="text-muted-foreground mt-1 text-xs">
                        {fixture.scheduledAt &&
                        Number.isFinite(Date.parse(fixture.scheduledAt))
                            ? new Intl.DateTimeFormat(locale, {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                  timeZone: "UTC",
                              }).format(new Date(fixture.scheduledAt)) + " UTC"
                            : (fixture.scheduledAt ?? "—")}
                    </p>
                </div>
                <span className="text-xs font-medium">
                    {fixture.status === "scheduled" ? t.scheduled : t.final}
                </span>
            </div>
            <div className="bg-muted/40 mb-4 flex items-center gap-2 rounded-lg p-3 text-sm">
                <Server className="size-4" />
                {fixture.host?.label ?? t.unassigned}
                {fixture.host && (
                    <span className="text-muted-foreground ml-auto text-xs">
                        {fixture.host.kind === "linked" ? t.linked : t.external}
                    </span>
                )}
            </div>
            {editable && fixture.reports.length === 0 && (
                <form
                    onSubmit={async (event) => {
                        event.preventDefault()
                        await run({
                            action: "setHost",
                            fixtureId: fixture.id,
                            host:
                                kind === "external"
                                    ? { kind, label }
                                    : { kind, sourceRef: source },
                        })
                    }}
                >
                    <fieldset
                        disabled={pending}
                        className="grid items-end gap-3 sm:grid-cols-[1fr_2fr_auto]"
                    >
                        <Label className="grid gap-2">
                            {t.host}
                            <select
                                className={selectClass}
                                value={kind}
                                onChange={(event) =>
                                    setKind(
                                        event.target.value === "linked"
                                            ? "linked"
                                            : "external"
                                    )
                                }
                            >
                                <option value="linked">{t.linked}</option>
                                <option value="external">{t.external}</option>
                            </select>
                        </Label>
                        {kind === "linked" ? (
                            <Label className="grid gap-2">
                                {t.linked}
                                <select
                                    required
                                    className={selectClass}
                                    value={source}
                                    onChange={(event) =>
                                        setSource(event.target.value)
                                    }
                                >
                                    <option value="">—</option>
                                    {view.servers
                                        .filter(
                                            (server) =>
                                                server.gameId ===
                                                competition.gameId
                                        )
                                        .map((server) => (
                                            <option
                                                key={server.sourceRef}
                                                value={server.sourceRef}
                                            >
                                                {server.label}
                                            </option>
                                        ))}
                                </select>
                            </Label>
                        ) : (
                            <Label className="grid gap-2">
                                {t.externalName}
                                <Input
                                    required
                                    maxLength={120}
                                    value={label}
                                    onChange={(event) =>
                                        setLabel(event.target.value)
                                    }
                                />
                            </Label>
                        )}
                        <Button type="submit" variant="outline">
                            {t.save}
                        </Button>
                    </fieldset>
                    <p className="text-muted-foreground mt-2 text-xs leading-5">
                        {kind === "linked" ? t.linkedHint : t.externalHint}
                    </p>
                </form>
            )}
            {fixture.host?.kind === "external" &&
                fixture.status === "scheduled" && (
                    <div className="mt-5 border-t pt-5">
                        <p className="text-muted-foreground text-sm leading-6">
                            {t.reportHint}
                        </p>
                        {own.length > 0 && (
                            <form
                                className="mt-4 space-y-4"
                                onSubmit={async (event) => {
                                    event.preventDefault()
                                    await run({
                                        action: "reportScore",
                                        fixtureId: fixture.id,
                                        teamId: reportTeam,
                                        participantTeamIds:
                                            fixture.participants.map(
                                                (team) => team.id
                                            ),
                                        scores: scores.map(Number),
                                    })
                                }}
                            >
                                <fieldset
                                    disabled={pending}
                                    className="flex flex-wrap items-end gap-3"
                                >
                                    {own.length > 1 && (
                                        <Label className="grid gap-2">
                                            {t.selectTeam}
                                            <select
                                                className={selectClass}
                                                value={reportTeam}
                                                onChange={(event) =>
                                                    setReportTeam(
                                                        event.target.value
                                                    )
                                                }
                                            >
                                                {own.map((team) => (
                                                    <option
                                                        key={team.id}
                                                        value={team.id}
                                                    >
                                                        {team.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </Label>
                                    )}
                                    {fixture.participants.map((team, index) => (
                                        <Label
                                            key={team.id}
                                            className="grid gap-2 text-xs"
                                        >
                                            {team.name}
                                            <Input
                                                type="number"
                                                min={0}
                                                max={999}
                                                step={1}
                                                required
                                                className="w-28"
                                                value={scores[index]}
                                                onChange={(event) =>
                                                    setScores((current) =>
                                                        current.map(
                                                            (score, i) =>
                                                                i === index
                                                                    ? event
                                                                          .target
                                                                          .value
                                                                    : score
                                                        )
                                                    )
                                                }
                                            />
                                        </Label>
                                    ))}
                                    <Button type="submit">{t.report}</Button>
                                </fieldset>
                            </form>
                        )}
                        {fixture.reports.length > 0 && (
                            <div className="mt-5 space-y-2">
                                <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
                                    {t.reports}
                                </p>
                                {fixture.reports.map((report) => (
                                    <div
                                        key={report.id}
                                        className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm"
                                    >
                                        <span className="flex-1">
                                            {fixture.participants.find(
                                                (team) =>
                                                    team.id === report.teamId
                                            )?.name ?? "—"}
                                        </span>
                                        <strong className="tabular-nums">
                                            {report.scores.join(" : ")}
                                        </strong>
                                        {view.organiser && (
                                            <Button
                                                size="sm"
                                                variant="outline"
                                                disabled={pending}
                                                onClick={() =>
                                                    void run({
                                                        action: "approveScore",
                                                        fixtureId: fixture.id,
                                                        reportId: report.id,
                                                    })
                                                }
                                            >
                                                {t.approve}
                                            </Button>
                                        )}
                                    </div>
                                ))}
                                <p className="text-muted-foreground text-xs">
                                    {t.manualPending}
                                </p>
                            </div>
                        )}
                    </div>
                )}
        </article>
    )
}
