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
    appendUnique,
    fillTemplate,
    formatAdminDate,
    removeById,
} from "@/lib/teams-admin/team-admin-list"
import { proposalChanges } from "@/lib/teams-admin/team-editor"
import { useEffect, useId, useRef, useState } from "react"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2 } from "lucide-react"

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

/** The global moderation queue; pending requests are listed oldest first. */
export function TeamRequestQueue({
    labels,
    locale,
}: {
    labels: RequestDialogLabels
    locale: string
}) {
    const t = labels.requests
    const id = useId()
    const [status, setStatus] = useState<TeamRequestStatus>("pending")
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
    }

    async function onStale(request: TeamRequestRecord) {
        setNotice({ tone: "error", text: t.staleRequest })
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

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <Label htmlFor={`${id}-status`}>{t.statusFilter}</Label>
                <select
                    id={`${id}-status`}
                    value={status}
                    onChange={(event) => {
                        const parsed = teamRequestStatusSchema.safeParse(
                            event.target.value
                        )
                        if (parsed.success) {
                            setNotice(null)
                            setStatus(parsed.data)
                        }
                    }}
                    className="border-input bg-background flex h-9 rounded-md border px-3 text-sm"
                >
                    {TEAM_REQUEST_STATUSES.map((value) => (
                        <option key={value} value={value}>
                            {t.statuses[value]}
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
                <p className="text-muted-foreground text-sm">{t.empty}</p>
            ) : (
                <ul className="space-y-4" aria-busy={load === "loading"}>
                    {items.map((request) => (
                        <li key={request.id}>
                            <RequestCard
                                labels={labels}
                                locale={locale}
                                request={request}
                                onAction={(kind) => open(kind, request)}
                            />
                        </li>
                    ))}
                </ul>
            )}
            {load === "ready" && nextCursor ? (
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

function RequestCard({
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
    const pending = request.status === "pending"
    const name = request.proposal.name
    // A pending change request is compared with the team as it is now.
    const current = useAdminTeam(
        pending && request.kind === "update" ? request.teamId : null
    )
    const action = (template: string) => fillTemplate(template, { name })
    return (
        <article
            aria-labelledby={`${id}-title`}
            className="border-border/60 bg-card space-y-4 rounded-2xl border p-4 sm:p-5"
        >
            <header className="flex flex-wrap items-center gap-2">
                <h2 id={`${id}-title`} className="sr-only">
                    {fillTemplate(t.requestFor, { name })}
                </h2>
                <Badge variant="secondary">{t.kinds[request.kind]}</Badge>
                <Badge variant="outline">{GAME_LABELS[request.gameId]}</Badge>
                {pending ? null : (
                    <Badge variant="outline">
                        {t.statuses[request.status]}
                    </Badge>
                )}
            </header>
            <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <Fact label={t.workspace}>
                    {request.workspaceName ??
                        fillTemplate(t.unknownWorkspace, {
                            id: request.guildId,
                        })}
                </Fact>
                <Fact label={t.requester}>
                    <span className="font-mono">
                        {request.requestedBy ?? t.hiddenRequester}
                    </span>
                </Fact>
                <Fact label={t.submitted}>
                    {formatAdminDate(request.createdAt, locale)}
                </Fact>
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
            </dl>
            <div className="grid gap-4 lg:grid-cols-2">
                <section
                    aria-labelledby={`${id}-proposal`}
                    className="space-y-2 rounded-md border p-3"
                >
                    <h3 id={`${id}-proposal`} className="text-sm font-medium">
                        {t.proposal}
                    </h3>
                    <TeamSummary
                        labels={labels}
                        team={request.proposal}
                        changed={
                            current.team
                                ? proposalChanges(
                                      request.proposal,
                                      current.team
                                  )
                                : undefined
                        }
                    />
                </section>
                {request.kind === "update" ? (
                    <section
                        aria-labelledby={`${id}-current`}
                        className="space-y-2 rounded-md border p-3"
                    >
                        <h3
                            id={`${id}-current`}
                            className="text-sm font-medium"
                        >
                            {t.currentTeam}
                        </h3>
                        {pending ? (
                            <CurrentTeam labels={labels} current={current} />
                        ) : (
                            <p className="text-sm">
                                {request.teamName ?? t.currentTeamMissing}
                            </p>
                        )}
                    </section>
                ) : null}
            </div>
            {request.note ? (
                <div className="space-y-1">
                    <h3 className="text-sm font-medium">{t.note}</h3>
                    <p className="text-muted-foreground text-sm break-words whitespace-pre-line">
                        {request.note}
                    </p>
                </div>
            ) : null}
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
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        aria-label={action(t.approveRequest)}
                        onClick={() => onAction("approve")}
                    >
                        {t.approve}
                    </Button>
                    {request.kind === "create" ? (
                        <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            aria-label={action(t.mergeRequest)}
                            onClick={() => onAction("merge")}
                        >
                            {t.merge}
                        </Button>
                    ) : null}
                    <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        aria-label={action(t.rejectRequest)}
                        onClick={() => onAction("reject")}
                    >
                        {t.reject}
                    </Button>
                </div>
            ) : null}
        </article>
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
