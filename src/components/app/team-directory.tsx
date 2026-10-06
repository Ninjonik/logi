"use client"

import {
    appendTeamPage,
    appendTeamRequests,
    canCancelTeamRequest,
    fillTeamTemplate,
    TEAM_REQUEST_STATUS_BADGE,
    teamActionLabel,
    teamLinkView,
    teamRequestHeading,
    teamRequestOutcome,
    teamRequestResultIdsToResolve,
    withCancelledTeamRequest,
} from "@/lib/teams/team-list"
import {
    cancelTeamRequest,
    fetchTeamRequestPage,
    teamRequestErrorMessage,
    type TeamRequestClientError,
} from "@/lib/teams/team-request-client"
import {
    fetchTeamPage,
    fetchTeamRecord,
    TeamReadError,
    type TeamReadErrorCode,
} from "@/lib/teams/team-client"
import {
    TEAM_PAGE_DEFAULT,
    type TeamGame,
    type TeamRecord,
} from "@/domain/teams/team"
import { TeamRequestDialog } from "@/components/app/team-request-dialog"
import type { TeamRequestTarget } from "@/lib/teams/team-request-form"
import type { TeamRequestRecord } from "@/domain/teams/team-request"
import { ExternalLink, Loader2, Plus, Search } from "lucide-react"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { ConfigNotice } from "@/components/app/config-notice"
import { useEffect, useId, useRef, useState } from "react"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

/** One game's catalogue; `enabled` is whether the workspace plays that game. */
export type TeamCatalogueSection = { gameId: TeamGame; enabled: boolean }
type DialogState = { open: boolean; target: TeamRequestTarget }

/**
 * The workspace view of the global team catalogue: one read-only section per
 * game, request dialogs for new teams and changes, and this workspace's
 * requests with their status.
 */
export function TeamDirectory({
    serverId,
    locale,
    dictionary,
    sections,
    settingsHref,
    initialSearch = "",
}: {
    serverId: string
    locale: string
    dictionary: Dictionary
    sections: readonly TeamCatalogueSection[]
    settingsHref: string
    /** Pre-fills the search, e.g. from a team request DM's link (L5-39). */
    initialSearch?: string
}) {
    const [dialog, setDialog] = useState<DialogState | null>(null)
    // Bumped by each submission so the request list reloads and confirms it.
    const [submissions, setSubmissions] = useState(0)

    function openRequest(target: TeamRequestTarget) {
        setDialog({ open: true, target })
    }

    return (
        <div className="space-y-8">
            {sections.map((section) => (
                <GameCatalogue
                    key={section.gameId}
                    serverId={serverId}
                    dictionary={dictionary}
                    gameId={section.gameId}
                    enabled={section.enabled}
                    settingsHref={settingsHref}
                    showHeading={sections.length > 1}
                    initialSearch={initialSearch}
                    onRequest={openRequest}
                />
            ))}
            <TeamRequestList
                serverId={serverId}
                locale={locale}
                dictionary={dictionary}
                submissions={submissions}
            />
            {dialog ? (
                <TeamRequestDialog
                    serverId={serverId}
                    dictionary={dictionary}
                    open={dialog.open}
                    target={dialog.target}
                    onOpenChange={(open) =>
                        setDialog((current) =>
                            current ? { ...current, open } : current
                        )
                    }
                    onSubmitted={() => setSubmissions((value) => value + 1)}
                />
            ) : null}
        </div>
    )
}

type Notice = { tone: "error" | "success"; text: string }

