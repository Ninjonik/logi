"use client"

import {
    appendUnique,
    fillTemplate,
    removeById,
    teamAdminActions,
    teamLifecycleBadge,
    upsertAdminTeam,
    workspaceName,
    type WorkspaceOption,
} from "@/lib/teams-admin/team-admin-list"
import {
    fetchAdminTeam,
    fetchAdminTeamPage,
    sendAdminTeamCommand,
    TeamAdminReadError,
    TEAM_ADMIN_ERROR_CODES,
    type TeamAdminErrorCode,
} from "@/lib/teams-admin/team-admin-client"
import {
    TEAM_GAMES,
    TEAM_PAGE_DEFAULT,
    teamGameSchema,
    type TeamGame,
    type TeamRecord,
} from "@/domain/teams/team"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { TeamCatalogueDialog } from "@/components/app/team-catalogue-dialog"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import type { TeamCatalogLabels } from "@/components/app/team-fields-editor"
import { TeamMergeDialog } from "@/components/app/team-merge-dialog"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { useEffect, useId, useRef, useState } from "react"
import { TeamLogo } from "@/components/app/team-logo"
import { Loader2, Plus, Search } from "lucide-react"
import { GAME_LABELS } from "@/domain/games/game"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

/** The global team catalogue for superadmins, one tab per supported game. */
export function TeamCatalogueAdmin({
    labels,
    workspaces,
    initialGame,
}: {
    labels: TeamCatalogLabels
    workspaces: readonly WorkspaceOption[]
    initialGame: TeamGame
}) {
    const [game, setGame] = useState<TeamGame>(initialGame)
    return (
        <Tabs
            value={game}
            onValueChange={(value) => {
                const parsed = teamGameSchema.safeParse(value)
                if (parsed.success) setGame(parsed.data)
            }}
            className="gap-4"
        >
            <TabsList aria-label={labels.gamesLabel}>
                {TEAM_GAMES.map((gameId) => (
                    <TabsTrigger key={gameId} value={gameId} className="px-4">
                        {GAME_LABELS[gameId]}
                    </TabsTrigger>
                ))}
            </TabsList>
            {TEAM_GAMES.map((gameId) => (
                <TabsContent key={gameId} value={gameId}>
                    <GameCatalogue
                        labels={labels}
                        gameId={gameId}
                        workspaces={workspaces}
                    />
                </TabsContent>
            ))}
        </Tabs>
    )
}

type Notice = { tone: "error" | "success"; text: string }
type DialogState =
    | { kind: "closed" }
    | { kind: "edit"; team: TeamRecord | null }
    | { kind: "merge"; team: TeamRecord }

const errorCodeOf = (error: unknown): TeamAdminErrorCode =>
    error instanceof TeamAdminReadError &&
    (TEAM_ADMIN_ERROR_CODES as readonly string[]).includes(error.code)
        ? (error.code as TeamAdminErrorCode)
        : "unavailable"

