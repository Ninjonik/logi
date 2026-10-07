"use client"

import {
    addTeamLinkRow,
    catalogueDuplicate,
    removeTeamLinkRow,
    setTeamLinkRow,
    teamLogoUploadMessage,
    teamRequestFormInput,
    teamRequestFormValues,
    type TeamRequestField,
    type TeamRequestFieldErrors,
    type TeamRequestTarget,
} from "@/lib/teams/team-request-form"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    TEAM_DESCRIPTION_MAX,
    TEAM_LINKS_MAX,
    TEAM_NAME_MAX,
    TEAM_SHORT_CODE_MAX,
} from "@/domain/teams/team"
import {
    submitTeamRequest,
    teamRequestErrorMessage,
} from "@/lib/teams/team-request-client"
import { fetchTeamPage, uploadTeamLogo } from "@/lib/teams/team-client"
import { TEAM_REQUEST_NOTE_MAX } from "@/domain/teams/team-request"
import { IMAGE_INPUT_TYPES } from "@/domain/assets/image-asset"
import { useId, useRef, useState, type FormEvent } from "react"
import { fillTeamTemplate } from "@/lib/teams/team-list"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { Textarea } from "@/components/ui/textarea"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Plus, X } from "lucide-react"

export type TeamRequestDialogProps = {
    serverId: string
    dictionary: Dictionary
    open: boolean
    onOpenChange(open: boolean): void
    /** A new team in a game, or a change to an existing active team. */
    target: TeamRequestTarget
    /** Prefilled name of a new-team request, such as the match picker's typed search. */
    initialName?: string
    onSubmitted(result: { requestId: string; replayed: boolean }): void
}

/**
 * Request dialog for a new catalogue team or a change to an existing one.
 * The body mounts per open, so the idempotency key is generated once per
 * dialog and reused when the same request is retried.
 */
export function TeamRequestDialog(props: TeamRequestDialogProps) {
    return (
        <Dialog open={props.open} onOpenChange={props.onOpenChange}>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
                <TeamRequestBody {...props} />
            </DialogContent>
        </Dialog>
    )
}

const ACCEPT = IMAGE_INPUT_TYPES.join(",")
/** Duplicate pre-check size: the catalogue's best matches for the typed name. */
const DUPLICATE_CHECK_LIMIT = 20

