"use client"

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
    fetchTeamRequest,
    fetchTeamRequestQueue,
    TeamAdminReadError,
    TEAM_REQUEST_ADMIN_ERROR_CODES,
    type TeamRequestAdminErrorCode,
} from "@/lib/teams-admin/team-admin-client"
import {
    TEAM_REQUEST_STATUSES,
    teamRequestStatusSchema,
    type TeamRequestRecord,
    type TeamRequestStatus,
} from "@/domain/teams/team-request"
import {
    filterTeamRequests,
    requestClanOptions,
    selectedTeamRequest,
} from "@/lib/teams-admin/team-request-filters"
import {
    appendUnique,
    fillTemplate,
    formatAdminDate,
    removeById,
} from "@/lib/teams-admin/team-admin-list"
import { TEAM_GAMES, teamGameSchema, type TeamGame } from "@/domain/teams/team"
import { TEAM_REQUESTS_CHANGED_EVENT } from "@/components/app/admin-sidebar"
import { proposalChanges } from "@/lib/teams-admin/team-editor"
import { formatRelativeTime } from "@/lib/format/relative-time"
import { useEffect, useId, useRef, useState } from "react"
import { EmptyState } from "@/components/app/empty-state"
import { TeamLogo } from "@/components/app/team-logo"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Inbox, Loader2 } from "lucide-react"

const QUEUE_PAGE = 20

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

/**
 * The global moderation queue (design I2): pending requests oldest first in
 * a list, the chosen request with its comparison and decisions beside it.
 */
