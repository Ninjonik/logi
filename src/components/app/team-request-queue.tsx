"use client"

import {
    fetchAdminTeamUsage,
    fetchTeamRequest,
    fetchTeamRequestContext,
    fetchTeamRequestQueue,
    sendTeamRequestDecision,
    TeamAdminReadError,
    TEAM_REQUEST_ADMIN_ERROR_CODES,
    type TeamRequestAdminErrorCode,
} from "@/lib/teams-admin/team-admin-client"
import {
    ApproveRequestDialog,
    MergeRequestDialog,
    RejectRequestDialog,
    TeamSummary,
    useAdminTeam,
    type DecidedStatus,
    type RequestDialogLabels,
} from "@/components/app/team-request-dialogs"
import {
    filterTeamRequests,
    requestClanOptions,
    selectedTeamRequest,
    TEAM_GAME_SHORT_LABELS,
} from "@/lib/teams-admin/team-request-filters"
import {
    TEAM_REQUEST_STATUSES,
    teamRequestStatusSchema,
    type TeamRequestRecord,
    type TeamRequestStatus,
} from "@/domain/teams/team-request"
import {
    appendUnique,
    fillTemplate,
    formatAdminDate,
    removeById,
} from "@/lib/teams-admin/team-admin-list"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    approveDecision,
    editorValuesFromProposal,
    proposalChanges,
} from "@/lib/teams-admin/team-editor"
import { TEAM_GAMES, teamGameSchema, type TeamGame } from "@/domain/teams/team"
import type { TeamRequestContext, TeamUsage } from "@/domain/teams/team-usage"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { TEAM_REQUESTS_CHANGED_EVENT } from "@/components/app/admin-sidebar"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { adminAccent, adminTone } from "@/components/app/admin-page-header"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useEffect, useId, useRef, useState } from "react"
import { EmptyState } from "@/components/app/empty-state"
import { TeamLogo } from "@/components/app/team-logo"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Inbox, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const QUEUE_PAGE = 20
const ALL = "all"

type Notice = { tone: "error" | "success"; text: string }
type DialogState =
    | { kind: "closed" }
    | { kind: "approve" | "merge" | "reject"; request: TeamRequestRecord }

const errorCodeOf = (error: unknown): TeamRequestAdminErrorCode =>
    error instanceof TeamAdminReadError &&
    (TEAM_REQUEST_ADMIN_ERROR_CODES as readonly string[]).includes(error.code)
        ? (error.code as TeamRequestAdminErrorCode)
        : "unavailable"

/** Decided requests can be listed by each final status. */
const DECIDED_STATUSES = TEAM_REQUEST_STATUSES.filter(
    (value) => value !== "pending"
)
type QueueView = "pending" | "decided"

/** Two-letter fallback for a requester without an avatar. */
const initials = (name: string) =>
    name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((word) => [...word][0] ?? "")
        .join("")
        .toUpperCase()

/**
 * The global moderation queue (design I2): pending requests oldest first in
 * a list, the chosen request with its comparison and decisions beside it.
 */