function TeamRequestBody({
    serverId,
    dictionary,
    onOpenChange,
    target,
    initialName,
    onSubmitted,
}: TeamRequestDialogProps) {
    const t = dictionary.teams,
        r = dictionary.teamRequests,
        id = useId()
    const [idempotencyKey] = useState(() => crypto.randomUUID())
    const [initial] = useState(() => teamRequestFormValues(target, initialName))
    const [name, setName] = useState(initial.name)
    const [shortCode, setShortCode] = useState(initial.shortCode)
    const [logo, setLogo] = useState(initial.logo)
    const [description, setDescription] = useState(initial.description)
    const [links, setLinks] = useState(initial.links)
    const [note, setNote] = useState(initial.note)
    const [pending, setPending] = useState(false),
        [uploading, setUploading] = useState(false),
        [failure, setFailure] = useState<string | null>(null),
        [errors, setErrors] = useState<TeamRequestFieldErrors>({}),
        [invalidLinks, setInvalidLinks] = useState<number[]>([])
    const fileInput = useRef<HTMLInputElement>(null)
    const busy = pending || uploading
    const gameId = target.kind === "update" ? target.team.gameId : target.gameId
    const game = GAME_LABELS[gameId]

    function clear(field: TeamRequestField) {
        setErrors((current) => {
            if (!(field in current)) return current
            const next = { ...current }
            delete next[field]
            return next
        })
    }
    function fieldError(field: TeamRequestField) {
        const issue = errors[field]
        return issue ? r.validation[issue] : null
    }

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

    /** The active catalogue team a new-team request would duplicate; a failed check does not block. */
    async function existingTeam(requestedName: string) {
        if (target.kind !== "create") return null
        try {
            const page = await fetchTeamPage(serverId, {
                gameId: target.gameId,
                search: requestedName,
                limit: DUPLICATE_CHECK_LIMIT,
            })
            return catalogueDuplicate(page.items, requestedName)
        } catch {
            return null
        }
    }

    async function submit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        // The dialog may be portaled out of another form (the match editor); keep its submit local.
        event.stopPropagation()
        const built = teamRequestFormInput({
            target,
            values: { name, shortCode, logo, description, links, note },
            idempotencyKey,
        })
        setErrors(built.kind === "invalid" ? built.errors : {})
        setInvalidLinks(built.kind === "invalid" ? built.invalidLinks : [])
        if (built.kind === "invalid") {
            // One announced summary; each field shows its own message.
            setFailure(r.validation.invalid)
            return
        }
        if (built.kind === "unchanged") {
            setFailure(r.dialog.unchanged)
            return
        }
        setPending(true)
        setFailure(null)
        try {
            const duplicate = await existingTeam(built.input.proposal.name)
            if (duplicate) {
                setFailure(
                    fillTeamTemplate(r.dialog.duplicate, {
                        name: duplicate.name,
                    })
                )
                return
            }
            // A failed attempt keeps every input and the key, so sending again replays safely.
            const result = await submitTeamRequest(serverId, built.input)
            if (!result.ok) {
                setFailure(teamRequestErrorMessage(dictionary, result.code))
                return
            }
            onSubmitted({
                requestId: result.requestId,
                replayed: result.replayed,
            })
            onOpenChange(false)
        } finally {
            setPending(false)
        }
    }

    const describe = (...ids: (string | false | null | undefined)[]) =>
        ids.filter(Boolean).join(" ") || undefined
    const nameError = fieldError("name"),
        codeError = fieldError("shortCode"),
        descriptionError = fieldError("description"),
        linksError = fieldError("links"),
        noteError = fieldError("note")

    return (
        <form onSubmit={submit} className="space-y-5" noValidate>
            <DialogHeader>
                <DialogTitle>
                    {target.kind === "update"
                        ? r.dialog.updateTitle
                        : r.dialog.createTitle}
                </DialogTitle>
                <DialogDescription>
                    {target.kind === "update"
                        ? fillTeamTemplate(r.dialog.updateDescription, {
                              game,
                              name: target.team.name,
                          })
                        : fillTeamTemplate(r.dialog.createDescription, {
                              game,
                          })}
                </DialogDescription>
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
                            aria-hidden
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
                    aria-invalid={nameError ? true : undefined}
                    aria-describedby={describe(nameError && `${id}-name-error`)}
                    onChange={(event) => {
                        setName(event.target.value)
                        clear("name")
                    }}
                />
                {nameError ? (
                    <p
                        id={`${id}-name-error`}
                        className="text-destructive text-xs"
                    >
                        {nameError}
                    </p>
                ) : null}
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${id}-code`}>{t.shortCode}</Label>
                <Input
                    id={`${id}-code`}
                    value={shortCode}
                    maxLength={TEAM_SHORT_CODE_MAX}
                    autoComplete="off"
                    disabled={pending}
                    aria-invalid={codeError ? true : undefined}
                    aria-describedby={describe(
                        `${id}-code-help`,
                        codeError && `${id}-code-error`
                    )}
                    onChange={(event) => {
                        setShortCode(event.target.value)
                        clear("shortCode")
                    }}
                />
                <p
                    id={`${id}-code-help`}
                    className="text-muted-foreground text-xs"
                >
                    {t.shortCodeHelp}
                </p>
                {codeError ? (
                    <p
                        id={`${id}-code-error`}
                        className="text-destructive text-xs"
                    >
                        {codeError}
                    </p>
                ) : null}
            </div>
            <div className="space-y-2">
                <Label htmlFor={`${id}-description`}>
                    {r.dialog.description}
                </Label>
                <Textarea
                    id={`${id}-description`}
                    value={description}
                    maxLength={TEAM_DESCRIPTION_MAX}
                    rows={3}
                    disabled={pending}
                    aria-invalid={descriptionError ? true : undefined}
                    aria-describedby={describe(
                        `${id}-description-help`,
                        descriptionError && `${id}-description-error`
                    )}
                    onChange={(event) => {
                        setDescription(event.target.value)
                        clear("description")
                    }}
                />
                <p
                    id={`${id}-description-help`}
                    className="text-muted-foreground text-xs"
                >
                    {r.dialog.descriptionHelp}
                </p>
                {descriptionError ? (
                    <p
                        id={`${id}-description-error`}
                        className="text-destructive text-xs"
                    >
                        {descriptionError}
                    </p>
                ) : null}
            </div>
            <fieldset
                className="space-y-2"
                aria-describedby={describe(
                    `${id}-links-help`,
                    linksError && `${id}-links-error`
                )}
            >
                <legend className="text-sm leading-none font-medium">
                    {r.dialog.links}
                </legend>
                <p
                    id={`${id}-links-help`}
                    className="text-muted-foreground pt-1 text-xs"
                >
                    {r.dialog.linksHelp}
                </p>
                {links.map((link, index) => {
                    const label = fillTeamTemplate(r.dialog.link, {
                        index: String(index + 1),
                    })
                    return (
                        <div key={index} className="flex items-center gap-2">
                            <Input
                                type="url"
                                inputMode="url"
                                value={link}
                                maxLength={300}
                                placeholder="https://"
                                autoComplete="off"
                                aria-label={label}
                                disabled={pending}
                                aria-invalid={
                                    invalidLinks.includes(index)
                                        ? true
                                        : undefined
                                }
                                onChange={(event) => {
                                    setLinks((rows) =>
                                        setTeamLinkRow(
                                            rows,
                                            index,
                                            event.target.value
                                        )
                                    )
                                    setInvalidLinks([])
                                    clear("links")
                                }}
                            />
                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                disabled={pending}
                                aria-label={fillTeamTemplate(
                                    r.dialog.removeLink,
                                    { index: String(index + 1) }
                                )}
                                onClick={() => {
                                    setLinks((rows) =>
                                        removeTeamLinkRow(rows, index)
                                    )
                                    setInvalidLinks([])
                                    clear("links")
                                }}
                            >
                                <X className="size-4" aria-hidden />
                            </Button>
                        </div>
                    )
                })}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending || links.length >= TEAM_LINKS_MAX}
                    onClick={() => setLinks((rows) => addTeamLinkRow(rows))}
                >
                    <Plus className="size-4" aria-hidden />
                    {r.dialog.addLink}
                </Button>
                {linksError ? (
                    <p
                        id={`${id}-links-error`}
                        className="text-destructive text-xs"
                    >
                        {linksError}
                    </p>
                ) : null}
            </fieldset>
            <div className="space-y-2">
                <Label htmlFor={`${id}-note`}>{r.dialog.note}</Label>
                <Textarea
                    id={`${id}-note`}
                    value={note}
                    maxLength={TEAM_REQUEST_NOTE_MAX}
                    rows={2}
                    disabled={pending}
                    aria-invalid={noteError ? true : undefined}
                    aria-describedby={describe(
                        `${id}-note-help`,
                        noteError && `${id}-note-error`
                    )}
                    onChange={(event) => {
                        setNote(event.target.value)
                        clear("note")
                    }}
                />
                <p
                    id={`${id}-note-help`}
                    className="text-muted-foreground text-xs"
                >
                    {r.dialog.noteHelp}
                </p>
                {noteError ? (
                    <p
                        id={`${id}-note-error`}
                        className="text-destructive text-xs"
                    >
                        {noteError}
                    </p>
                ) : null}
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
                    {r.dialog.cancel}
                </Button>
                <Button type="submit" disabled={busy}>
                    {pending ? r.dialog.submitting : r.dialog.submit}
                </Button>
            </DialogFooter>
        </form>
    )
}
