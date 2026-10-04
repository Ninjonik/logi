"use client"

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
    sendAdminTeamCommand,
    type TeamAdminErrorCode,
} from "@/lib/teams-admin/team-admin-client"
import type { TeamCatalogLabels } from "@/components/app/team-fields-editor"
import { TeamSearchPicker } from "@/components/app/team-search-picker"
import { fillTemplate } from "@/lib/teams-admin/team-admin-list"
import { useId, useState, type FormEvent } from "react"
import type { TeamRecord } from "@/domain/teams/team"
import { Button } from "@/components/ui/button"

export type TeamMergeDialogProps = {
    labels: TeamCatalogLabels
    /** The duplicate that is archived and points to the chosen team. */
    source: TeamRecord
    open: boolean
    onOpenChange(open: boolean): void
    /** Receives both re-read records (null when a re-read failed) after the merge. */
    onMerged(
        source: TeamRecord | null,
        target: TeamRecord | null,
        names: { source: string; target: string }
    ): void
    /** Receives the latest source record (or null when gone) after a stale rejection. */
    onStale(teamId: string, team: TeamRecord | null): void
}

export function TeamMergeDialog(props: TeamMergeDialogProps) {
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <MergeBody {...props} />
            </DialogContent>
        </Dialog>
    )
}

/** Rejections after which both sides are re-read so the next attempt uses current revisions. */
const STALE: ReadonlySet<TeamAdminErrorCode> = new Set([
    "revision_conflict",
    "not_found",
    "invalid_merge",
    "archived",
])

function MergeBody({
    labels,
    source,
    onOpenChange,
    onMerged,
    onStale,
}: TeamMergeDialogProps) {
    const id = useId()
    const [current, setCurrent] = useState(source)
    const [target, setTarget] = useState<TeamRecord | null>(null)
    const [pending, setPending] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)
    const names = { source: current.name, target: target?.name ?? "…" }

    async function reloadAfter(code: TeamAdminErrorCode) {
        // `undefined` means the re-read failed; `null` means the team is gone.
        const [latestSource, latestTarget] = await Promise.all([
            fetchAdminTeam(current.id).catch(() => undefined),
            target ? fetchAdminTeam(target.id).catch(() => undefined) : null,
        ])
        if (latestSource !== undefined) {
            onStale(current.id, latestSource)
            if (latestSource) setCurrent(latestSource)
        }
        if (latestTarget !== undefined)
            setTarget(
                latestTarget && !latestTarget.archivedAt ? latestTarget : null
            )
        setFailure(
            latestSource === null
                ? labels.errors.not_found
                : latestSource?.mergedIntoTeamId
                  ? labels.errors.invalid_merge
                  : code === "revision_conflict" && latestSource
                    ? labels.staleRow
                    : labels.errors[code]
        )
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!target) {
            setFailure(labels.mergeChooseTarget)
            return
        }
        setPending(true)
        setFailure(null)
        try {
            const result = await sendAdminTeamCommand({
                action: "merge",
                teamId: current.id,
                input: {
                    expectedRevision: current.revision,
                    targetTeamId: target.id,
                    targetRevision: target.revision,
                },
            })
            if (!result.ok) {
                if (STALE.has(result.code)) await reloadAfter(result.code)
                else setFailure(labels.errors[result.code])
                return
            }
            const [mergedSource, keptTarget] = await Promise.all([
                fetchAdminTeam(current.id).catch(() => null),
                fetchAdminTeam(target.id).catch(() => null),
            ])
            onMerged(mergedSource, keptTarget, {
                source: current.name,
                target: target.name,
            })
            onOpenChange(false)
        } finally {
            setPending(false)
        }
    }

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            <DialogHeader>
                <DialogTitle>
                    {fillTemplate(labels.mergeTitle, { name: current.name })}
                </DialogTitle>
                <DialogDescription>
                    {fillTemplate(labels.mergeDescription, {
                        name: current.name,
                    })}
                </DialogDescription>
            </DialogHeader>
            <TeamSearchPicker
                gameId={current.gameId}
                excludeId={current.id}
                value={target}
                onChange={(team) => {
                    setTarget(team)
                    setFailure(null)
                }}
                disabled={pending}
                labels={{
                    legend: labels.mergeTarget,
                    search: labels.mergeSearch,
                    hint: labels.mergeSearchHint,
                    noResults: labels.mergeNoResults,
                    loading: labels.mergeLoading,
                    error: labels.errors.unavailable,
                }}
            />
            <section
                aria-labelledby={`${id}-moves`}
                className="bg-muted/40 space-y-2 rounded-md border p-3"
            >
                <h3 id={`${id}-moves`} className="text-sm font-medium">
                    {labels.mergeMovesTitle}
                </h3>
                <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                    <li>
                        {fillTemplate(labels.mergeMovesRegistrations, names)}
                    </li>
                    <li>{fillTemplate(labels.mergeMovesRequests, names)}</li>
                    <li>{fillTemplate(labels.mergeMovesArchive, names)}</li>
                    <li>{labels.mergeMovesSnapshots}</li>
                </ul>
            </section>
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
                    {labels.cancel}
                </Button>
                <Button
                    type="submit"
                    variant="destructive"
                    disabled={pending || !target}
                >
                    {pending ? labels.merging : labels.mergeConfirm}
                </Button>
            </DialogFooter>
        </form>
    )
}
