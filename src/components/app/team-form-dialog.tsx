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
    fetchTeamRecord,
    restoreTeam,
    sendTeamCommand,
    uploadTeamLogo,
    type TeamErrorCode,
} from "@/lib/teams/team-client"
import {
    rebaseTeamFormValues,
    teamFormCommand,
    teamFormValues,
    teamLogoUploadMessage,
} from "@/lib/teams/team-form"
import {
    TEAM_NAME_MAX,
    TEAM_SHORT_CODE_MAX,
    type TeamGame,
    type TeamRecord,
} from "@/domain/teams/team"
import { IMAGE_INPUT_TYPES } from "@/domain/assets/image-asset"
import { useId, useRef, useState, type FormEvent } from "react"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

export type TeamFormOutcome = "saved" | "selected" | "restored"
export type TeamFormDialogProps = {
    serverId: string
    gameId: TeamGame
    dictionary: Dictionary
    open: boolean
    onOpenChange(open: boolean): void
    /** Editing target; absent creates a new team in `gameId`. */
    team?: TeamRecord | null
    /**
     * Receives the re-read record after a successful create or update, or the
     * existing team the admin chose (`selected`, or `restored` from the
     * archive) after a duplicate-name conflict.
     */
    onSaved(team: TeamRecord, outcome?: TeamFormOutcome): void
    /** Receives the latest record (or `null` when gone) after a stale-revision rejection. */
    onStale?(teamId: string, team: TeamRecord | null): void
}

/**
 * Create/edit dialog for one directory entry. The body mounts per open, so the
 * create idempotency key is generated once per dialog and reused on retry.
 */
export function TeamFormDialog(props: TeamFormDialogProps) {
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <TeamFormBody {...props} />
            </DialogContent>
        </Dialog>
    )
}

const ACCEPT = IMAGE_INPUT_TYPES.join(",")
/** Errors after which the stored record is re-read so the next attempt uses its revision. */
const STALE: ReadonlySet<TeamErrorCode> = new Set([
    "revision_conflict",
    "archived",
    "not_found",
])

