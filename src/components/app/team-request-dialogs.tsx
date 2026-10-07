"use client"

import {
    approveDecision,
    editorValuesFromProposal,
    proposalChanges,
    rejectDecision,
    type TeamEditorField,
} from "@/lib/teams-admin/team-editor"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    fetchAdminTeam,
    sendTeamRequestDecision,
    type TeamRequestAdminErrorCode,
} from "@/lib/teams-admin/team-admin-client"
import {
    TeamFieldsEditor,
    type TeamCatalogLabels,
} from "@/components/app/team-fields-editor"
import type {
    TeamRequestDecision,
    TeamRequestRecord,
} from "@/domain/teams/team-request"
import { TeamSearchPicker } from "@/components/app/team-search-picker"
import { TEAM_REQUEST_REASON_MAX } from "@/domain/teams/team-request"
import { useEffect, useId, useState, type FormEvent } from "react"
import { fillTemplate } from "@/lib/teams-admin/team-admin-list"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import type { TeamRecord } from "@/domain/teams/team"
import { Textarea } from "@/components/ui/textarea"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

export type TeamRequestLabels = Dictionary["teamRequestAdmin"]
export type RequestDialogLabels = {
    requests: TeamRequestLabels
    catalog: TeamCatalogLabels
}
export type DecidedStatus = "approved" | "merged" | "rejected"

export type AdminTeamState = {
    status: "idle" | "loading" | "ready" | "missing" | "error"
    team: TeamRecord | null
}

/** Reads one catalogue team for display; `reload` re-reads it after a conflict. */
export function useAdminTeam(teamId: string | null) {
    const [state, setState] = useState<AdminTeamState>({
        status: teamId ? "loading" : "idle",
        team: null,
    })
    const [version, setVersion] = useState(0)
    useEffect(() => {
        if (!teamId) return
        const controller = new AbortController()
        async function load(id: string) {
            setState((previous) => ({ status: "loading", team: previous.team }))
            try {
                const team = await fetchAdminTeam(id, {
                    signal: controller.signal,
                })
                setState(
                    team
                        ? { status: "ready", team }
                        : { status: "missing", team: null }
                )
            } catch {
                if (!controller.signal.aborted)
                    setState((previous) => ({
                        status: "error",
                        team: previous.team,
                    }))
            }
        }
        void load(teamId)
        return () => controller.abort()
    }, [teamId, version])
    return { ...state, reload: () => setVersion((value) => value + 1) }
}