function GameCatalogue({
    labels,
    gameId,
    workspaces,
}: {
    labels: TeamCatalogLabels
    gameId: TeamGame
    workspaces: readonly WorkspaceOption[]
}) {
    const id = useId()
    const [search, setSearch] = useState("")
    const term = useDebouncedValue(search.trim(), 300)
    const [archived, setArchived] = useState(false)
    const [items, setItems] = useState<TeamRecord[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading"
    )
    const [listError, setListError] =
        useState<TeamAdminErrorCode>("unavailable")
    const [loadingMore, setLoadingMore] = useState(false)
    const [reload, setReload] = useState(0)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [pendingId, setPendingId] = useState<string | null>(null)
    const [dialog, setDialog] = useState<DialogState>({ kind: "closed" })
    // The last dialog target stays mounted while the dialog animates closed.
    const [dialogTeam, setDialogTeam] = useState<TeamRecord | null>(null)
    // Responses from a superseded query (search, filter or reload) are ignored.
    const generation = useRef(0)

    useEffect(() => {
        const controller = new AbortController(),
            current = ++generation.current
        async function load() {
            setStatus("loading")
            try {
                const page = await fetchAdminTeamPage(
                    {
                        gameId,
                        archived,
                        search: term,
                        limit: TEAM_PAGE_DEFAULT,
                    },
                    { signal: controller.signal }
                )
                if (current !== generation.current) return
                setItems(page.items)
                setNextCursor(page.nextCursor)
                setStatus("ready")
            } catch (error) {
                if (controller.signal.aborted || current !== generation.current)
                    return
                setListError(errorCodeOf(error))
                setStatus("error")
            }
        }
        void load()
        return () => controller.abort()
    }, [gameId, archived, term, reload])

    async function loadMore() {
        if (!nextCursor) return
        const current = generation.current
        setLoadingMore(true)
        try {
            const page = await fetchAdminTeamPage({
                gameId,
                archived,
                search: term,
                cursor: nextCursor,
                limit: TEAM_PAGE_DEFAULT,
            })
            if (current !== generation.current) return
            setItems((loaded) => appendUnique(loaded, page.items))
            setNextCursor(page.nextCursor)
        } catch (error) {
            if (current !== generation.current) return
            setNotice({
                tone: "error",
                text: labels.errors[errorCodeOf(error)],
            })
        } finally {
            setLoadingMore(false)
        }
    }

    function applyRecord(teamId: string, team: TeamRecord | null) {
        setItems((loaded) =>
            team && team.gameId === gameId
                ? upsertAdminTeam(loaded, team, archived)
                : removeById(loaded, teamId)
        )
    }

    async function refreshRow(teamId: string) {
        const latest = await fetchAdminTeam(teamId).catch(() => undefined)
        if (latest !== undefined) applyRecord(teamId, latest)
    }

    async function lifecycle(team: TeamRecord, action: "archive" | "restore") {
        setPendingId(team.id)
        setNotice(null)
        try {
            const result = await sendAdminTeamCommand({
                action,
                teamId: team.id,
                input: { expectedRevision: team.revision },
            })
            await refreshRow(team.id)
            if (result.ok)
                setNotice({
                    tone: "success",
                    text:
                        action === "archive"
                            ? labels.archivedNotice
                            : labels.restoredNotice,
                })
            else
                setNotice({
                    tone: "error",
                    // The row now shows the stored state; a retry uses its revision.
                    text:
                        result.code === "revision_conflict" ||
                        result.code === "archived" ||
                        result.code === "not_archived"
                            ? labels.staleRow
                            : labels.errors[result.code],
                })
        } finally {
            setPendingId(null)
        }
    }

    function openDialog(next: Exclude<DialogState, { kind: "closed" }>) {
        setDialogTeam(next.team)
        setNotice(null)
        setDialog(next)
    }

    const searching = term.length > 0
    const busy = pendingId !== null

    return (
        <section
            aria-label={GAME_LABELS[gameId]}
            className="border-border/60 bg-card space-y-4 rounded-2xl border p-4 sm:p-5"
        >
            <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-1 flex-wrap items-center gap-4">
                    <div className="relative w-full max-w-sm">
                        <Search
                            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                            aria-hidden
                        />
                        <Input
                            type="search"
                            value={search}
                            maxLength={64}
                            placeholder={labels.search}
                            aria-label={labels.search}
                            className="rounded-xl pl-9"
                            onChange={(event) => setSearch(event.target.value)}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <Switch
                            id={`${id}-archived`}
                            checked={archived}
                            onCheckedChange={setArchived}
                        />
                        <Label htmlFor={`${id}-archived`}>
                            {labels.showArchived}
                        </Label>
                    </div>
                </div>
                <Button
                    type="button"
                    className="rounded-xl"
                    onClick={() => openDialog({ kind: "edit", team: null })}
                >
                    <Plus className="size-4" aria-hidden />
                    {labels.add}
                </Button>
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
            {status === "loading" && items.length === 0 ? (
                <p
                    role="status"
                    className="text-muted-foreground flex items-center gap-2 text-sm"
                >
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    {labels.loading}
                </p>
            ) : status === "error" ? (
                <div className="flex flex-wrap items-center gap-3">
                    <p role="alert" className="text-destructive text-sm">
                        {labels.errors[listError]}
                    </p>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setReload((value) => value + 1)}
                    >
                        {labels.retry}
                    </Button>
                </div>
            ) : items.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    {searching ? labels.emptySearch : labels.empty}
                </p>
            ) : (
                <ul
                    className="divide-border/60 divide-y"
                    aria-busy={status === "loading"}
                >
                    {items.map((team) => (
                        <CatalogueRow
                            key={team.id}
                            labels={labels}
                            team={team}
                            linkedName={
                                team.linkedGuildId
                                    ? (workspaceName(
                                          workspaces,
                                          team.linkedGuildId
                                      ) ?? team.linkedGuildId)
                                    : null
                            }
                            busy={busy}
                            pending={pendingId === team.id}
                            onEdit={() => openDialog({ kind: "edit", team })}
                            onMerge={() => openDialog({ kind: "merge", team })}
                            onLifecycle={(action) => lifecycle(team, action)}
                        />
                    ))}
                </ul>
            )}
            {status === "ready" && nextCursor ? (
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
                    {labels.loadMore}
                </Button>
            ) : null}
            <TeamCatalogueDialog
                labels={labels}
                gameId={gameId}
                team={dialog.kind === "edit" ? dialog.team : null}
                workspaces={workspaces}
                open={dialog.kind === "edit"}
                onOpenChange={(open) => {
                    if (!open) setDialog({ kind: "closed" })
                }}
                onSaved={(team) => {
                    applyRecord(team.id, team)
                    setNotice({ tone: "success", text: labels.saved })
                }}
                onStale={applyRecord}
            />
            {dialogTeam ? (
                <TeamMergeDialog
                    key={dialogTeam.id}
                    labels={labels}
                    source={dialog.kind === "merge" ? dialog.team : dialogTeam}
                    open={dialog.kind === "merge"}
                    onOpenChange={(open) => {
                        if (!open) setDialog({ kind: "closed" })
                    }}
                    onMerged={(source, target, names) => {
                        if (source) applyRecord(source.id, source)
                        else void refreshRow(dialogTeam.id)
                        if (target) applyRecord(target.id, target)
                        setNotice({
                            tone: "success",
                            text: fillTemplate(labels.mergedNotice, names),
                        })
                    }}
                    onStale={applyRecord}
                />
            ) : null}
        </section>
    )
}