function TeamFormBody({
    serverId,
    gameId,
    dictionary,
    onOpenChange,
    team,
    onSaved,
    onStale,
}: TeamFormDialogProps) {
    const t = dictionary.teams,
        id = useId()
    const [idempotencyKey] = useState(() => crypto.randomUUID())
    // The record the inputs were last synchronized with; refreshed after a conflict.
    const [base, setBase] = useState<TeamRecord | null>(team ?? null)
    const [initial] = useState(() => teamFormValues(team))
    const [name, setName] = useState(initial.name)
    const [shortCode, setShortCode] = useState(initial.shortCode)
    const [logo, setLogo] = useState(initial.logo)
    const [pending, setPending] = useState(false),
        [uploading, setUploading] = useState(false),
        [failure, setFailure] = useState<string | null>(null)
    // The same-name team a create collided with; the admin may use or restore it.
    const [duplicate, setDuplicate] = useState<TeamRecord | null>(null)
    const fileInput = useRef<HTMLInputElement>(null)
    const busy = pending || uploading
    const editing = Boolean(team)

    async function upload(file: File) {
        setFailure(null)
        setUploading(true)
        try {
            const result = await uploadTeamLogo(serverId, file)
            if (result.ok)
                setLogo({ assetId: result.asset.id, url: result.asset.url })
            else setFailure(teamLogoUploadMessage(t.uploadErrors, result))
        } finally {
            setUploading(false)
            if (fileInput.current) fileInput.current.value = ""
        }
    }

    async function reloadAfter(error: TeamErrorCode, previous: TeamRecord) {
        let latest: TeamRecord | null
        try {
            latest = await fetchTeamRecord(serverId, previous.id)
        } catch {
            // Nothing was reloaded, so the conflict message must not claim it was.
            setFailure(
                error === "revision_conflict"
                    ? t.conflictReloadFailed
                    : t.errors[error]
            )
            return
        }
        onStale?.(previous.id, latest)
        if (!latest) {
            setFailure(t.errors.not_found)
            return
        }
        // Untouched fields show the latest values; the user's own edits are kept.
        const next = rebaseTeamFormValues(
            { name, shortCode, logo },
            previous,
            latest
        )
        setBase(latest)
        setName(next.name)
        setShortCode(next.shortCode)
        setLogo(next.logo)
        setFailure(latest.archivedAt ? t.errors.archived : t.errors[error])
    }

    /** Loads the conflicting team so it can be used (active) or restored (archived). */
    async function offerExisting(existingId: string) {
        const existing = await fetchTeamRecord(serverId, existingId).catch(
            () => null
        )
        if (!existing || existing.gameId !== gameId) {
            setFailure(t.errors.duplicate_name)
            return
        }
        setDuplicate(existing)
        setFailure(
            existing.archivedAt ? t.duplicateArchived : t.duplicateActive
        )
    }

    async function adoptExisting(existing: TeamRecord) {
        if (!existing.archivedAt) {
            onSaved(existing, "selected")
            onOpenChange(false)
            return
        }
        setPending(true)
        setFailure(null)
        try {
            const restored = await restoreTeam(serverId, existing)
            if (restored.ok) {
                onSaved(restored.team, "restored")
                onOpenChange(false)
                return
            }
            // Someone else changed it: show the latest state for the next choice.
            const latest = await fetchTeamRecord(serverId, existing.id).catch(
                () => null
            )
            setDuplicate(latest && latest.gameId === gameId ? latest : null)
            setFailure(t.errors[restored.code])
        } finally {
            setPending(false)
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        // The dialog may be portaled out of another form (the match editor); keep its submit local.
        event.stopPropagation()
        const command = teamFormCommand({
            base,
            values: { name, shortCode, logo },
            gameId,
            idempotencyKey,
        })
        if (command.kind === "invalid") {
            setFailure(t.errors.invalid_team)
            return
        }
        if (command.kind === "unchanged") {
            onOpenChange(false)
            return
        }
        const { request } = command
        setPending(true)
        setFailure(null)
        setDuplicate(null)
        try {
            const result = await sendTeamCommand(serverId, request)
            if (!result.ok) {
                if (base && STALE.has(result.code))
                    await reloadAfter(result.code, base)
                else if (
                    !base &&
                    result.code === "duplicate_name" &&
                    result.existingId
                )
                    await offerExisting(result.existingId)
                else setFailure(t.errors[result.code])
                return
            }
            const teamId = base?.id ?? result.teamId
            const saved = teamId
                ? await fetchTeamRecord(serverId, teamId).catch(() => null)
                : null
            if (!saved) {
                // The write succeeded or replays; retrying re-reads it with the same key.
                setFailure(t.errors.unavailable)
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
                    {editing ? t.editTitle : t.createTitle}
                </DialogTitle>
                <DialogDescription>{GAME_LABELS[gameId]}</DialogDescription>
            </DialogHeader>
            <fieldset className="space-y-2">
                <legend className="text-sm leading-none font-medium">
                    {t.logo}
                </legend>
                <div className="flex items-start gap-4 pt-2">
                    <TeamLogo
                        name={name.trim()}
                        shortCode={shortCode.trim() || null}
                        logoUrl={logo.url}
                        className="size-16 text-base"
                    />
                    <div className="space-y-2">
                        <input
                            ref={fileInput}
                            id={`${id}-logo`}
                            type="file"
                            accept={ACCEPT}
                            className="sr-only"
                            tabIndex={-1}
                            disabled={busy}
                            aria-describedby={`${id}-logo-help`}
                            onChange={(event) => {
                                const file = event.target.files?.[0]
                                if (file) void upload(file)
                            }}
                        />
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                aria-describedby={`${id}-logo-help`}
                                onClick={() => fileInput.current?.click()}
                            >
                                {uploading ? t.uploading : t.upload}
                            </Button>
                            {logo.assetId ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    disabled={busy}
                                    onClick={() =>
                                        setLogo({ assetId: null, url: null })
                                    }
                                >
                                    {t.removeLogo}
                                </Button>
                            ) : null}
                        </div>
                        <p
                            id={`${id}-logo-help`}
                            className="text-muted-foreground text-xs"
                        >
                            {t.logoHelp}
                        </p>
                    </div>
                </div>
            </fieldset>
            <div className="space-y-2">
                <Label htmlFor={`${id}-name`}>{t.name}</Label>
                <Input
                    id={`${id}-name`}
                    value={name}
                    maxLength={TEAM_NAME_MAX}
                    required
                    autoFocus
                    autoComplete="off"
                    disabled={pending}
                    onChange={(event) => {
                        setName(event.target.value)
                        // A different name no longer collides with the offered team.
                        setDuplicate(null)
                    }}
                />
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${id}-code`}>{t.shortCode}</Label>
                <Input
                    id={`${id}-code`}
                    value={shortCode}
                    maxLength={TEAM_SHORT_CODE_MAX}
                    autoComplete="off"
                    disabled={pending}
                    aria-describedby={`${id}-code-help`}
                    onChange={(event) => setShortCode(event.target.value)}
                />
                <p
                    id={`${id}-code-help`}
                    className="text-muted-foreground text-xs"
                >
                    {t.shortCodeHelp}
                </p>
            </div>
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
                        className="size-8 text-xs"
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {duplicate.name}
                    </span>
                    <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        disabled={busy}
                        onClick={() => void adoptExisting(duplicate)}
                    >
                        {duplicate.archivedAt
                            ? t.restoreExisting
                            : t.useExisting}
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
                <Button type="submit" disabled={busy}>
                    {pending ? t.saving : t.save}
                </Button>
            </DialogFooter>
        </form>
    )
}