function GameCatalogue({
    serverId,
    dictionary,
    gameId,
    enabled,
    settingsHref,
    showHeading,
    initialSearch,
    onRequest,
}: {
    serverId: string
    dictionary: Dictionary
    gameId: TeamGame
    enabled: boolean
    settingsHref: string
    showHeading: boolean
    initialSearch: string
    onRequest(target: TeamRequestTarget): void
}) {
    const t = dictionary.teams,
        id = useId()
    const [search, setSearch] = useState(initialSearch)
    const term = useDebouncedValue(search.trim(), 300)
    const [items, setItems] = useState<TeamRecord[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading"
    )
    const [listError, setListError] = useState<TeamReadErrorCode>("unavailable")
    const [loadingMore, setLoadingMore] = useState(false)
    const [reload, setReload] = useState(0)
    const [notice, setNotice] = useState<Notice | null>(null)
    // Responses from a superseded query (search or reload) are ignored.
    const generation = useRef(0)

    useEffect(() => {
        const controller = new AbortController(),
            current = ++generation.current
        async function load() {
            setStatus("loading")
            try {
                const page = await fetchTeamPage(
                    serverId,
                    { gameId, search: term, limit: TEAM_PAGE_DEFAULT },
                    controller.signal
                )
                if (current !== generation.current) return
                setItems(page.items)
                setNextCursor(page.nextCursor)
                setStatus("ready")
            } catch (error) {
                if (controller.signal.aborted || current !== generation.current)
                    return
                setListError(
                    error instanceof TeamReadError ? error.code : "unavailable"
                )
                setStatus("error")
            }
        }
        void load()
        return () => controller.abort()
    }, [serverId, gameId, term, reload])

    async function loadMore() {
        if (!nextCursor) return
        const current = generation.current
        setLoadingMore(true)
        setNotice(null)
        try {
            const page = await fetchTeamPage(serverId, {
                gameId,
                search: term,
                cursor: nextCursor,
                limit: TEAM_PAGE_DEFAULT,
            })
            if (current !== generation.current) return
            setItems((loaded) => appendTeamPage(loaded, page.items))
            setNextCursor(page.nextCursor)
        } catch (error) {
            if (current !== generation.current) return
            setNotice({
                tone: "error",
                text: t.errors[
                    error instanceof TeamReadError ? error.code : "unavailable"
                ],
            })
        } finally {
            setLoadingMore(false)
        }
    }

    const headingId = `${id}-heading`

    return (
        <section
            aria-labelledby={showHeading ? headingId : undefined}
            aria-label={showHeading ? undefined : GAME_LABELS[gameId]}
            className="border-border/60 bg-card space-y-4 rounded-2xl border p-4 sm:p-5"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                {showHeading ? (
                    <h2 id={headingId} className="text-lg font-semibold">
                        {GAME_LABELS[gameId]}
                    </h2>
                ) : (
                    <span />
                )}
                <Button
                    type="button"
                    className="rounded-xl"
                    onClick={() => onRequest({ kind: "create", gameId })}
                >
                    <Plus className="size-4" aria-hidden />
                    {t.requestNew}
                </Button>
            </div>
            {enabled ? null : (
                <ConfigNotice
                    tone="info"
                    title={GAME_LABELS[gameId]}
                    href={settingsHref}
                    ctaLabel={dictionary.event.notices.openClanSettings}
                >
                    {t.gameDisabled}
                </ConfigNotice>
            )}
            <div className="relative w-full max-w-sm">
                <Search
                    className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                    aria-hidden
                />
                <Input
                    type="search"
                    value={search}
                    maxLength={64}
                    placeholder={t.search}
                    aria-label={t.search}
                    className="rounded-xl pl-9"
                    onChange={(event) => setSearch(event.target.value)}
                />
            </div>
            <div aria-live="polite" className="min-h-0">
                {notice ? (
                    <p
                        role={notice.tone === "error" ? "alert" : "status"}
                        className={
                            notice.tone === "error"
                                ? "text-destructive text-sm"
                                : "text-muted-foreground text-sm"
                        }
                    >
                        {notice.text}
                    </p>
                ) : null}
            </div>
            {status === "loading" && items.length === 0 ? (
                <p
                    role="status"
                    className="text-muted-foreground flex items-center gap-2 text-sm"
                >
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {t.loading}
                </p>
            ) : status === "error" ? (
                <div className="flex flex-wrap items-center gap-3">
                    <p role="alert" className="text-destructive text-sm">
                        {t.errors[listError]}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReload((value) => value + 1)}
                    >
                        {t.retry}
                    </Button>
                </div>
            ) : items.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    {term ? t.emptySearch : t.empty}
                </p>
            ) : (
                <ul
                    className="divide-border/60 divide-y"
                    aria-busy={status === "loading"}
                >
                    {items.map((team) => (
                        <CatalogueRow
                            key={team.id}
                            team={team}
                            dictionary={dictionary}
                            onSuggest={() =>
                                onRequest({ kind: "update", team })
                            }
                        />
                    ))}
                </ul>
            )}
            {status === "ready" && nextCursor ? (
                <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                >
                    {loadingMore ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : null}
                    {t.loadMore}
                </Button>
            ) : null}
        </section>
    )
}

