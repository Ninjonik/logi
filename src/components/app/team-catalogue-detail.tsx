"use client"

import {
    catalogueFormCommand,
    editorValuesFromTeam,
    rebaseCatalogueForm,
    type TeamEditorField,
    type TeamEditorValues,
} from "@/lib/teams-admin/team-editor"
import {
    fetchAdminTeam,
    sendAdminTeamCommand,
    uploadPlatformTeamLogo,
    type TeamAdminErrorCode,
} from "@/lib/teams-admin/team-admin-client"
import {
    fillTemplate,
    formatAdminDay,
    teamAdminActions,
    type WorkspaceOption,
} from "@/lib/teams-admin/team-admin-list"
import {
    TEAM_DESCRIPTION_MAX,
    TEAM_NAME_MAX,
    TEAM_SHORT_CODE_MAX,
    type TeamRecord,
} from "@/domain/teams/team"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { teamCatalogueState, type TeamUsage } from "@/domain/teams/team-usage"
import { Archive, ChevronDown, GitMerge, Inbox, Loader2 } from "lucide-react"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import type { TeamCatalogLabels } from "@/components/app/team-fields-editor"
import { adminAccent, adminTone } from "@/components/app/admin-page-header"
import { formatImageUploadMessage } from "@/lib/image-asset-upload"
import { IMAGE_INPUT_TYPES } from "@/domain/assets/image-asset"
import { useId, useRef, useState, type FormEvent } from "react"
import { TeamLogo } from "@/components/app/team-logo"
import { Textarea } from "@/components/ui/textarea"
import { GAME_LABELS } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { pluralize } from "@/i18n/plural"
import { cn } from "@/lib/utils"
import Link from "next/link"

/** Errors after which the stored record is re-read so the next attempt uses its revision. */
const STALE: ReadonlySet<TeamAdminErrorCode> = new Set([
    "revision_conflict",
    "archived",
    "not_found",
])
const NO_WORKSPACE = "__none"
const ACCEPT = IMAGE_INPUT_TYPES.join(",")

export type TeamUsageState =
    | { status: "loading" }
    | { status: "ready"; usage: TeamUsage | null }
    | { status: "error" }

/**
 * The chosen catalogue team beside the list (design I1): logo, name, short
 * code and clan edited in place, where the team is used, and merge or
 * archive behind a confirmation. Writes carry the revision the form was
 * synchronized with; a conflict re-reads the team and keeps the edits.
 */