/** A short read-only summary of a catalogue team or a proposal. */
export function TeamSummary({
    labels,
    team,
    changed,
}: {
    labels: RequestDialogLabels
    team: Pick<
        TeamRecord,
        "name" | "shortCode" | "logoUrl" | "description" | "links"
    >
    changed?: ReadonlySet<TeamEditorField | "logo">
}) {
    const mark = (field: TeamEditorField | "logo") =>
        changed?.has(field) ? (
            <Badge variant="secondary" className="ml-2">
                {labels.requests.changed}
            </Badge>
        ) : null
    return (
        <div className="flex items-start gap-3">
            <TeamLogo
                name={team.name}
                shortCode={team.shortCode}
                logoUrl={team.logoUrl}
                className="size-12"
            />
            <dl className="min-w-0 flex-1 space-y-1 text-sm">
                <div>
                    <dt className="sr-only">{labels.catalog.name}</dt>
                    <dd className="font-medium break-words">
                        {team.name}
                        {mark("name")}
                        {mark("logo")}
                    </dd>
                </div>
                <div className="text-muted-foreground flex flex-wrap gap-x-1">
                    <dt>{labels.catalog.shortCode}:</dt>
                    <dd>
                        {team.shortCode ?? labels.requests.none}
                        {mark("shortCode")}
                    </dd>
                </div>
                <div className="text-muted-foreground">
                    <dt className="inline">
                        {labels.catalog.descriptionField}:{" "}
                    </dt>
                    <dd className="inline break-words whitespace-pre-line">
                        {team.description ?? labels.requests.none}
                    </dd>
                    {mark("description")}
                </div>
                <div className="text-muted-foreground">
                    <dt className="inline">{labels.catalog.links}: </dt>
                    <dd className="inline">
                        {team.links.length === 0 ? (
                            labels.requests.none
                        ) : (
                            <ul className="mt-1 space-y-0.5">
                                {team.links.map((link) => (
                                    <li key={link} className="truncate">
                                        <a
                                            href={link}
                                            target="_blank"
                                            rel="noopener noreferrer nofollow"
                                            className="text-primary hover:underline"
                                        >
                                            {link}
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </dd>
                    {mark("links")}
                </div>
            </dl>
        </div>
    )
}

type DialogBaseProps = {
    labels: RequestDialogLabels
    request: TeamRequestRecord
    open: boolean
    onOpenChange(open: boolean): void
    onDecided(request: TeamRequestRecord, status: DecidedStatus): void
    /** The request was decided elsewhere or withdrawn; the queue re-reads it. */
    onStale(request: TeamRequestRecord): void
}

function DecisionDialog({
    open,
    onOpenChange,
    children,
}: {
    open: boolean
    onOpenChange(open: boolean): void
    children: React.ReactNode
}) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                {children}
            </DialogContent>
        </Dialog>
    )
}

/** Sends a decision and routes the outcome; `onFailure` handles what is specific to a dialog. */
async function decide(
    props: DialogBaseProps,
    decision: TeamRequestDecision,
    status: DecidedStatus,
    onFailure: (
        code: TeamRequestAdminErrorCode,
        existingId: string | null
    ) => Promise<void> | void
) {
    const result = await sendTeamRequestDecision(props.request.id, decision)
    if (result.ok) {
        props.onDecided(props.request, status)
        props.onOpenChange(false)
        return
    }
    if (result.code === "not_pending") {
        props.onStale(props.request)
        props.onOpenChange(false)
        return
    }
    await onFailure(result.code, result.existingId)
}

/** Approve with an editable copy of the proposal; a change request shows the current team. */
export function ApproveRequestDialog(props: DialogBaseProps) {
    return (
        <DecisionDialog open={props.open} onOpenChange={props.onOpenChange}>
            <ApproveBody {...props} />
        </DecisionDialog>
    )
}

function ApproveBody(props: DialogBaseProps) {
    const { labels, request, onOpenChange } = props
    const t = labels.requests
    const id = useId()
    const [values, setValues] = useState(() =>
        editorValuesFromProposal(request.proposal)
    )
    const current = useAdminTeam(
        request.kind === "update" ? request.teamId : null
    )
    const [invalidField, setInvalidField] = useState<TeamEditorField | null>(
        null
    )
    const [pending, setPending] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)
    // An existing team that already uses the approved name; offered as a merge target.
    const [duplicate, setDuplicate] = useState<TeamRecord | null>(null)
    const activeTeam =
        current.team && !current.team.archivedAt ? current.team : null

    function teamProblem(): string {
        if (current.status === "missing") return t.currentTeamMissing
        if (current.team?.archivedAt) return t.currentTeamArchived
        return t.currentTeamUnavailable
    }

    async function offerDuplicate(existingId: string) {
        const existing = await fetchAdminTeam(existingId).catch(() => null)
        if (
            existing &&
            !existing.archivedAt &&
            existing.gameId === request.gameId &&
            request.kind === "create"
        ) {
            setDuplicate(existing)
            setFailure(fillTemplate(t.duplicateFound, { name: existing.name }))
        } else setFailure(t.errors.duplicate_name)
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const built = approveDecision({
            request,
            values,
            currentTeam: activeTeam,
        })
        if (built.kind === "invalid") {
            setInvalidField(built.field)
            setFailure(null)
            return
        }
        setInvalidField(null)
        if (built.kind === "needs_team") {
            setFailure(teamProblem())
            return
        }
        setPending(true)
        setFailure(null)
        setDuplicate(null)
        try {
            await decide(
                props,
                built.decision,
                "approved",
                async (code, existingId) => {
                    if (
                        code === "revision_conflict" ||
                        code === "team_archived"
                    ) {
                        // Show the team as it is now; the next approval uses its revision.
                        current.reload()
                        setFailure(
                            code === "revision_conflict"
                                ? t.conflictReloaded
                                : t.currentTeamArchived
                        )
                    } else if (code === "duplicate_name" && existingId)
                        await offerDuplicate(existingId)
                    else if (
                        code === "not_found" &&
                        request.kind === "update"
                    ) {
                        current.reload()
                        setFailure(t.currentTeamMissing)
                    } else setFailure(t.errors[code])
                }
            )
        } finally {
            setPending(false)
        }
    }

    async function mergeIntoDuplicate(target: TeamRecord) {
        setPending(true)
        setFailure(null)
        try {
            await decide(
                props,
                { decision: "merge", targetTeamId: target.id },
                "merged",
                (code) => setFailure(t.errors[code])
            )
        } finally {
            setPending(false)
        }
    }

    const changes =
        request.kind === "update" && current.team
            ? proposalChanges(request.proposal, current.team)
            : undefined

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            <DialogHeader>
                <DialogTitle>{t.approveTitle}</DialogTitle>
                <DialogDescription>
                    {t.approveDescription} ({t.kinds[request.kind]},{" "}
                    {GAME_LABELS[request.gameId]})
                </DialogDescription>
            </DialogHeader>
            {request.kind === "update" ? (
                <section
                    aria-labelledby={`${id}-current`}
                    className="space-y-2 rounded-md border p-3"
                >
                    <h3 id={`${id}-current`} className="text-sm font-medium">
                        {t.currentTeam}
                    </h3>
                    {current.team ? (
                        <TeamSummary
                            labels={labels}
                            team={current.team}
                            changed={changes}
                        />
                    ) : null}
                    {current.status === "loading" ? (
                        <p
                            role="status"
                            className="text-muted-foreground text-sm"
                        >
                            {t.currentTeamLoading}
                        </p>
                    ) : current.status === "missing" ||
                      current.status === "error" ||
                      current.team?.archivedAt ? (
                        <p role="alert" className="text-destructive text-sm">
                            {teamProblem()}
                        </p>
                    ) : null}
                </section>
            ) : null}
            <TeamFieldsEditor
                labels={labels.catalog}
                idPrefix={id}
                values={values}
                onChange={setValues}
                disabled={pending}
                invalidField={invalidField}
                onUploadingChange={setUploading}
            />
            {failure ? (
                <p role="alert" className="text-destructive text-sm">
                    {failure}
                </p>
            ) : null}
            {duplicate ? (
                <div className="flex items-center gap-3 rounded-md border p-2">
                    <TeamLogo
                        name={duplicate.name}
                        shortCode={duplicate.shortCode}
                        logoUrl={duplicate.logoUrl}
                        className="size-8"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {duplicate.name}
                    </span>
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={pending}
                        onClick={() => void mergeIntoDuplicate(duplicate)}
                    >
                        {fillTemplate(t.mergeInto, { name: duplicate.name })}
                    </Button>
                </div>
            ) : null}
            <DialogFooter>
                <Button
                    type="button"
                    variant="outline"
                    disabled={pending}
                    onClick={() => onOpenChange(false)}
                >
                    {t.cancel}
                </Button>
                <Button
                    type="submit"
                    disabled={
                        pending ||
                        uploading ||
                        (request.kind === "update" &&
                            current.status === "loading")
                    }
                >
                    {pending ? t.approving : t.approveConfirm}
                </Button>
            </DialogFooter>
        </form>
    )
}

/** Merge a new-team request into an existing active team of the same game. */
export function MergeRequestDialog(props: DialogBaseProps) {
    return (
        <DecisionDialog open={props.open} onOpenChange={props.onOpenChange}>
            <MergeRequestBody {...props} />
        </DecisionDialog>
    )
}

function MergeRequestBody(props: DialogBaseProps) {
    const { labels, request, onOpenChange } = props
    const t = labels.requests,
        c = labels.catalog
    const [target, setTarget] = useState<TeamRecord | null>(null)
    const [pending, setPending] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!target) {
            setFailure(c.mergeChooseTarget)
            return
        }
        setPending(true)
        setFailure(null)
        try {
            await decide(
                props,
                { decision: "merge", targetTeamId: target.id },
                "merged",
                (code) => {
                    // The chosen team changed state; it must be chosen again.
                    if (
                        code === "team_archived" ||
                        code === "not_found" ||
                        code === "team_game_mismatch"
                    )
                        setTarget(null)
                    setFailure(t.errors[code])
                }
            )
        } finally {
            setPending(false)
        }
    }

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            <DialogHeader>
                <DialogTitle>{t.mergeTitle}</DialogTitle>
                <DialogDescription>
                    {fillTemplate(t.mergeDescription, {
                        game: GAME_LABELS[request.gameId],
                    })}
                </DialogDescription>
            </DialogHeader>
            <TeamSearchPicker
                gameId={request.gameId}
                excludeId={null}
                value={target}
                onChange={(team) => {
                    setTarget(team)
                    setFailure(null)
                }}
                disabled={pending}
                initialSearch={request.proposal.name}
                labels={{
                    legend: c.mergeTarget,
                    search: c.mergeSearch,
                    hint: c.mergeSearchHint,
                    noResults: c.mergeNoResults,
                    loading: c.mergeLoading,
                    error: t.errors.unavailable,
                }}
            />
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
                    onClick={() => onOpenChange(false)}
                >
                    {t.cancel}
                </Button>
                <Button type="submit" disabled={pending || !target}>
                    {pending ? t.merging : t.mergeConfirm}
                </Button>
            </DialogFooter>
        </form>
    )
}

