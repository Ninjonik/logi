"use client"

import {
    catalogueFormCommand,
    editorValuesFromTeam,
    rebaseCatalogueForm,
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
    sendAdminTeamCommand,
    type TeamAdminErrorCode,
} from "@/lib/teams-admin/team-admin-client"
import {
    TeamFieldsEditor,
    type TeamCatalogLabels,
} from "@/components/app/team-fields-editor"
import {
    fillTemplate,
    type WorkspaceOption,
} from "@/lib/teams-admin/team-admin-list"
import type { TeamGame, TeamRecord } from "@/domain/teams/team"
import { useId, useState, type FormEvent } from "react"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

export type TeamCatalogueDialogProps = {
    labels: TeamCatalogLabels
    gameId: TeamGame
    /** Editing target; null creates a new team in `gameId`. */
    team: TeamRecord | null
    workspaces: readonly WorkspaceOption[]
    open: boolean
    onOpenChange(open: boolean): void
    /** Receives the re-read record after a successful create or update. */
    onSaved(team: TeamRecord): void
    /** Receives the latest record (or null when gone) after a stale rejection. */
    onStale(teamId: string, team: TeamRecord | null): void
}

/**
 * Add/Edit dialog for one catalogue team. The body mounts per open, so the
 * create idempotency key is generated once per dialog and reused on retry.
 */
export function TeamCatalogueDialog(props: TeamCatalogueDialogProps) {
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <CatalogueDialogBody {...props} />
            </DialogContent>
        </Dialog>
    )
}

/** Errors after which the stored record is re-read so the next attempt uses its revision. */
const STALE: ReadonlySet<TeamAdminErrorCode> = new Set([
    "revision_conflict",
    "archived",
    "not_found",
])

function CatalogueDialogBody({
    labels,
    gameId,
    team,
    workspaces,
    onOpenChange,
    onSaved,
    onStale,
}: TeamCatalogueDialogProps) {
    const id = useId()
    const [idempotencyKey] = useState(() => crypto.randomUUID())
    // The record the inputs were last synchronized with; refreshed after a conflict.
    const [base, setBase] = useState<TeamRecord | null>(team)
    const [values, setValues] = useState(() => editorValuesFromTeam(team))
    const [linkedGuildId, setLinkedGuildId] = useState(
        team?.linkedGuildId ?? ""
    )
    const [invalidField, setInvalidField] = useState<
        TeamEditorField | "linkedGuildId" | null
    >(null)
    const [pending, setPending] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)
    const linkedKnown =
        !linkedGuildId ||
        workspaces.some((workspace) => workspace.id === linkedGuildId)

    async function reloadAfter(code: TeamAdminErrorCode, previous: TeamRecord) {
        let latest: TeamRecord | null
        try {
            latest = await fetchAdminTeam(previous.id)
        } catch {
            // Nothing was reloaded, so the message must not claim it was.
            setFailure(
                code === "revision_conflict"
                    ? labels.conflictReloadFailed
                    : labels.errors[code]
            )
            return
        }
        onStale(previous.id, latest)
        if (!latest) {
            setFailure(labels.errors.not_found)
            return
        }
        // Untouched fields show the latest values; the administrator's own edits are kept.
        const next = rebaseCatalogueForm(
            { values, linkedGuildId },
            previous,
            latest
        )
        setBase(latest)
        setValues(next.values)
        setLinkedGuildId(next.linkedGuildId)
        setFailure(
            latest.archivedAt
                ? labels.errors.archived
                : code === "revision_conflict"
                  ? labels.conflictReloaded
                  : labels.errors[code]
        )
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        const built = catalogueFormCommand({
            base,
            values,
            linkedGuildId,
            gameId,
            idempotencyKey,
        })
        if (built.kind === "invalid") {
            setInvalidField(built.field)
            setFailure(null)
            return
        }
        setInvalidField(null)
        if (built.kind === "unchanged") {
            onOpenChange(false)
            return
        }
        setPending(true)
        setFailure(null)
        try {
            const result = await sendAdminTeamCommand(built.command)
            if (!result.ok) {
                if (base && STALE.has(result.code))
                    await reloadAfter(result.code, base)
                else setFailure(labels.errors[result.code])
                return
            }
            const teamId = base?.id ?? result.teamId
            const saved = teamId
                ? await fetchAdminTeam(teamId).catch(() => null)
                : null
            if (!saved) {
                // The write succeeded or replays; retrying re-reads it with the same key.
                setFailure(labels.errors.unavailable)
                return
            }
            onSaved(saved)
            onOpenChange(false)
        } finally {
            setPending(false)
        }
    }

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            <DialogHeader>
                <DialogTitle>
                    {base ? labels.editTitle : labels.createTitle}
                </DialogTitle>
                <DialogDescription>{GAME_LABELS[gameId]}</DialogDescription>
            </DialogHeader>
            <TeamFieldsEditor
                labels={labels}
                idPrefix={id}
                values={values}
                onChange={setValues}
                disabled={pending}
                invalidField={
                    invalidField === "linkedGuildId" ? null : invalidField
                }
                onUploadingChange={setUploading}
                autoFocus
            />
            <div className="space-y-2">
                <Label htmlFor={`${id}-workspace`}>
                    {labels.linkedWorkspace}
                </Label>
                <select
                    id={`${id}-workspace`}
                    value={linkedGuildId}
                    disabled={pending}
                    aria-invalid={invalidField === "linkedGuildId" || undefined}
                    aria-describedby={`${id}-workspace-help`}
                    onChange={(event) => setLinkedGuildId(event.target.value)}
                    className="border-input bg-background flex h-9 w-full rounded-md border px-3 text-sm"
                >
                    <option value="">{labels.linkedWorkspaceNone}</option>
                    {linkedKnown ? null : (
                        <option value={linkedGuildId}>
                            {fillTemplate(labels.linkedWorkspaceUnknown, {
                                id: linkedGuildId,
                            })}
                        </option>
                    )}
                    {workspaces.map((workspace) => (
                        <option key={workspace.id} value={workspace.id}>
                            {workspace.name}
                        </option>
                    ))}
                </select>
                <p
                    id={`${id}-workspace-help`}
                    className="text-muted-foreground text-xs"
                >
                    {invalidField === "linkedGuildId"
                        ? labels.fieldErrors.linkedGuildId
                        : labels.linkedWorkspaceHelp}
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
                    {labels.cancel}
                </Button>
                <Button type="submit" disabled={pending || uploading}>
                    {pending ? labels.saving : labels.save}
                </Button>
            </DialogFooter>
        </form>
    )
}