export function TeamRequestQueue({
    labels,
    locale,
    allGamesLabel,
}: {
    labels: RequestDialogLabels
    locale: string
    allGamesLabel: string
}) {
    const t = labels.requests
    const id = useId()
    const [view, setView] = useState<QueueView>("pending")
    const [decidedStatus, setDecidedStatus] =
        useState<TeamRequestStatus>("approved")
    const status: TeamRequestStatus =
        view === "pending" ? "pending" : decidedStatus
    const [game, setGame] = useState<TeamGame | "all">("all")
    const [clan, setClan] = useState<string>("all")
    const [selectedId, setSelectedId] = useState<string | null>(null)
    const [items, setItems] = useState<TeamRequestRecord[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [load, setLoad] = useState<"loading" | "ready" | "error">("loading")
    const [listError, setListError] =
        useState<TeamRequestAdminErrorCode>("unavailable")
    const [loadingMore, setLoadingMore] = useState(false)
    const [reload, setReload] = useState(0)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [dialog, setDialog] = useState<DialogState>({ kind: "closed" })
    // The last dialog target stays mounted while the dialog animates closed.
    const [dialogRequest, setDialogRequest] =
        useState<TeamRequestRecord | null>(null)
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
                setItems(page.items)
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
    }, [status, reload])

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
    const select =
        "border-input bg-background flex h-9 rounded-md border px-3 text-sm"

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div
                    role="tablist"
                    aria-label={t.tabsLabel}
                    className="bg-muted inline-flex rounded-lg p-1"
                >
                    {(["pending", "decided"] as const).map((value) => (
                        <button
                            key={value}
                            type="button"
                            role="tab"
                            aria-selected={view === value}
                            onClick={() => changeView(value)}
                            className="aria-selected:bg-background aria-selected:text-foreground text-muted-foreground focus-visible:ring-ring rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none aria-selected:shadow-sm"
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
                    <>
                        <Label htmlFor={`${id}-status`} className="sr-only">
                            {t.statusFilter}
                        </Label>
                        <select
                            id={`${id}-status`}
                            value={decidedStatus}
                            onChange={(event) => {
                                const parsed =
                                    teamRequestStatusSchema.safeParse(
                                        event.target.value
                                    )
                                if (parsed.success) {
                                    setNotice(null)
                                    setSelectedId(null)
                                    setDecidedStatus(parsed.data)
                                }
                            }}
                            className={select}
                        >
                            {DECIDED_STATUSES.map((value) => (
                                <option key={value} value={value}>
                                    {t.statuses[value]}
                                </option>
                            ))}
                        </select>
                    </>
                ) : null}
                <Label htmlFor={`${id}-game`} className="sr-only">
                    {t.gameFilter}
                </Label>
                <select
                    id={`${id}-game`}
                    value={game}
                    onChange={(event) => {
                        const parsed = teamGameSchema.safeParse(
                            event.target.value
                        )
                        setGame(parsed.success ? parsed.data : "all")
                    }}
                    className={select}
                >
                    <option value="all">{allGamesLabel}</option>
                    {TEAM_GAMES.map((value) => (
                        <option key={value} value={value}>
                            {GAME_LABELS[value]}
                        </option>
                    ))}
                </select>
                <Label htmlFor={`${id}-clan`} className="sr-only">
                    {t.clanFilter}
                </Label>
                <select
                    id={`${id}-clan`}
                    value={clan}
                    onChange={(event) => setClan(event.target.value)}
                    className={`${select} max-w-56`}
                >
                    <option value="all">{t.allClans}</option>
                    {clans.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.name ??
                                fillTemplate(t.unknownWorkspace, {
                                    id: option.id,
                                })}
                        </option>
                    ))}
                </select>
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
                <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]">
                    <div className="space-y-3">
                        {visible.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                {t.emptyFiltered}
                            </p>
                        ) : (
                            <ul
                                aria-label={t.listLabel}
                                aria-busy={load === "loading"}
                                className="space-y-2"
                            >
                                {visible.map((request) => (
                                    <li key={request.id}>
                                        <RequestListItem
                                            labels={labels}
                                            locale={locale}
                                            request={request}
                                            current={
                                                selected?.id === request.id
                                            }
                                            onSelect={() =>
                                                setSelectedId(request.id)
                                            }
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
                    {selected ? (
                        <RequestDetail
                            key={selected.id}
                            labels={labels}
                            locale={locale}
                            request={selected}
                            onAction={(kind) => open(kind, selected)}
                        />
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            {t.selectRequest}
                        </p>
                    )}
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

/** One row of the list: kind, name, where it came from and how long ago. */
function RequestListItem({
    labels,
    locale,
    request,
    current,
    onSelect,
}: {
    labels: RequestDialogLabels
    locale: string
    request: TeamRequestRecord
    current: boolean
    onSelect(): void
}) {
    const t = labels.requests
    // Read once when the row mounts; ages need no live ticking here.
    const [now] = useState(() => Date.now())
    const clan =
        request.workspaceName ??
        fillTemplate(t.unknownWorkspace, { id: request.guildId })
    return (
        <button
            type="button"
            aria-current={current ? "true" : undefined}
            onClick={onSelect}
            className="border-border/60 bg-card hover:bg-muted/50 aria-[current=true]:border-primary/60 aria-[current=true]:bg-primary/5 focus-visible:ring-ring flex w-full flex-col gap-1 rounded-xl border p-3 text-left text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none"
        >
            <span className="flex min-w-0 items-center gap-2">
                <Badge
                    variant={
                        request.kind === "update" ? "outline" : "secondary"
                    }
                    className="shrink-0"
                >
                    {t.kinds[request.kind]}
                </Badge>
                <span className="truncate font-medium">
                    {request.proposal.name}
                </span>
            </span>
            <span className="text-muted-foreground truncate">
                {fillTemplate(t.fromClan, { clan })}
            </span>
            <span
                className="text-muted-foreground text-xs"
                suppressHydrationWarning
            >
                {GAME_LABELS[request.gameId]} ·{" "}
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

/** The chosen request: who asks for what, the comparison and the decisions. */
function RequestDetail({
    labels,
    locale,
    request,
    onAction,
}: {
    labels: RequestDialogLabels
    locale: string
    request: TeamRequestRecord
    onAction(kind: "approve" | "merge" | "reject"): void
}) {
    const t = labels.requests
    const id = useId()
    const [now] = useState(() => Date.now())
    const pending = request.status === "pending"
    const name = request.proposal.name
    // A pending change request is compared with the team as it is now.
    const current = useAdminTeam(
        pending && request.kind === "update" ? request.teamId : null
    )
    const action = (template: string) => fillTemplate(template, { name })
    const clan =
        request.workspaceName ??
        fillTemplate(t.unknownWorkspace, { id: request.guildId })
    const currentTeam = current.team
    const changed = currentTeam
        ? proposalChanges(request.proposal, currentTeam)
        : null
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
                    className="size-8"
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

    return (
        <section
            aria-labelledby={`${id}-title`}
            className="border-border/60 bg-card min-w-0 space-y-4 rounded-2xl border p-4 sm:p-5"
        >
            <header className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                    <h2 id={`${id}-title`} className="text-lg font-semibold">
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
                    className="text-muted-foreground text-sm break-words"
                    suppressHydrationWarning
                >
                    {fillTemplate(t.requestedBy, {
                        requester: request.requestedBy ?? t.hiddenRequester,
                        clan,
                    })}{" "}
                    · {GAME_LABELS[request.gameId]} ·{" "}
                    <time
                        dateTime={request.createdAt}
                        title={formatAdminDate(request.createdAt, locale)}
                    >
                        {formatRelativeTime(request.createdAt, now, locale)}
                    </time>
                </p>
            </header>
            {request.note ? (
                <blockquote className="border-primary/40 text-muted-foreground border-l-2 pl-3 text-sm break-words whitespace-pre-line italic">
                    <span className="sr-only">{t.note}: </span>
                    {request.note}
                </blockquote>
            ) : null}
            {request.kind === "update" && pending ? (
                currentTeam ? (
                    <div className="space-y-2">
                        <div className="overflow-x-auto rounded-xl border">
                            <table className="w-full text-sm">
                                <thead className="bg-muted/40 text-muted-foreground text-left">
                                    <tr>
                                        <th scope="col" className="px-3 py-2">
                                            {t.field}
                                        </th>
                                        <th scope="col" className="px-3 py-2">
                                            {t.now}
                                        </th>
                                        <th scope="col" className="px-3 py-2">
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
                                                className="border-t align-top"
                                            >
                                                <th
                                                    scope="row"
                                                    className="text-muted-foreground px-3 py-2 text-left font-medium"
                                                >
                                                    {fieldLabel[field]}
                                                </th>
                                                <td className="px-3 py-2">
                                                    {value(currentTeam, field)}
                                                </td>
                                                <td
                                                    className={
                                                        differs
                                                            ? "bg-emerald-500/10 px-3 py-2"
                                                            : "text-muted-foreground px-3 py-2"
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
                            {t.comparisonHint}
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
                    className="space-y-2 rounded-xl border p-3"
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
                <div className="space-y-1">
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
            {pending ? (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-4">
                    <Button
                        type="button"
                        variant="outline"
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
                                {t.merge}
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            aria-label={action(t.approveRequest)}
                            onClick={() => onAction("approve")}
                        >
                            {t.reviewAndApprove}
                        </Button>
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
        <div className="space-y-2">
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