/** Reject with a required reason the requester receives by DM. */
export function RejectRequestDialog(props: DialogBaseProps) {
    return (
        <DecisionDialog open={props.open} onOpenChange={props.onOpenChange}>
            <RejectBody {...props} />
        </DecisionDialog>
    )
}

function RejectBody(props: DialogBaseProps) {
    const { labels, onOpenChange } = props
    const t = labels.requests
    const id = useId()
    const [reason, setReason] = useState("")
    const [invalid, setInvalid] = useState(false)
    const [pending, setPending] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const built = rejectDecision(reason)
        if (built.kind === "invalid") {
            setInvalid(true)
            setFailure(null)
            return
        }
        setInvalid(false)
        setPending(true)
        setFailure(null)
        try {
            await decide(props, built.decision, "rejected", (code) =>
                setFailure(t.errors[code])
            )
        } finally {
            setPending(false)
        }
    }

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            <DialogHeader>
                <DialogTitle>{t.rejectTitle}</DialogTitle>
                <DialogDescription>{t.rejectDescription}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
                <Label htmlFor={`${id}-reason`}>{t.rejectReason}</Label>
                <Textarea
                    id={`${id}-reason`}
                    value={reason}
                    rows={4}
                    required
                    autoFocus
                    maxLength={TEAM_REQUEST_REASON_MAX}
                    disabled={pending}
                    aria-invalid={invalid || undefined}
                    aria-describedby={`${id}-reason-help`}
                    onChange={(event) => setReason(event.target.value)}
                />
                <p
                    id={`${id}-reason-help`}
                    className={
                        invalid
                            ? "text-destructive text-xs"
                            : "text-muted-foreground text-xs"
                    }
                >
                    {invalid ? t.reasonRequired : t.rejectReasonHelp} (
                    {reason.length}/{TEAM_REQUEST_REASON_MAX})
                </p>
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
                    onClick={() => onOpenChange(false)}
                >
                    {t.cancel}
                </Button>
                <Button type="submit" variant="destructive" disabled={pending}>
                    {pending ? t.rejecting : t.rejectConfirm}
                </Button>
            </DialogFooter>
        </form>
    )
}