function CatalogueRow({
    labels,
    team,
    linkedName,
    busy,
    pending,
    onEdit,
    onMerge,
    onLifecycle,
}: {
    labels: TeamCatalogLabels
    team: TeamRecord
    linkedName: string | null
    busy: boolean
    pending: boolean
    onEdit(): void
    onMerge(): void
    onLifecycle(action: "archive" | "restore"): Promise<void>
}) {
    const badge = teamLifecycleBadge(team)
    const actions = teamAdminActions(team)
    const label = (template: string) =>
        fillTemplate(template, { name: team.name })
    return (
        <li className="flex flex-wrap items-center gap-3 py-3">
            <TeamLogo
                name={team.name}
                shortCode={team.shortCode}
                logoUrl={team.logoUrl}
                className="size-10"
            />
            <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate font-medium">{team.name}</span>
                    {team.shortCode ? (
                        <span className="text-muted-foreground text-xs">
                            <span className="sr-only">
                                {labels.shortCode}:{" "}
                            </span>
                            {team.shortCode}
                        </span>
                    ) : null}
                    {badge === "merged" ? (
                        <Badge variant="outline">{labels.mergedBadge}</Badge>
                    ) : badge === "archived" ? (
                        <Badge variant="secondary">
                            {labels.archivedBadge}
                        </Badge>
                    ) : null}
                    {linkedName ? (
                        <Badge variant="outline">
                            {fillTemplate(labels.linkedBadge, {
                                workspace: linkedName,
                            })}
                        </Badge>
                    ) : null}
                </div>
                {team.description ? (
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                        {team.description}
                    </p>
                ) : null}
                {team.links.length > 0 ? (
                    <ul className="flex flex-wrap gap-x-3 text-xs">
                        {team.links.map((link) => (
                            <li key={link} className="max-w-64 truncate">
                                <a
                                    href={link}
                                    target="_blank"
                                    rel="noopener noreferrer nofollow"
                                    className="text-primary hover:underline"
                                >
                                    {link.replace(/^https:\/\//, "")}
                                </a>
                            </li>
                        ))}
                    </ul>
                ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
                {actions.edit ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        aria-label={label(labels.editTeam)}
                        onClick={onEdit}
                    >
                        {labels.edit}
                    </Button>
                ) : null}
                {actions.restore ? (
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy}
                        aria-label={label(labels.restoreTeam)}
                        onClick={() => void onLifecycle("restore")}
                    >
                        {labels.restore}
                    </Button>
                ) : null}
                {actions.archive ? (
                    <ConfirmActionDialog
                        trigger={
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={busy}
                                aria-label={label(labels.archiveTeam)}
                            >
                                {labels.archive}
                            </Button>
                        }
                        title={label(labels.archiveConfirmTitle)}
                        description={labels.archiveConfirmDescription}
                        confirmLabel={labels.archive}
                        cancelLabel={labels.cancel}
                        onConfirm={() => onLifecycle("archive")}
                    >
                        <ul className="text-muted-foreground list-disc space-y-1 pl-5 text-sm">
                            <li>{label(labels.archiveConsequenceSelection)}</li>
                            <li>{labels.archiveConsequenceSnapshots}</li>
                            <li>{labels.archiveConsequenceRestore}</li>
                        </ul>
                    </ConfirmActionDialog>
                ) : null}
                {actions.merge ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        disabled={busy}
                        aria-label={label(labels.mergeTeam)}
                        onClick={onMerge}
                    >
                        {labels.merge}
                    </Button>
                ) : null}
                {pending ? (
                    <Loader2
                        className="text-muted-foreground size-4 animate-spin"
                        aria-hidden
                    />
                ) : null}
            </div>
        </li>
    )
}