export function TeamCatalogueDetail({
    labels,
    locale,
    team,
    usage,
    workspaces,
    requestHref,
    lifecycleBusy,
    mergedIntoName,
    onSaved,
    onStale,
    onMerge,
    onLifecycle,
}: {
    labels: TeamCatalogLabels
    locale: string
    team: TeamRecord
    usage: TeamUsageState
    workspaces: readonly WorkspaceOption[]
    /** Link to the moderation queue for a request id. */
    requestHref(requestId: string): string
    lifecycleBusy: boolean
    /** Name of the team a merged entry points to, once known. */
    mergedIntoName: string | null
    onSaved(team: TeamRecord): void
    onStale(teamId: string, team: TeamRecord | null): void
    onMerge(): void
    onLifecycle(action: "archive" | "restore"): Promise<void>
}) {
    const id = useId()
    const fileInput = useRef<HTMLInputElement>(null)
    // The record the inputs were last synchronized with.
    const [base, setBase] = useState<TeamRecord>(team)
    const [values, setValues] = useState(() => editorValuesFromTeam(team))
    const [linkedGuildId, setLinkedGuildId] = useState(team.linkedGuildId ?? "")
    const [invalidField, setInvalidField] = useState<
        TeamEditorField | "linkedGuildId" | null
    >(null)
    const [pending, setPending] = useState(false)
    const [uploading, setUploading] = useState(false)
    const [failure, setFailure] = useState<string | null>(null)
    const [moreOpen, setMoreOpen] = useState(
        () => Boolean(team.description) || team.links.length > 0
    )

    // A newer stored record arrived (a lifecycle change or a reload): fields
    // the administrator has not touched follow it, edits are kept.
    if (team.id === base.id && team.revision > base.revision) {
        const next = rebaseCatalogueForm({ values, linkedGuildId }, base, team)
        setBase(team)
        setValues(next.values)
        setLinkedGuildId(next.linkedGuildId)
    }

    const state = teamCatalogueState(base)
    const actions = teamAdminActions(base)
    const editable = actions.edit
    const built = catalogueFormCommand({
        base,
        values,
        linkedGuildId,
        gameId: base.gameId,
        idempotencyKey: "unused-for-updates",
    })
    const dirty = built.kind !== "unchanged"
    const busy = pending || uploading || lifecycleBusy
    const update = (change: (current: TeamEditorValues) => TeamEditorValues) =>
        setValues(change)
    const linkedKnown =
        !linkedGuildId ||
        workspaces.some((workspace) => workspace.id === linkedGuildId)
    const name = (template: string) =>
        fillTemplate(template, { name: base.name })

    async function reloadAfter(code: TeamAdminErrorCode) {
        let latest: TeamRecord | null
        try {
            latest = await fetchAdminTeam(base.id)
        } catch {
            setFailure(
                code === "revision_conflict"
                    ? labels.conflictReloadFailed
                    : labels.errors[code]
            )
            return
        }
        onStale(base.id, latest)
        if (!latest) {
            setFailure(labels.errors.not_found)
            return
        }
        const next = rebaseCatalogueForm(
            { values, linkedGuildId },
            base,
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
        if (built.kind === "invalid") {
            setInvalidField(built.field)
            setFailure(null)
            if (built.field === "description" || built.field === "links")
                setMoreOpen(true)
            return
        }
        setInvalidField(null)
        if (built.kind === "unchanged") return
        setPending(true)
        setFailure(null)
        try {
            const result = await sendAdminTeamCommand(built.command)
            if (!result.ok) {
                if (STALE.has(result.code)) await reloadAfter(result.code)
                else setFailure(labels.errors[result.code])
                return
            }
            const saved = await fetchAdminTeam(base.id).catch(() => null)
            if (!saved) {
                setFailure(labels.errors.unavailable)
                return
            }
            setBase(saved)
            setValues(editorValuesFromTeam(saved))
            setLinkedGuildId(saved.linkedGuildId ?? "")
            onSaved(saved)
        } finally {
            setPending(false)
        }
    }

    async function upload(file: File) {
        setFailure(null)
        setUploading(true)
        try {
            const result = await uploadPlatformTeamLogo(file)
            if (result.ok) {
                const logo = { assetId: result.asset.id, url: result.asset.url }
                update((current) => ({ ...current, logo }))
            } else
                setFailure(
                    formatImageUploadMessage(
                        labels.uploadErrors[result.error],
                        result.retryAfterMs
                    )
                )
        } finally {
            setUploading(false)
            if (fileInput.current) fileInput.current.value = ""
        }
    }

    const fieldError = (field: TeamEditorField | "linkedGuildId") =>
        invalidField === field ? (
            <p id={`${id}-${field}-error`} className="text-destructive text-xs">
                {labels.fieldErrors[field]}
            </p>
        ) : null
    const describedBy = (field: TeamEditorField | "linkedGuildId") =>
        invalidField === field ? `${id}-${field}-error` : undefined
    const pendingRequestId =
        usage.status === "ready"
            ? (usage.usage?.pendingRequestId ?? null)
            : null

    return (
        <section
            aria-labelledby={`${id}-title`}
            className="bg-card flex min-w-0 flex-col gap-4 rounded-2xl border p-5 shadow-xs sm:px-6"
        >
            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
                <div className="flex items-center gap-3.5">
                    <TeamLogo
                        name={values.name.trim() || base.name}
                        shortCode={values.shortCode.trim() || null}
                        logoUrl={values.logo.url}
                        className="size-14 rounded-xl text-sm"
                    />
                    <div className="flex min-w-0 flex-1 flex-col">
                        <h2
                            id={`${id}-title`}
                            className="truncate text-lg leading-6 font-semibold"
                        >
                            {base.name}
                        </h2>
                        <span
                            className="text-muted-foreground text-[13px]"
                            suppressHydrationWarning
                        >
                            {fillTemplate(labels.updatedOn, {
                                game: GAME_LABELS[base.gameId],
                                date: formatAdminDay(base.updatedAt, locale),
                            })}
                        </span>
                    </div>
                    {editable ? (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                            <input
                                ref={fileInput}
                                type="file"
                                accept={ACCEPT}
                                className="sr-only"
                                tabIndex={-1}
                                aria-hidden
                                disabled={busy}
                                onChange={(event) => {
                                    const file = event.target.files?.[0]
                                    if (file) void upload(file)
                                }}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                aria-describedby={`${id}-logo-help`}
                                onClick={() => fileInput.current?.click()}
                            >
                                {uploading ? (
                                    <Loader2
                                        className="size-4 animate-spin"
                                        aria-hidden
                                    />
                                ) : null}
                                {uploading
                                    ? labels.uploading
                                    : labels.changeLogo}
                            </Button>
                            {values.logo.assetId ? (
                                <button
                                    type="button"
                                    disabled={busy}
                                    className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
                                    onClick={() =>
                                        update((current) => ({
                                            ...current,
                                            logo: { assetId: null, url: null },
                                        }))
                                    }
                                >
                                    {labels.removeLogo}
                                </button>
                            ) : null}
                            <span id={`${id}-logo-help`} className="sr-only">
                                {labels.logoHelp}
                            </span>
                        </div>
                    ) : null}
                </div>

                {pendingRequestId ? (
                    <Link
                        href={requestHref(pendingRequestId)}
                        className={cn(
                            "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-[13px] transition-colors hover:opacity-90",
                            adminAccent.surface,
                            adminAccent.text
                        )}
                    >
                        <Inbox className="size-4 shrink-0" aria-hidden />
                        <span className="flex-1">{labels.requestBanner}</span>
                        <span className="font-semibold">
                            {labels.openRequest}
                        </span>
                    </Link>
                ) : null}

                {state !== "active" ? (
                    <p
                        className={cn(
                            "rounded-xl border px-3 py-2.5 text-[13px]",
                            adminTone.warning
                        )}
                    >
                        {state === "merged"
                            ? fillTemplate(labels.mergedHelp, {
                                  name:
                                      mergedIntoName ??
                                      labels.mergedTargetUnknown,
                              })
                            : labels.archivedHelp}
                    </p>
                ) : null}

                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(10rem,100%),1fr))] gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`${id}-name`}>{labels.name}</Label>
                        <Input
                            id={`${id}-name`}
                            value={values.name}
                            maxLength={TEAM_NAME_MAX}
                            required
                            autoComplete="off"
                            disabled={!editable || pending}
                            aria-invalid={invalidField === "name" || undefined}
                            aria-describedby={describedBy("name")}
                            onChange={(event) => {
                                const next = event.target.value
                                update((current) => ({
                                    ...current,
                                    name: next,
                                }))
                            }}
                        />
                        {fieldError("name")}
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label htmlFor={`${id}-code`}>{labels.shortCode}</Label>
                        <Input
                            id={`${id}-code`}
                            value={values.shortCode}
                            maxLength={TEAM_SHORT_CODE_MAX}
                            autoComplete="off"
                            disabled={!editable || pending}
                            aria-invalid={
                                invalidField === "shortCode" || undefined
                            }
                            aria-describedby={describedBy("shortCode")}
                            onChange={(event) => {
                                const next = event.target.value
                                update((current) => ({
                                    ...current,
                                    shortCode: next,
                                }))
                            }}
                        />
                        {fieldError("shortCode")}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label htmlFor={`${id}-workspace`}>
                        {labels.linkedWorkspace}
                    </Label>
                    <Select
                        value={linkedGuildId || NO_WORKSPACE}
                        onValueChange={(value) =>
                            setLinkedGuildId(
                                value === NO_WORKSPACE ? "" : value
                            )
                        }
                        disabled={!editable || pending}
                    >
                        <SelectTrigger
                            id={`${id}-workspace`}
                            className="w-full"
                            aria-invalid={
                                invalidField === "linkedGuildId" || undefined
                            }
                            aria-describedby={`${id}-workspace-help`}
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={NO_WORKSPACE}>
                                {labels.linkedWorkspaceNone}
                            </SelectItem>
                            {linkedKnown ? null : (
                                <SelectItem value={linkedGuildId}>
                                    {fillTemplate(
                                        labels.linkedWorkspaceUnknown,
                                        { id: linkedGuildId }
                                    )}
                                </SelectItem>
                            )}
                            {workspaces.map((workspace) => (
                                <SelectItem
                                    key={workspace.id}
                                    value={workspace.id}
                                >
                                    {workspace.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p
                        id={`${id}-workspace-help`}
                        className={
                            invalidField === "linkedGuildId"
                                ? "text-destructive text-xs"
                                : "sr-only"
                        }
                    >
                        {invalidField === "linkedGuildId"
                            ? labels.fieldErrors.linkedGuildId
                            : labels.linkedWorkspaceHelp}
                    </p>
                </div>

                <Collapsible open={moreOpen} onOpenChange={setMoreOpen}>
                    <CollapsibleTrigger asChild>
                        <button
                            type="button"
                            className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-[13px] font-medium"
                        >
                            <ChevronDown
                                className={cn(
                                    "size-4 transition-transform",
                                    moreOpen ? "rotate-0" : "-rotate-90"
                                )}
                                aria-hidden
                            />
                            {labels.moreDetails}
                        </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="flex flex-col gap-3 pt-3">
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor={`${id}-description`}>
                                {labels.descriptionField}
                            </Label>
                            <Textarea
                                id={`${id}-description`}
                                value={values.description}
                                maxLength={TEAM_DESCRIPTION_MAX}
                                rows={3}
                                disabled={!editable || pending}
                                aria-invalid={
                                    invalidField === "description" || undefined
                                }
                                aria-describedby={describedBy("description")}
                                onChange={(event) => {
                                    const next = event.target.value
                                    update((current) => ({
                                        ...current,
                                        description: next,
                                    }))
                                }}
                            />
                            {fieldError("description")}
                        </div>
                        <fieldset className="flex flex-col gap-1.5">
                            <legend className="mb-1.5 text-sm font-medium">
                                {labels.links}
                            </legend>
                            {values.links.map((link, index) => (
                                <Input
                                    key={index}
                                    type="url"
                                    inputMode="url"
                                    placeholder="https://"
                                    aria-label={fillTemplate(labels.linkLabel, {
                                        number: String(index + 1),
                                    })}
                                    value={link}
                                    maxLength={300}
                                    autoComplete="off"
                                    disabled={!editable || pending}
                                    aria-invalid={
                                        invalidField === "links" || undefined
                                    }
                                    onChange={(event) => {
                                        const next = event.target.value
                                        update((current) => ({
                                            ...current,
                                            links: current.links.map(
                                                (item, position) =>
                                                    position === index
                                                        ? next
                                                        : item
                                            ),
                                        }))
                                    }}
                                />
                            ))}
                            <p className="text-muted-foreground text-xs">
                                {labels.linksHelp}
                            </p>
                            {fieldError("links")}
                        </fieldset>
                    </CollapsibleContent>
                </Collapsible>

                <TeamUsageBox labels={labels} locale={locale} usage={usage} />

                {failure ? (
                    <p role="alert" className="text-destructive text-sm">
                        {failure}
                    </p>
                ) : null}
                {editable ? (
                    <div className="flex justify-end">
                        <Button type="submit" disabled={busy || !dirty}>
                            {pending ? (
                                <Loader2
                                    className="size-4 animate-spin"
                                    aria-hidden
                                />
                            ) : null}
                            {pending ? labels.saving : labels.saveShort}
                        </Button>
                    </div>
                ) : null}
            </form>

            {actions.merge || actions.archive || actions.restore ? (
                <div className="flex flex-col gap-2.5 border-t pt-3.5">
                    <h3 className="text-foreground/80 text-[13px] font-semibold">
                        {labels.endTitle}
                    </h3>
                    <div className="flex flex-wrap gap-2">
                        {actions.merge ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                aria-label={name(labels.mergeTeam)}
                                onClick={onMerge}
                            >
                                <GitMerge className="size-3.5" aria-hidden />
                                {labels.mergeIntoOther}
                            </Button>
                        ) : null}
                        {actions.archive ? (
                            <ConfirmActionDialog
                                trigger={
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={busy}
                                        aria-label={name(labels.archiveTeam)}
                                        className="text-destructive hover:text-destructive"
                                    >
                                        <Archive
                                            className="size-3.5"
                                            aria-hidden
                                        />
                                        {labels.archive}
                                    </Button>
                                }
                                title={name(labels.archiveConfirmTitle)}
                                description={labels.archiveConfirmDescription}
                                confirmLabel={labels.archive}
                                cancelLabel={labels.cancel}
                                onConfirm={() => onLifecycle("archive")}
                            >
                                <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                                    <li>
                                        {name(
                                            labels.archiveConsequenceSelection
                                        )}
                                    </li>
                                    <li>
                                        {labels.archiveConsequenceSnapshots}
                                    </li>
                                    <li>{labels.archiveConsequenceRestore}</li>
                                </ul>
                            </ConfirmActionDialog>
                        ) : null}
                        {actions.restore ? (
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={busy}
                                aria-label={name(labels.restoreTeam)}
                                onClick={() => void onLifecycle("restore")}
                            >
                                {labels.restore}
                            </Button>
                        ) : null}
                        {lifecycleBusy ? (
                            <Loader2
                                className="text-muted-foreground size-4 animate-spin self-center"
                                aria-hidden
                            />
                        ) : null}
                    </div>
                    {actions.archive ? (
                        <p className="text-muted-foreground text-xs">
                            {labels.endHelp}
                        </p>
                    ) : null}
                </div>
            ) : null}
        </section>
    )
}

/** "Where the team is used": competitions with division and fixture counts. */
function TeamUsageBox({
    labels,
    locale,
    usage,
}: {
    labels: TeamCatalogLabels
    locale: string
    usage: TeamUsageState
}) {
    const competitions =
        usage.status === "ready" ? (usage.usage?.competitions ?? []) : []
    const more =
        usage.status === "ready" && usage.usage
            ? usage.usage.competitionCount - competitions.length
            : 0
    return (
        <div className="bg-muted/50 flex flex-col gap-1.5 rounded-xl px-3.5 py-3 text-[13px]">
            <span className="text-foreground/80 font-semibold">
                {labels.usageTitle}
            </span>
            {usage.status === "loading" ? (
                <span
                    role="status"
                    className="text-muted-foreground flex items-center gap-2"
                >
                    <Loader2 className="size-3.5 animate-spin" aria-hidden />
                    {labels.loading}
                </span>
            ) : usage.status === "error" ? (
                <span className="text-destructive">
                    {labels.usageUnavailable}
                </span>
            ) : competitions.length === 0 ? (
                <span className="text-muted-foreground">
                    {labels.usageNone}
                </span>
            ) : (
                <ul className="text-foreground/80 flex flex-col gap-1">
                    {competitions.map((competition) => (
                        <li key={competition.id}>
                            {[
                                `${competition.name} ${competition.season}`.trim(),
                                competition.division,
                                pluralize(
                                    locale,
                                    competition.fixtures,
                                    labels.usageFixtures
                                ),
                                competition.withdrawn
                                    ? labels.usageWithdrawn
                                    : null,
                            ]
                                .filter(Boolean)
                                .join(" · ")}
                        </li>
                    ))}
                    {more > 0 ? (
                        <li className="text-muted-foreground">
                            {fillTemplate(labels.usageMore, {
                                count: String(more),
                            })}
                        </li>
                    ) : null}
                </ul>
            )}
            <span className="text-muted-foreground">
                {labels.usageSnapshots}
            </span>
        </div>
    )
}