export function TeamRequestQueue({
    labels,
    locale,
    allGamesLabel,
    initialRequestId,
}: {
    labels: RequestDialogLabels
    locale: string
    allGamesLabel: string
    /** A request opened from elsewhere (the catalogue's request banner). */
    initialRequestId?: string | null
}) {
    const t = labels.requests
    const [view, setView] = useState<QueueView>("pending")
    const [decidedStatus, setDecidedStatus] =
        useState<TeamRequestStatus>("approved")
    const status: TeamRequestStatus =
        view === "pending" ? "pending" : decidedStatus
    const [game, setGame] = useState<TeamGame | "all">(ALL)
    const [clan, setClan] = useState<string>(ALL)
    const [selectedId, setSelectedId] = useState<string | null>(
        initialRequestId ?? null
    )
    const [items, setItems] = useState<TeamRequestRecord[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [load, setLoad] = useState<"loading" | "ready" | "error">("loading")
    const [listError, setListError] =
        useState<TeamRequestAdminErrorCode>("unavailable")
    const [loadingMore, setLoadingMore] = useState(false)
    const [reload, setReload] = useState(0)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [dialog, setDialog] = useState<DialogState>({ kind: "closed" })
    const [context, setContext] = useState<Map<string, TeamRequestContext>>(
        () => new Map()
    )
    // The last dialog target stays mounted while the dialog animates closed.
    const [dialogRequest, setDialogRequest] =
        useState<TeamRequestRecord | null>(null)
    const detailRef = useRef<HTMLDivElement>(null)
    const generation = useRef(0)

    useEffect(() => {
        const controller = new AbortController(),
            current = ++generation.current
        async function read() {
            setLoad("loading")
            try {
                const page = await fetchTeamRequestQueue(
                    { status, limit: QUEUE_PAGE },
                    { signal: controller.signal }
                )
                if (current !== generation.current) return
                // A request opened by link is shown even beyond the first page.
                const wanted =
                    initialRequestId &&
                    status === "pending" &&
                    !page.items.some((item) => item.id === initialRequestId)
                        ? await fetchTeamRequest(initialRequestId, {
                              signal: controller.signal,
                          }).catch(() => null)
                        : null
                if (current !== generation.current) return
                setItems(
                    wanted && wanted.status === status
                        ? [...page.items, wanted]
                        : page.items
                )
                setNextCursor(page.nextCursor)
                setLoad("ready")
            } catch (error) {
                if (controller.signal.aborted || current !== generation.current)
                    return
                setListError(errorCodeOf(error))
                setLoad("error")
            }
        }
        void read()
        return () => controller.abort()
    }, [status, reload, initialRequestId])

    // Requester names and similar teams for every loaded request.
    const missingContext = items
        .map((request) => request.id)
        .filter((requestId) => !context.has(requestId))
    const missingKey = missingContext.join(",")
    useEffect(() => {
        if (!missingKey) return
        const controller = new AbortController()
        fetchTeamRequestContext(missingKey.split(","), {
            signal: controller.signal,
        })
            .then((rows) =>
                setContext((known) => {
                    const next = new Map(known)
                    for (const row of rows) next.set(row.requestId, row)
                    return next
                })
            )
            // Without context the queue still shows Discord IDs and no hints.
            .catch(() => undefined)
        return () => controller.abort()
    }, [missingKey])

    async function loadMore() {
        if (!nextCursor) return
        const current = generation.current
        setLoadingMore(true)
        try {
            const page = await fetchTeamRequestQueue({
                status,
                cursor: nextCursor,
                limit: QUEUE_PAGE,
            })
            if (current !== generation.current) return
            setItems((loaded) => appendUnique(loaded, page.items))
            setNextCursor(page.nextCursor)
        } catch (error) {
            if (current !== generation.current) return
            setNotice({ tone: "error", text: t.errors[errorCodeOf(error)] })
        } finally {
            setLoadingMore(false)
        }
    }

    function onDecided(request: TeamRequestRecord, decided: DecidedStatus) {
        setItems((loaded) => removeById(loaded, request.id))
        setNotice({ tone: "success", text: t.decidedNotice[decided] })
        window.dispatchEvent(new Event(TEAM_REQUESTS_CHANGED_EVENT))
    }

    async function onStale(request: TeamRequestRecord) {
        setNotice({ tone: "error", text: t.staleRequest })
        window.dispatchEvent(new Event(TEAM_REQUESTS_CHANGED_EVENT))
        const latest = await fetchTeamRequest(request.id).catch(() => undefined)
        if (latest === undefined) return
        setItems((loaded) =>
            latest && latest.status === status
                ? loaded.map((item) => (item.id === latest.id ? latest : item))
                : removeById(loaded, request.id)
        )
    }

    function open(
        kind: "approve" | "merge" | "reject",
        request: TeamRequestRecord
    ) {
        setDialogRequest(request)
        setNotice(null)
        setDialog({ kind, request })
    }

    function choose(requestId: string) {
        setSelectedId(requestId)
        if (window.matchMedia("(max-width: 1023px)").matches)
            requestAnimationFrame(() =>
                detailRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                })
            )
    }

    function changeView(next: QueueView) {
        setNotice(null)
        setSelectedId(null)
        setView(next)
    }

    const dialogProps = dialogRequest
        ? {
              labels,
              request:
                  dialog.kind === "closed" ? dialogRequest : dialog.request,
              onOpenChange: (next: boolean) => {
                  if (!next) setDialog({ kind: "closed" })
              },
              onDecided,
              onStale: (request: TeamRequestRecord) => void onStale(request),
          }
        : null
    const visible = filterTeamRequests(items, { game, clan })
    const selected = selectedTeamRequest(visible, selectedId)
    const clans = requestClanOptions(items)
    const pendingCount =
        view === "pending" && load === "ready" && items.length > 0
            ? `${items.length}${nextCursor ? "+" : ""}`
            : null

    return (
        <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
                <div
                    role="tablist"
                    aria-label={t.tabsLabel}
                    className="bg-muted flex gap-0.5 rounded-[10px] p-[3px]"
                >
                    {(["pending", "decided"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={view === value}
                            onClick={() => changeView(value)}
                            className="text-muted-foreground aria-selected:bg-background aria-selected:text-foreground focus-visible:ring-ring h-8 rounded-lg px-3.5 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none aria-selected:font-semibold aria-selected:shadow-sm"
                        >
                            {value === "pending"
                                ? pendingCount
                                    ? fillTemplate(t.tabPending, {
                                          count: pendingCount,
                                      })
                                    : t.tabPendingEmpty
                                : t.tabDecided}
                        </button>
                    ))}
                </div>
                {view === "decided" ? (
                    <Select
                        value={decidedStatus}
                        onValueChange={(value) => {
                            const parsed =
                                teamRequestStatusSchema.safeParse(value)
                            if (parsed.success) {
                                setNotice(null)
                                setSelectedId(null)
                                setDecidedStatus(parsed.data)
                            }
                        }}
                    >
                        <SelectTrigger
                            size="sm"
                            aria-label={t.statusFilter}
                            className="text-[13px]"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DECIDED_STATUSES.map((value) => (
                                <SelectItem key={value} value={value}>
                                    {t.statuses[value]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                ) : null}
                <Select
                    value={game}
                    onValueChange={(value) => {
                        const parsed = teamGameSchema.safeParse(value)
                        setGame(parsed.success ? parsed.data : ALL)
                    }}
                >
                    <SelectTrigger
                        size="sm"
                        aria-label={t.gameFilter}
                        className="text-[13px]"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{allGamesLabel}</SelectItem>
                        {TEAM_GAMES.map((value) => (
                            <SelectItem key={value} value={value}>
                                {GAME_LABELS[value]}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <Select value={clan} onValueChange={setClan}>
                    <SelectTrigger
                        size="sm"
                        aria-label={t.clanFilter}
                        className="max-w-56 text-[13px]"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL}>{t.allClans}</SelectItem>
                        {clans.map((option) => (
                            <SelectItem key={option.id} value={option.id}>
                                {option.name ??
                                    fillTemplate(t.unknownWorkspace, {
                                        id: option.id,
                                    })}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div aria-live="polite" className="min-h-0 empty:hidden">
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
            {load === "loading" && items.length === 0 ? (
                <p
                    role="status"
                    className="text-muted-foreground flex items-center gap-2 text-sm"
                >
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {t.loading}
                </p>
            ) : load === "error" ? (
                <div role="alert" className="flex flex-wrap items-center gap-3">
                    <p className="text-destructive text-sm">
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
                view === "pending" ? (
                    <EmptyState
                        icon={Inbox}
                        title={t.emptyPendingTitle}
                        description={t.emptyPendingDescription}
                    />
                ) : (
                    <EmptyState icon={Inbox} title={t.empty} />
                )
            ) : (
                <div className="flex flex-wrap items-start gap-5">
                    <div className="flex min-w-0 flex-[1_1_18rem] flex-col gap-2 lg:max-w-[23.75rem]">
                        {visible.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                {t.emptyFiltered}
                            </p>
                        ) : (
                            <ul
                                aria-label={t.listLabel}
                                aria-busy={load === "loading"}
                                className="flex flex-col gap-2"
                            >
                                {visible.map((request) => (
                                    <li key={request.id}>
                                        <RequestListItem
                                            labels={labels}
                                            locale={locale}
                                            request={request}
                                            context={context.get(request.id)}
                                            current={
                                                selected?.id === request.id
                                            }
                                            onSelect={() => choose(request.id)}
                                        />
                                    </li>
                                ))}
                            </ul>
                        )}
                        {load === "ready" && nextCursor ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full rounded-xl"
                                disabled={loadingMore}
                                onClick={() => void loadMore()}
                            >
                                {loadingMore ? (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden
                                    />
                                ) : null}
                                {t.loadMore}
                            </Button>
                        ) : null}
                    </div>
                    <div
                        ref={detailRef}
                        className="min-w-0 flex-[999_1_26rem] scroll-mt-4"
                    >
                        {selected ? (
                            <RequestDetail
                                key={selected.id}
                                labels={labels}
                                locale={locale}
                                request={selected}
                                context={context.get(selected.id)}
                                onAction={(kind) => open(kind, selected)}
                                onDecided={onDecided}
                                onStale={(request) => void onStale(request)}
                            />
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                {t.selectRequest}
                            </p>
                        )}
                    </div>
                </div>
            )}
            {dialogProps ? (
                <>
                    <ApproveRequestDialog
                        key={`approve-${dialogProps.request.id}`}
                        {...dialogProps}
                        open={dialog.kind === "approve"}
                    />
                    <MergeRequestDialog
                        key={`merge-${dialogProps.request.id}`}
                        {...dialogProps}
                        open={dialog.kind === "merge"}
                    />
                    <RejectRequestDialog
                        key={`reject-${dialogProps.request.id}`}
                        {...dialogProps}
                        open={dialog.kind === "reject"}
                    />
                </>
            ) : null}
        </div>
    )
}

/** One row of the list: kind, name, where it came from or a look-alike, game and age. */
function RequestListItem({
    labels,
    locale,
    request,
    context,
    current,
    onSelect,
}: {
    labels: RequestDialogLabels
    locale: string
    request: TeamRequestRecord
    context: TeamRequestContext | undefined
    current: boolean
    onSelect(): void
}) {
    const t = labels.requests
    // Read once when the row mounts; ages need no live ticking here.
    const [now] = useState(() => Date.now())
    const clan =
        request.workspaceName ??
        fillTemplate(t.unknownWorkspace, { id: request.guildId })
    const similar = context?.similarTeams[0]
    const changes = (context?.changes ?? []).map(
        (field) => t.changeFields[field]
    )
    const changed =
        changes.length === 0
            ? null
            : fillTemplate(t.changeSummary, {
                  fields:
                      changes.length === 1
                          ? changes.join("")
                          : `${changes.slice(0, -1).join(", ")}${t.listAnd}${changes.at(-1) ?? ""}`,
              })
    return (
        <button
            type="button"
            aria-current={current ? "true" : undefined}
            onClick={onSelect}
            className={cn(
                "bg-card hover:bg-muted/50 focus-visible:ring-ring flex w-full flex-col gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                current && [adminAccent.surface, adminAccent.border]
            )}
        >
            <span className="flex min-w-0 items-center gap-2">
                <span
                    className={cn(
                        "shrink-0 rounded-[5px] px-1.5 py-0.5 text-[11px] font-semibold",
                        request.kind === "update"
                            ? cn("bg-background", adminAccent.text)
                            : "bg-muted text-foreground/80"
                    )}
                >
                    {t.kindBadges[request.kind]}
                </span>
                <span className="truncate text-sm font-semibold">
                    {request.kind === "update"
                        ? (request.teamName ?? request.proposal.name)
                        : request.proposal.name}
                </span>
            </span>
            {similar ? (
                <span className={cn("text-[13px]", adminTone.warningText)}>
                    {fillTemplate(t.similarExists, { name: similar.name })}
                </span>
            ) : (
                <span className="text-foreground/80 line-clamp-2 text-[13px]">
                    {[changed, fillTemplate(t.fromClan, { clan })]
                        .filter(Boolean)
                        .join(" · ")}
                </span>
            )}
            <span
                className="text-muted-foreground text-xs"
                suppressHydrationWarning
            >
                {TEAM_GAME_SHORT_LABELS[request.gameId]} ·{" "}
                {formatRelativeTime(request.createdAt, now, locale)}
            </span>
        </button>
    )
}

const COMPARED_FIELDS = [
    "logo",
    "name",
    "shortCode",
    "links",
    "description",
] as const
type ComparedField = (typeof COMPARED_FIELDS)[number]
type ComparedTeam = Pick<
    TeamRequestRecord["proposal"],
    "name" | "shortCode" | "logoUrl" | "description" | "links"
>

/** Competitions of a team as "ECL 2026, Spring Cup 2026" for the usage hint. */
function competitionList(usage: TeamUsage | null) {
    const names = (usage?.competitions ?? []).map((competition) =>
        `${competition.name} ${competition.season}`.trim()
    )
    return names.length === 0 ? null : names.join(", ")
}

/** The chosen request: who asks for what, the comparison and the decisions. */
function RequestDetail({
    labels,
    locale,
    request,
    context,
    onAction,
    onDecided,
    onStale,
}: {
    labels: RequestDialogLabels
    locale: string
    request: TeamRequestRecord
    context: TeamRequestContext | undefined
    onAction(kind: "approve" | "merge" | "reject"): void
    onDecided(request: TeamRequestRecord, status: DecidedStatus): void
    onStale(request: TeamRequestRecord): void
}) {
    const t = labels.requests
    const id = useId()
    const [now] = useState(() => Date.now())
    const [failure, setFailure] = useState<string | null>(null)
    const [usage, setUsage] = useState<TeamUsage | null | undefined>(undefined)
    const pending = request.status === "pending"
    const name = request.proposal.name
    // A pending change request is compared with the team as it is now.
    const current = useAdminTeam(
        pending && request.kind === "update" ? request.teamId : null
    )
    const usageTeamId = request.kind === "update" ? request.teamId : null
    useEffect(() => {
        if (!usageTeamId) return
        const controller = new AbortController()
        fetchAdminTeamUsage([usageTeamId], { signal: controller.signal })
            .then((rows) => setUsage(rows[0] ?? null))
            .catch(() => undefined)
        return () => controller.abort()
    }, [usageTeamId])
    const action = (template: string) => fillTemplate(template, { name })
    const clan =
        request.workspaceName ??
        fillTemplate(t.unknownWorkspace, { id: request.guildId })
    const requester =
        context?.requester?.name ??
        (request.requestedBy
            ? fillTemplate(t.discordUser, { id: request.requestedBy })
            : t.hiddenRequester)
    const currentTeam = current.team
    const changed = currentTeam
        ? proposalChanges(request.proposal, currentTeam)
        : null
    const similar = context?.similarTeams ?? []
    const competitions = competitionList(usage ?? null)
    const fieldLabel: Record<ComparedField, string> = {
        logo: labels.catalog.logo,
        name: labels.catalog.name,
        shortCode: labels.catalog.shortCode,
        links: labels.catalog.links,
        description: labels.catalog.descriptionField,
    }
    const value = (team: ComparedTeam, field: ComparedField) => {
        if (field === "logo")
            return (
                <TeamLogo
                    name={team.name}
                    shortCode={team.shortCode}
                    logoUrl={team.logoUrl}
                    className="size-9 text-[10px]"
                />
            )
        const text =
            field === "links"
                ? team.links.join(", ")
                : field === "name"
                  ? team.name
                  : team[field]
        return text ? (
            <span className="break-words whitespace-pre-line">{text}</span>
        ) : (
            <span className="text-muted-foreground">{t.emptyValue}</span>
        )
    }

    /** Approves the request as proposed; the editable approval is the dialog. */
    async function approveAsProposed(): Promise<boolean> {
        setFailure(null)
        const built = approveDecision({
            request,
            values: editorValuesFromProposal(request.proposal),
            currentTeam:
                currentTeam && !currentTeam.archivedAt ? currentTeam : null,
        })
        if (built.kind === "invalid") {
            setFailure(t.errors.invalid_request)
            return false
        }
        if (built.kind === "needs_team") {
            setFailure(
                current.status === "missing"
                    ? t.currentTeamMissing
                    : currentTeam?.archivedAt
                      ? t.currentTeamArchived
                      : t.currentTeamUnavailable
            )
            return false
        }
        const result = await sendTeamRequestDecision(request.id, built.decision)
        if (result.ok) {
            onDecided(request, "approved")
            return true
        }
        if (result.code === "not_pending") {
            onStale(request)
            return true
        }
        if (
            result.code === "revision_conflict" ||
            result.code === "team_archived"
        )
            current.reload()
        setFailure(
            result.code === "revision_conflict"
                ? t.conflictReloaded
                : result.code === "team_archived"
                  ? t.currentTeamArchived
                  : t.errors[result.code]
        )
        return false
    }

    return (
        <section
            aria-labelledby={`${id}-title`}
            className="bg-card flex min-w-0 flex-col gap-4 rounded-2xl border p-5 shadow-xs sm:px-6"
        >
            <header className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h2
                        id={`${id}-title`}
                        className="text-lg leading-[26px] font-semibold"
                    >
                        {fillTemplate(
                            request.kind === "update"
                                ? t.titleUpdate
                                : t.titleCreate,
                            { name: request.teamName ?? name }
                        )}
                    </h2>
                    {pending ? null : (
                        <Badge variant="outline">
                            {t.statuses[request.status]}
                        </Badge>
                    )}
                </div>
                <p
                    className="text-foreground/80 flex items-start gap-1.5 text-[13px] break-words"
                    suppressHydrationWarning
                >
                    <Avatar className="mt-px size-5 shrink-0">
                        {context?.requester?.avatarUrl ? (
                            <AvatarImage
                                src={context.requester.avatarUrl}
                                alt=""
                            />
                        ) : null}
                        <AvatarFallback className="text-[9px] font-semibold">
                            {initials(requester) || "?"}
                        </AvatarFallback>
                    </Avatar>
                    <span className="min-w-0">
                        {fillTemplate(t.requestedBy, { requester, clan })} ·{" "}
                        {GAME_LABELS[request.gameId]} ·{" "}
                        <time
                            dateTime={request.createdAt}
                            title={formatAdminDate(request.createdAt, locale)}
                        >
                            {formatRelativeTime(request.createdAt, now, locale)}
                        </time>
                    </span>
                </p>
            </header>
            {request.note ? (
                <blockquote className="bg-muted/50 text-foreground/80 rounded-xl px-3.5 py-2.5 text-sm leading-5 break-words whitespace-pre-line">
                    <span className="sr-only">{t.note}: </span>„{request.note}“
                </blockquote>
            ) : null}
            {pending && similar.length > 0 ? (
                <p
                    className={cn(
                        "rounded-xl border px-3.5 py-2.5 text-[13px]",
                        adminTone.warning
                    )}
                >
                    {fillTemplate(t.similarExists, {
                        name: similar.map((team) => team.name).join(", "),
                    })}
                </p>
            ) : null}
            {request.kind === "update" && pending ? (
                currentTeam ? (
                    <div className="flex flex-col gap-2">
                        <div className="overflow-x-auto rounded-xl border">
                            <table className="w-full min-w-[26rem] border-collapse text-sm">
                                <thead className="bg-muted/50 text-left">
                                    <tr>
                                        <th
                                            scope="col"
                                            className="text-muted-foreground w-28 px-3.5 py-2.5 text-xs font-semibold"
                                        >
                                            {t.field}
                                        </th>
                                        <th
                                            scope="col"
                                            className="text-muted-foreground px-3.5 py-2.5 text-xs font-semibold"
                                        >
                                            {t.now}
                                        </th>
                                        <th
                                            scope="col"
                                            className="text-muted-foreground px-3.5 py-2.5 text-xs font-semibold"
                                        >
                                            {t.proposed}
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {COMPARED_FIELDS.map((field) => {
                                        const differs =
                                            changed?.has(field) ?? false
                                        return (
                                            <tr
                                                key={field}
                                                className="border-t align-middle"
                                            >
                                                <th
                                                    scope="row"
                                                    className="px-3.5 py-2.5 text-left font-medium"
                                                >
                                                    {fieldLabel[field]}
                                                </th>
                                                <td className="text-foreground/80 px-3.5 py-2.5">
                                                    {value(currentTeam, field)}
                                                </td>
                                                <td
                                                    className={
                                                        differs
                                                            ? "bg-emerald-500/10 px-3.5 py-2.5"
                                                            : "text-muted-foreground px-3.5 py-2.5"
                                                    }
                                                >
                                                    {differs ? (
                                                        <>
                                                            <span className="sr-only">
                                                                {t.changed}
                                                                :{" "}
                                                            </span>
                                                            {value(
                                                                request.proposal,
                                                                field
                                                            )}
                                                        </>
                                                    ) : (
                                                        t.unchanged
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <p className="text-muted-foreground text-xs">
                            {[
                                t.comparisonHint,
                                usage === undefined
                                    ? null
                                    : competitions
                                      ? fillTemplate(t.usageIn, {
                                            competitions,
                                        })
                                      : t.usageNone,
                                t.snapshotsKept,
                            ]
                                .filter(Boolean)
                                .join(" ")}
                        </p>
                        {currentTeam.archivedAt ? (
                            <p className="text-destructive text-sm">
                                {t.currentTeamArchived}
                            </p>
                        ) : null}
                    </div>
                ) : (
                    <CurrentTeam labels={labels} current={current} />
                )
            ) : (
                <section
                    aria-labelledby={`${id}-proposal`}
                    className="flex flex-col gap-2 rounded-xl border p-3.5"
                >
                    <h3 id={`${id}-proposal`} className="text-sm font-medium">
                        {t.proposal}
                    </h3>
                    <TeamSummary labels={labels} team={request.proposal} />
                </section>
            )}
            {pending ? null : (
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                    {request.decidedAt ? (
                        <Fact label={t.decided}>
                            {formatAdminDate(request.decidedAt, locale)}
                        </Fact>
                    ) : null}
                    {request.status === "approved" ||
                    request.status === "merged" ||
                    request.status === "rejected" ? (
                        <Fact label={t.notification}>
                            {t.notifications[request.notification]}
                        </Fact>
                    ) : null}
                    {request.kind === "update" ? (
                        <Fact label={t.currentTeam}>
                            {request.teamName ?? t.currentTeamMissing}
                        </Fact>
                    ) : null}
                </dl>
            )}
            {request.reason ? (
                <div className="flex flex-col gap-1">
                    <h3 className="text-sm font-medium">{t.reason}</h3>
                    <p className="text-muted-foreground text-sm break-words whitespace-pre-line">
                        {request.reason}
                    </p>
                </div>
            ) : null}
            {request.resultTeamId &&
            (request.status === "approved" || request.status === "merged") ? (
                <ResultTeam labels={labels} teamId={request.resultTeamId} />
            ) : null}
            {failure ? (
                <p role="alert" className="text-destructive text-sm">
                    {failure}
                </p>
            ) : null}
            {pending ? (
                <div className="flex flex-wrap items-center justify-between gap-2.5 border-t pt-3.5">
                    <Button
                        type="button"
                        variant="outline"
                        className="text-destructive hover:text-destructive"
                        aria-label={action(t.rejectRequest)}
                        onClick={() => onAction("reject")}
                    >
                        {t.rejectWithReason}
                    </Button>
                    <div className="flex flex-wrap gap-2">
                        {request.kind === "create" ? (
                            <Button
                                type="button"
                                variant="outline"
                                aria-label={action(t.mergeRequest)}
                                onClick={() => onAction("merge")}
                            >
                                {t.mergeShort}
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onAction("approve")}
                        >
                            {t.reviewAndApprove}
                        </Button>
                        <ConfirmActionDialog
                            trigger={
                                <Button
                                    type="button"
                                    aria-label={action(t.approveRequest)}
                                    disabled={
                                        request.kind === "update" &&
                                        !currentTeam
                                    }
                                >
                                    {t.approve}
                                </Button>
                            }
                            title={fillTemplate(t.approveDirectTitle, {
                                name: request.teamName ?? name,
                            })}
                            description={t.approveDescription}
                            confirmLabel={t.approve}
                            cancelLabel={t.cancel}
                            onConfirm={approveAsProposed}
                        >
                            <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                                <li>
                                    {request.kind === "update"
                                        ? fillTemplate(t.approveDirectUpdate, {
                                              name: request.teamName ?? name,
                                          })
                                        : fillTemplate(t.approveDirectCreate, {
                                              name,
                                              game: GAME_LABELS[request.gameId],
                                          })}
                                </li>
                                <li>{t.approveDirectDm}</li>
                                {request.kind === "update" ? (
                                    <li>{t.snapshotsKept}</li>
                                ) : null}
                            </ul>
                        </ConfirmActionDialog>
                    </div>
                </div>
            ) : null}
        </section>
    )
}

function Fact({
    label,
    children,
}: {
    label: string
    children: React.ReactNode
}) {
    return (
        <div className="flex flex-wrap gap-x-2">
            <dt className="text-muted-foreground">{label}:</dt>
            <dd className="min-w-0 break-words">{children}</dd>
        </div>
    )
}

function CurrentTeam({
    labels,
    current,
}: {
    labels: RequestDialogLabels
    current: ReturnType<typeof useAdminTeam>
}) {
    const t = labels.requests
    if (current.status === "loading" && !current.team)
        return (
            <p role="status" className="text-muted-foreground text-sm">
                {t.currentTeamLoading}
            </p>
        )
    if (current.status === "missing")
        return (
            <p className="text-destructive text-sm">{t.currentTeamMissing}</p>
        )
    if (!current.team)
        return (
            <p className="text-destructive text-sm">
                {t.currentTeamUnavailable}
            </p>
        )
    return (
        <div className="flex flex-col gap-2">
            <TeamSummary labels={labels} team={current.team} />
            {current.team.archivedAt ? (
                <p className="text-destructive text-sm">
                    {t.currentTeamArchived}
                </p>
            ) : null}
        </div>
    )
}

function ResultTeam({
    labels,
    teamId,
}: {
    labels: RequestDialogLabels
    teamId: string
}) {
    const result = useAdminTeam(teamId)
    return (
        <dl className="text-sm">
            <Fact label={labels.requests.resultTeam}>
                {result.team?.name ??
                    (result.status === "loading" ? "…" : teamId)}
            </Fact>
        </dl>
    )
}