function CatalogueRow({
    team,
    dictionary,
    onSuggest,
}: {
    team: TeamRecord
    dictionary: Dictionary
    onSuggest(): void
}) {
    const t = dictionary.teams
    const links = team.links.flatMap((url) => {
        const view = teamLinkView(url)
        return view ? [view] : []
    })
    return (
        <li className="flex flex-wrap items-start gap-3 py-3">
            <TeamLogo
                name={team.name}
                shortCode={team.shortCode}
                logoUrl={team.logoUrl}
                className="size-10"
            />
            <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium break-words">{team.name}</span>
                    {team.shortCode ? (
                        <span className="text-muted-foreground text-xs">
                            <span className="sr-only">{t.shortCode}: </span>
                            {team.shortCode}
                        </span>
                    ) : null}
                </div>
                {team.description ? (
                    <p className="text-muted-foreground text-sm break-words whitespace-pre-line">
                        {team.description}
                    </p>
                ) : null}
                {links.length ? (
                    <ul
                        aria-label={teamActionLabel(t.teamLinks, team.name)}
                        className="flex flex-wrap gap-x-4 gap-y-1 text-sm"
                    >
                        {links.map((link) => (
                            <li key={link.href} className="min-w-0">
                                <a
                                    href={link.href}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="text-primary inline-flex max-w-full items-center gap-1 underline-offset-4 hover:underline"
                                >
                                    <span className="truncate">
                                        {link.label}
                                    </span>
                                    <ExternalLink
                                        className="size-3 shrink-0"
                                        aria-hidden
                                    />
                                </a>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
            <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label={teamActionLabel(t.suggestChangeTeam, team.name)}
                onClick={onSuggest}
            >
                {t.suggestChange}
            </Button>
        </li>
    )
}

function formatDate(locale: string, iso: string): string | null {
    const date = new Date(iso)
    if (Number.isNaN(date.getTime())) return null
    try {
        return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
            date
        )
    } catch {
        return date.toISOString().slice(0, 10)
    }
}

/** This workspace's requests, newest first, with their status and outcome. */
function TeamRequestList({
    serverId,
    locale,
    dictionary,
    submissions,
}: {
    serverId: string
    locale: string
    dictionary: Dictionary
    /** Count of submissions from this page; each one reloads the list. */
    submissions: number
}) {
    const r = dictionary.teamRequests,
        id = useId()
    const [items, setItems] = useState<TeamRequestRecord[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading"
    )
    const [listError, setListError] =
        useState<TeamRequestClientError>("unavailable")
    const [loadingMore, setLoadingMore] = useState(false)
    const [reload, setReload] = useState(0)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [cancellingId, setCancellingId] = useState<string | null>(null)
    // Resulting teams by ID; `null` when the lookup found nothing or failed.
    const [results, setResults] = useState<
        ReadonlyMap<string, TeamRecord | null>
    >(() => new Map())
    const generation = useRef(0)
    // A new submission confirms itself here; the reload below then lists it.
    const [seenSubmissions, setSeenSubmissions] = useState(submissions)
    if (seenSubmissions !== submissions) {
        setSeenSubmissions(submissions)
        setNotice({ tone: "success", text: r.submitted })
    }

    useEffect(() => {
        const controller = new AbortController(),
            current = ++generation.current
        async function load() {
            setStatus("loading")
            const page = await fetchTeamRequestPage(
                serverId,
                {},
                controller.signal
            )
            if (controller.signal.aborted || current !== generation.current)
                return
            if (!page.ok) {
                setListError(page.code)
                setStatus("error")
                return
            }
            setItems(page.items)
            setNextCursor(page.nextCursor)
            setStatus("ready")
        }
        void load()
        return () => controller.abort()
    }, [serverId, submissions, reload])

    // Names of the teams decided requests resulted in, each looked up once.
    const unresolved = teamRequestResultIdsToResolve(
        items,
        new Set(results.keys())
    )
        .sort()
        .join(",")
    useEffect(() => {
        const ids = unresolved.split(",").filter(Boolean)
        if (!ids.length) return
        const controller = new AbortController()
        async function resolve() {
            const found = await Promise.all(
                ids.map((teamId) =>
                    fetchTeamRecord(serverId, teamId, controller.signal).catch(
                        () => null
                    )
                )
            )
            if (controller.signal.aborted) return
            setResults((current) => {
                const next = new Map(current)
                ids.forEach((teamId, index) =>
                    next.set(teamId, found[index] ?? null)
                )
                return next
            })
        }
        void resolve()
        return () => controller.abort()
    }, [serverId, unresolved])

    async function loadMore() {
        if (!nextCursor) return
        const current = generation.current
        setLoadingMore(true)
        setNotice(null)
        try {
            const page = await fetchTeamRequestPage(serverId, {
                cursor: nextCursor,
            })
            if (current !== generation.current) return
            if (!page.ok) {
                setNotice({
                    tone: "error",
                    text: teamRequestErrorMessage(dictionary, page.code),
                })
                return
            }
            setItems((loaded) => appendTeamRequests(loaded, page.items))
            setNextCursor(page.nextCursor)
        } finally {
            setLoadingMore(false)
        }
    }

    async function cancel(request: TeamRequestRecord) {
        setCancellingId(request.id)
        setNotice(null)
        try {
            const result = await cancelTeamRequest(serverId, request.id)
            if (result.ok) {
                setItems((loaded) =>
                    withCancelledTeamRequest(
                        loaded,
                        request.id,
                        new Date().toISOString()
                    )
                )
                setNotice({ tone: "success", text: r.cancelled })
                return
            }
            setNotice({
                tone: "error",
                text: teamRequestErrorMessage(dictionary, result.code),
            })
            // Decided or removed meanwhile: show the stored state.
            if (result.code === "not_pending" || result.code === "not_found")
                setReload((value) => value + 1)
        } finally {
            setCancellingId(null)
        }
    }

    function resultName(request: TeamRequestRecord, teamId: string) {
        if (request.kind === "update" && request.teamId === teamId)
            return request.teamName ?? r.resultTeamUnavailable
        if (!results.has(teamId)) return null
        return results.get(teamId)?.name ?? r.resultTeamUnavailable
    }

    const headingId = `${id}-heading`
    return (
        <section
            aria-labelledby={headingId}
            className="border-border/60 bg-card space-y-4 rounded-2xl border p-4 sm:p-5"
        >
            <div className="space-y-1">
                <h2 id={headingId} className="text-lg font-semibold">
                    {r.title}
                </h2>
                <p className="text-muted-foreground text-sm">{r.description}</p>
            </div>
            <div aria-live="polite" className="min-h-0">
                {notice ? (
                    <p
                        role={notice.tone === "error" ? "alert" : "status"}
                        className={
                            notice.tone === "error"
                                ? "text-destructive text-sm"
                                : "text-muted-foreground text-sm"
                        }
                    >
                        {notice.text}
                    </p>
                ) : null}
            </div>
            {status === "loading" && items.length === 0 ? (
                <p
                    role="status"
                    className="text-muted-foreground flex items-center gap-2 text-sm"
                >
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {r.loading}
                </p>
            ) : status === "error" ? (
                <div className="flex flex-wrap items-center gap-3">
                    <p role="alert" className="text-destructive text-sm">
                        {teamRequestErrorMessage(dictionary, listError)}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReload((value) => value + 1)}
                    >
                        {r.retry}
                    </Button>
                </div>
            ) : items.length === 0 ? (
                <p className="text-muted-foreground text-sm">{r.empty}</p>
            ) : (
                <ul
                    className="divide-border/60 divide-y"
                    aria-busy={status === "loading"}
                >
                    {items.map((request) => {
                        const heading = teamRequestHeading(request)
                        const outcome = teamRequestOutcome(request)
                        const requested = formatDate(locale, request.createdAt)
                        const decided = request.decidedAt
                            ? formatDate(locale, request.decidedAt)
                            : null
                        const resulting =
                            outcome?.kind === "team"
                                ? resultName(request, outcome.teamId)
                                : null
                        const proposalDiffers =
                            request.kind === "update" &&
                            request.proposal.name !== heading
                        return (
                            <li
                                key={request.id}
                                className="flex flex-wrap items-start gap-3 py-3"
                            >
                                <TeamLogo
                                    name={request.proposal.name}
                                    shortCode={request.proposal.shortCode}
                                    logoUrl={request.proposal.logoUrl}
                                    className="size-10"
                                />
                                <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-medium break-words">
                                            {heading}
                                        </span>
                                        <Badge
                                            variant={
                                                TEAM_REQUEST_STATUS_BADGE[
                                                    request.status
                                                ]
                                            }
                                        >
                                            {r.statuses[request.status]}
                                        </Badge>
                                        <Badge variant="secondary">
                                            {r.kinds[request.kind]}
                                        </Badge>
                                        <span className="text-muted-foreground text-xs">
                                            {GAME_LABELS[request.gameId]}
                                        </span>
                                    </div>
                                    {proposalDiffers ? (
                                        <p className="text-sm break-words">
                                            → {request.proposal.name}
                                            {request.proposal.shortCode
                                                ? ` [${request.proposal.shortCode}]`
                                                : ""}
                                        </p>
                                    ) : null}
                                    <p className="text-muted-foreground text-xs">
                                        {[
                                            requested &&
                                                fillTeamTemplate(
                                                    r.requestedOn,
                                                    { date: requested }
                                                ),
                                            decided &&
                                                fillTeamTemplate(r.decidedOn, {
                                                    date: decided,
                                                }),
                                        ]
                                            .filter(Boolean)
                                            .join(" · ")}
                                    </p>
                                    {request.note ? (
                                        <p className="text-muted-foreground text-sm break-words whitespace-pre-line">
                                            <span className="font-medium">
                                                {r.note}:
                                            </span>{" "}
                                            {request.note}
                                        </p>
                                    ) : null}
                                    {outcome?.kind === "reason" ? (
                                        <p className="text-sm break-words whitespace-pre-line">
                                            <span className="font-medium">
                                                {r.reason}:
                                            </span>{" "}
                                            {outcome.reason}
                                        </p>
                                    ) : null}
                                    {outcome?.kind === "team" ? (
                                        <p className="text-sm break-words">
                                            <span className="font-medium">
                                                {r.resultTeam}:
                                            </span>{" "}
                                            {resulting ?? (
                                                <Loader2
                                                    className="text-muted-foreground inline size-3 animate-spin"
                                                    aria-hidden
                                                />
                                            )}
                                        </p>
                                    ) : null}
                                </div>
                                {canCancelTeamRequest(request) ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        disabled={cancellingId !== null}
                                        aria-label={teamActionLabel(
                                            r.cancelRequest,
                                            heading
                                        )}
                                        onClick={() => void cancel(request)}
                                    >
                                        {cancellingId === request.id ? (
                                            <Loader2
                                                className="size-4 animate-spin"
                                                aria-hidden
                                            />
                                        ) : null}
                                        {cancellingId === request.id
                                            ? r.cancelling
                                            : r.cancel}
                                    </Button>
                                ) : null}
                            </li>
                        )
                    })}
                </ul>
            )}
            {status === "ready" && nextCursor ? (
                <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={loadingMore}
                    onClick={() => void loadMore()}
                >
                    {loadingMore ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : null}
                    {r.loadMore}
                </Button>
            ) : null}
        </section>
    )
}
