"use client"

import {
    fetchTeamRecord,
    sendTeamCommand,
    uploadTeamLogo,
    type TeamCommandRequest,
    type TeamErrorCode,
} from "@/lib/teams/team-client"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
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

export type TeamFormDialogProps = {
    serverId: string
    gameId: TeamGame
    dictionary: Dictionary
    open: boolean
    onOpenChange(open: boolean): void
    /** Editing target; absent creates a new team in `gameId`. */
    team?: TeamRecord | null
    /** Receives the re-read record after a successful create or update. */
    onSaved(team: TeamRecord): void
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

type Logo = { assetId: string | null; url: string | null }
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
    // The revision the next update is checked against; refreshed after a conflict.
    const [base, setBase] = useState<TeamRecord | null>(team ?? null)
    const [name, setName] = useState(team?.name ?? "")
    const [shortCode, setShortCode] = useState(team?.shortCode ?? "")
    const [logo, setLogo] = useState<Logo>({
        assetId: team?.logoAssetId ?? null,
        url: team?.logoUrl ?? null,
    })
    const [pending, setPending] = useState(false),
        [uploading, setUploading] = useState(false),
        [failure, setFailure] = useState<string | null>(null)
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
            else setFailure(t.uploadErrors[result.code])
        } finally {
            setUploading(false)
            if (fileInput.current) fileInput.current.value = ""
        }
    }

    function command(
        trimmedName: string,
        code: string | null
    ): TeamCommandRequest | null {
        if (!base)
            return {
                action: "create",
                input: {
                    gameId,
                    name: trimmedName,
                    shortCode: code,
                    logoAssetId: logo.assetId,
                    idempotencyKey,
                },
            }
        const input = {
            expectedRevision: base.revision,
            ...(trimmedName !== base.name ? { name: trimmedName } : {}),
            ...(code !== base.shortCode ? { shortCode: code } : {}),
            ...(logo.assetId !== base.logoAssetId
                ? { logoAssetId: logo.assetId }
                : {}),
        }
        return Object.keys(input).length > 1
            ? { action: "update", teamId: base.id, input }
            : null
    }

    async function reloadAfter(error: TeamErrorCode, teamId: string) {
        try {
            const latest = await fetchTeamRecord(serverId, teamId)
            if (latest) setBase(latest)
            onStale?.(teamId, latest)
            if (!latest) setFailure(t.errors.not_found)
            else if (latest.archivedAt) setFailure(t.errors.archived)
            else setFailure(t.errors[error])
        } catch {
            setFailure(t.errors[error])
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        // The dialog may be portaled out of another form (the match editor); keep its submit local.
        event.stopPropagation()
        const trimmedName = name.trim().replace(/\s+/g, " "),
            code = shortCode.trim() || null
        if (!trimmedName) {
            setFailure(t.errors.invalid_team)
            return
        }
        const request = command(trimmedName, code)
        if (!request) {
            onOpenChange(false)
            return
        }
        setPending(true)
        setFailure(null)
        try {
            const result = await sendTeamCommand(serverId, request)
            if (!result.ok) {
                if (base && STALE.has(result.code))
                    await reloadAfter(result.code, base.id)
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
                    onChange={(event) => setName(event.target.value)}
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
