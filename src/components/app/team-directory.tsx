"use client"

import {
    fetchTeamPage,
    fetchTeamRecord,
    sendTeamCommand,
    TeamRequestError,
    type TeamErrorCode,
} from "@/lib/teams/team-client"
import {
    appendTeamPage,
    removeTeamRecord,
    teamActionLabel,
    upsertTeamRecord,
} from "@/lib/teams/team-list"
import {
    TEAM_PAGE_DEFAULT,
    type TeamGame,
    type TeamRecord,
} from "@/domain/teams/team"
import { TeamFormDialog } from "@/components/app/team-form-dialog"
import { useDebouncedValue } from "@/hooks/use-debounced-value"
import { ConfigNotice } from "@/components/app/config-notice"
import { useEffect, useId, useRef, useState } from "react"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { Loader2, Plus, Search } from "lucide-react"
import { GAME_LABELS } from "@/domain/games/game"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"

export type TeamDirectorySection = { gameId: TeamGame; canAdd: boolean }

/** Per-game team directories; the all-games view renders one section per supported game. */
export function TeamDirectory({
    serverId,
    dictionary,
    sections,
    settingsHref,
}: {
    serverId: string
    dictionary: Dictionary
    sections: readonly TeamDirectorySection[]
    settingsHref: string
}) {
    return (
        <div className="space-y-8">
            {sections.map((section) => (
                <GameTeams
                    key={section.gameId}
                    serverId={serverId}
                    dictionary={dictionary}
                    gameId={section.gameId}
                    canAdd={section.canAdd}
                    settingsHref={settingsHref}
                    showHeading={sections.length > 1}
                />
            ))}
        </div>
    )
}

type Notice = { tone: "error" | "success"; text: string }
type DialogState = { open: boolean; team: TeamRecord | null }

function GameTeams({
    serverId,
    dictionary,
    gameId,
    canAdd,
    settingsHref,
    showHeading,
}: {
    serverId: string
    dictionary: Dictionary
    gameId: TeamGame
    canAdd: boolean
    settingsHref: string
    showHeading: boolean
}) {
    const t = dictionary.teams,
        id = useId()
    const [search, setSearch] = useState("")
    const term = useDebouncedValue(search.trim(), 300)
    const [archived, setArchived] = useState(false)
    const [items, setItems] = useState<TeamRecord[]>([])
    const [nextCursor, setNextCursor] = useState<string | null>(null)
    const [status, setStatus] = useState<"loading" | "ready" | "error">(
        "loading"
    )
    const [listError, setListError] = useState<TeamErrorCode>("unavailable")
    const [loadingMore, setLoadingMore] = useState(false)
    const [reload, setReload] = useState(0)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [pendingId, setPendingId] = useState<string | null>(null)
    const [dialog, setDialog] = useState<DialogState>({
        open: false,
        team: null,
    })
    // Responses from a superseded query (search, filter or reload) are ignored.
    const generation = useRef(0)

    useEffect(() => {
        const controller = new AbortController(),
            current = ++generation.current
        async function load() {
            setStatus("loading")
            try {
                const page = await fetchTeamPage(
                    serverId,
                    {
                        gameId,
                        archived,
                        search: term,
                        limit: TEAM_PAGE_DEFAULT,
                    },
                    controller.signal
                )
                if (current !== generation.current) return
                setItems(page.items)
                setNextCursor(page.nextCursor)
                setStatus("ready")
            } catch (error) {
                if (controller.signal.aborted || current !== generation.current)
                    return
                setListError(
                    error instanceof TeamRequestError
                        ? error.code
                        : "unavailable"
                )
                setStatus("error")
            }
        }
        void load()
        return () => controller.abort()
    }, [serverId, gameId, archived, term, reload])

    async function loadMore() {
        if (!nextCursor) return
        const current = generation.current
        setLoadingMore(true)
        try {
            const page = await fetchTeamPage(serverId, {
                gameId,
                archived,
                search: term,
                cursor: nextCursor,
                limit: TEAM_PAGE_DEFAULT,
            })
            if (current !== generation.current) return
            setItems((loaded) => appendTeamPage(loaded, page.items))
            setNextCursor(page.nextCursor)
        } catch (error) {
            if (current !== generation.current) return
            setNotice({
                tone: "error",
                text: t.errors[
                    error instanceof TeamRequestError
                        ? error.code
                        : "unavailable"
                ],
            })
        } finally {
            setLoadingMore(false)
        }
    }

    function applyRecord(teamId: string, team: TeamRecord | null) {
        setItems((loaded) =>
            team
                ? upsertTeamRecord(loaded, team, archived)
                : removeTeamRecord(loaded, teamId)
        )
    }

    async function refreshRow(teamId: string) {
        const latest = await fetchTeamRecord(serverId, teamId).catch(
            () => undefined
        )
        if (latest !== undefined) applyRecord(teamId, latest)
    }

    async function lifecycle(team: TeamRecord, action: "archive" | "restore") {
        setPendingId(team.id)
        setNotice(null)
        try {
            const result = await sendTeamCommand(serverId, {
                action,
                teamId: team.id,
                input: { expectedRevision: team.revision },
            })
            await refreshRow(team.id)
            setNotice(
                result.ok
                    ? {
                          tone: "success",
                          text:
                              action === "archive"
                                  ? t.archivedNotice
                                  : t.restoredNotice,
                      }
                    : { tone: "error", text: t.errors[result.code] }
            )
        } finally {
            setPendingId(null)
        }
    }

    const headingId = `${id}-heading`
    const searching = term.length > 0

    return (
        <section
            aria-labelledby={showHeading ? headingId : undefined}
            aria-label={showHeading ? undefined : GAME_LABELS[gameId]}
            className="border-border/60 bg-card space-y-4 rounded-2xl border p-4 sm:p-5"
        >
            <div className="flex flex-wrap items-center justify-between gap-3">
                {showHeading ? (
                    <h2 id={headingId} className="text-lg font-semibold">
                        {GAME_LABELS[gameId]}
                    </h2>
                ) : (
                    <span />
                )}
                {canAdd ? (
                    <Button
                        type="button"
                        className="rounded-xl"
                        onClick={() => setDialog({ open: true, team: null })}
                    >
                        <Plus className="size-4" aria-hidden />
                        {t.add}
                    </Button>
                ) : null}
            </div>
            {canAdd ? null : (
                <ConfigNotice
                    tone="info"
                    title={GAME_LABELS[gameId]}
                    href={settingsHref}
                    ctaLabel={dictionary.event.notices.openClanSettings}
                >
                    {t.gameDisabled}
                </ConfigNotice>
            )}
            <div className="flex flex-wrap items-center gap-4">
                <div className="relative w-full max-w-sm">
                    <Search
                        className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
                        aria-hidden
                    />
                    <Input
                        type="search"
                        value={search}
                        maxLength={64}
                        placeholder={t.search}
                        aria-label={t.search}
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
                    <Label htmlFor={`${id}-archived`}>{t.showArchived}</Label>
                </div>
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
                    {t.loading}
                </p>
            ) : status === "error" ? (
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
                <p className="text-muted-foreground text-sm">
                    {searching ? t.emptySearch : t.empty}
                </p>
            ) : (
                <ul
                    className="divide-border/60 divide-y"
                    aria-busy={status === "loading"}
                >
                    {items.map((team) => (
                        <li
                            key={team.id}
                            className="flex flex-wrap items-center gap-3 py-3"
                        >
                            <TeamLogo
                                name={team.name}
                                shortCode={team.shortCode}
                                logoUrl={team.logoUrl}
                                className="size-10"
                            />
                            <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                    <span className="truncate font-medium">
                                        {team.name}
                                    </span>
                                    {team.archivedAt ? (
                                        <Badge variant="secondary">
                                            {t.archivedBadge}
                                        </Badge>
                                    ) : null}
                                </div>
                                {team.shortCode ? (
                                    <div className="text-muted-foreground text-xs">
                                        <span className="sr-only">
                                            {t.shortCode}:{" "}
                                        </span>
                                        {team.shortCode}
                                    </div>
                                ) : null}
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {team.archivedAt ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        disabled={pendingId !== null}
                                        aria-label={teamActionLabel(
                                            t.restoreTeam,
                                            team.name
                                        )}
                                        onClick={() =>
                                            void lifecycle(team, "restore")
                                        }
                                    >
                                        {t.restore}
                                    </Button>
                                ) : (
                                    <>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            disabled={pendingId !== null}
                                            aria-label={teamActionLabel(
                                                t.editTeam,
                                                team.name
                                            )}
                                            onClick={() =>
                                                setDialog({ open: true, team })
                                            }
                                        >
                                            {t.edit}
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            disabled={pendingId !== null}
                                            aria-label={teamActionLabel(
                                                t.archiveTeam,
                                                team.name
                                            )}
                                            onClick={() =>
                                                void lifecycle(team, "archive")
                                            }
                                        >
                                            {t.archive}
                                        </Button>
                                    </>
                                )}
                                {pendingId === team.id ? (
                                    <Loader2
                                        className="text-muted-foreground size-4 animate-spin self-center"
                                        aria-hidden
                                    />
                                ) : null}
                            </div>
                        </li>
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
                    {t.loadMore}
                </Button>
            ) : null}
            <TeamFormDialog
                serverId={serverId}
                gameId={gameId}
                dictionary={dictionary}
                open={dialog.open}
                team={dialog.team}
                onOpenChange={(open) =>
                    setDialog((state) => ({ ...state, open }))
                }
                onSaved={(team, outcome = "saved") => {
                    applyRecord(team.id, team)
                    // Choosing an existing active team changes nothing to report.
                    setNotice(
                        outcome === "selected"
                            ? null
                            : {
                                  tone: "success",
                                  text:
                                      outcome === "restored"
                                          ? t.restoredNotice
                                          : t.saved,
                              }
                    )
                }}
                onStale={applyRecord}
            />
        </section>
    )
}
