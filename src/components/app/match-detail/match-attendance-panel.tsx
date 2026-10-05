"use client"

import { ClipboardList, Headphones, Loader2, Save } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

import {
    buildMatchAttendance,
    setRosterPresence,
    type AttendanceMark,
    type MatchAttendanceEntry,
} from "@/domain/rosters/match-attendance"
import {
    resolveRosterScoreCategory,
    type RosterScoreChangeSummary,
    type RosterScoreSettings,
} from "@/domain/events/score-policy"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { ConcludeEventButton } from "@/components/app/conclude-event-button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import type { AppUser, EventRecord, Roster } from "@/types/domain"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Filter = "roster" | "declined" | "noResponse"

const MARKS: AttendanceMark[] = ["present", "excused", "absent"]

function formatDelta(delta: number) {
    return delta > 0 ? `+${delta}` : delta < 0 ? `−${Math.abs(delta)}` : "0"
}

/**
 * Sign-ups and attendance of a match (design E3): counts, per-player
 * attendance with the points it gives, loading presence from the meeting
 * voice channel and closing the match with a summary of the points.
 * Attendance is stored on the roster, so it is saved through the roster.
 */
export function MatchAttendancePanel({
    serverId,
    event,
    roster,
    users,
    memberIds,
    scoreSettings,
    closeSummary,
    canAdmin,
    meetingChannelConfigured,
    signupHistoryHref,
    createRosterHref,
    dictionary,
}: {
    serverId: string
    event: EventRecord
    roster: Roster | null
    users: AppUser[]
    memberIds: string[]
    scoreSettings: RosterScoreSettings
    closeSummary: RosterScoreChangeSummary
    canAdmin: boolean
    meetingChannelConfigured: boolean
    signupHistoryHref: string
    createRosterHref?: string
    dictionary: Dictionary
}) {
    const t = dictionary.matchDetail.attendance
    const router = useRouter()
    const [overrides, setOverrides] = useState<Map<string, boolean>>(
        () => new Map()
    )
    const [filter, setFilter] = useState<Filter>("roster")
    const [isSaving, startSaving] = useTransition()
    const [isLoadingVoice, setIsLoadingVoice] = useState(false)
    const concluded = event.status === "concluded"
    const editable = canAdmin && !concluded && Boolean(roster)

    const usersById = useMemo(
        () => new Map(users.map((user) => [user.discordId, user])),
        [users]
    )
    const savedAttendance = useMemo(
        () =>
            buildMatchAttendance({
                roster,
                participants: event.participants,
                notices: event.absenceNotices,
                memberIds,
            }),
        [event.absenceNotices, event.participants, memberIds, roster]
    )
    const savedPresence = useMemo(
        () =>
            new Map(
                savedAttendance.entries.map((entry) => [
                    entry.userId,
                    entry.mark === "present",
                ])
            ),
        [savedAttendance]
    )
    // Only real differences from the saved roster count as changes.
    const changes = useMemo(
        () =>
            new Map(
                [...overrides].filter(
                    ([userId, present]) =>
                        savedPresence.has(userId) &&
                        savedPresence.get(userId) !== present
                )
            ),
        [overrides, savedPresence]
    )
    const board = useMemo(() => {
        if (!roster) return null
        let next = roster
        for (const [userId, present] of changes) {
            next = setRosterPresence(next, userId, present)
        }
        return next
    }, [changes, roster])
    const attendance = useMemo(
        () =>
            changes.size === 0
                ? savedAttendance
                : buildMatchAttendance({
                      roster: board,
                      participants: event.participants,
                      notices: event.absenceNotices,
                      memberIds,
                  }),
        [
            board,
            changes.size,
            event.absenceNotices,
            event.participants,
            memberIds,
            savedAttendance,
        ]
    )

    function pointsFor(userId: string) {
        return scoreSettings[
            resolveRosterScoreCategory({
                userId,
                participants: event.participants,
                notices: event.absenceNotices,
                roster: board,
            })
        ]
    }

    function nameOf(userId: string) {
        return usersById.get(userId)?.name ?? dictionary.common.unknown
    }

    function setMark(entry: MatchAttendanceEntry, mark: AttendanceMark) {
        setOverrides((current) => {
            const next = new Map(current)
            next.set(entry.userId, mark === "present")
            return next
        })
    }

    function save() {
        if (!board || changes.size === 0) return
        startSaving(async () => {
            const response = await fetch(`/api/servers/${serverId}/rosters`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                    rosterId: board.id,
                    eventId: event.id,
                    squadPresetId: board.squadPresetId || undefined,
                    squads: board.squads,
                    reservePlayerIds: board.reservePlayerIds,
                    reserveAttendances: board.reserveAttendances ?? [],
                    notAttendingPlayerIds: board.notAttendingPlayerIds,
                    streamerId: board.streamerId,
                    published: board.published,
                }),
            }).catch(() => null)
            const body = (await response?.json().catch(() => null)) as {
                error?: string
            } | null
            if (!response?.ok) {
                toast.error(body?.error ?? dictionary.common.error)
                return
            }
            setOverrides(new Map())
            toast.success(t.saved)
            router.refresh()
        })
    }

    async function loadFromVoice() {
        if (!roster) return
        setIsLoadingVoice(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/rosters/${roster.id}/confirm-meeting-attendance`,
                { method: "POST" }
            )
            const body = (await response.json().catch(() => null)) as {
                error?: string
                updatedCount?: number
            } | null
            if (!response.ok) {
                toast.error(body?.error ?? dictionary.common.error)
                return
            }
            toast.success(
                t.loadedFromVoice.replace(
                    "{count}",
                    String(body?.updatedCount ?? 0)
                )
            )
            router.refresh()
        } catch {
            toast.error(dictionary.common.error)
        } finally {
            setIsLoadingVoice(false)
        }
    }

    const counts = attendance.counts
    const summaryCards = [
        {
            label: t.rosterSummary.replace(
                "{count}",
                String(counts.roster.total)
            ),
            value: t.rosterCounts
                .replace("{present}", String(counts.roster.present))
                .replace("{excused}", String(counts.roster.excused))
                .replace("{absent}", String(counts.roster.absent)),
        },
        {
            label: t.reservesSummary.replace(
                "{count}",
                String(counts.reserves.total)
            ),
            value: t.reserveCounts
                .replace("{present}", String(counts.reserves.present))
                .replace(
                    "{absent}",
                    String(counts.reserves.absent + counts.reserves.excused)
                ),
        },
        {
            label: t.declinedSummary,
            value: t.playerCount.replace("{count}", String(counts.declined)),
        },
        {
            label: t.noResponseSummary,
            value: t.memberCount.replace("{count}", String(counts.noResponse)),
        },
    ]
    const filters: Array<{ id: Filter; label: string }> = [
        {
            id: "roster",
            label: t.filters.roster.replace(
                "{count}",
                String(attendance.entries.length)
            ),
        },
        {
            id: "declined",
            label: t.filters.declined.replace(
                "{count}",
                String(counts.declined)
            ),
        },
        {
            id: "noResponse",
            label: t.filters.noResponse.replace(
                "{count}",
                String(counts.noResponse)
            ),
        },
    ]

    return (
        <div className="space-y-4 pb-24 sm:pb-0">
            <section
                aria-label={t.summaryLabel}
                className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4"
            >
                {summaryCards.map((card) => (
                    <div
                        key={card.label}
                        className="border-border/60 bg-card rounded-xl border px-4 py-3"
                    >
                        <div className="text-muted-foreground text-xs">
                            {card.label}
                        </div>
                        <div className="mt-1 text-sm font-medium">
                            {card.value}
                        </div>
                    </div>
                ))}
            </section>

            {concluded ? (
                <p
                    role="status"
                    className="border-border/60 bg-muted/40 rounded-xl border px-4 py-3 text-sm"
                >
                    {event.scoreResolution === "skipped"
                        ? t.closedSkipped
                        : event.scoreResolution === "applied"
                          ? t.closedApplied
                          : t.closedPending}
                </p>
            ) : canAdmin ? (
                <div className="space-y-2">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex flex-wrap items-center gap-2">
                            {roster ? (
                                <Button
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={loadFromVoice}
                                    disabled={
                                        !meetingChannelConfigured ||
                                        isLoadingVoice ||
                                        isSaving
                                    }
                                >
                                    {isLoadingVoice ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <Headphones className="size-4" />
                                    )}
                                    {isLoadingVoice
                                        ? t.loadingFromVoice
                                        : t.loadFromVoice}
                                </Button>
                            ) : null}
                            {roster && !meetingChannelConfigured ? (
                                <span className="text-muted-foreground text-xs">
                                    {t.voiceNotConfigured}
                                </span>
                            ) : null}
                        </div>
                        <ConcludeEventButton
                            serverId={serverId}
                            eventId={event.id}
                            disabled={changes.size > 0 || isSaving}
                            dictionary={dictionary}
                            summary={closeSummary}
                            label={t.closeMatch}
                        />
                    </div>
                    <p className="text-muted-foreground text-xs">
                        {t.help} {t.autoClose}
                        {changes.size > 0 ? ` ${t.saveFirst}` : ""}
                    </p>
                </div>
            ) : null}

            {!roster ? (
                <EmptyState
                    icon={ClipboardList}
                    title={t.noRosterTitle}
                    description={t.noRosterDescription}
                    actions={
                        createRosterHref ? (
                            <Button asChild className="rounded-xl">
                                <Link href={createRosterHref}>
                                    {dictionary.matchDetail.roster.create}
                                </Link>
                            </Button>
                        ) : undefined
                    }
                />
            ) : null}

            <div
                role="group"
                aria-label={t.filterLabel}
                className="flex flex-wrap gap-2"
            >
                {filters.map((item) => (
                    <Button
                        key={item.id}
                        type="button"
                        size="sm"
                        variant={filter === item.id ? "default" : "outline"}
                        aria-pressed={filter === item.id}
                        className="rounded-full"
                        onClick={() => setFilter(item.id)}
                    >
                        {item.label}
                    </Button>
                ))}
                <Button
                    asChild
                    size="sm"
                    variant="ghost"
                    className="rounded-full"
                >
                    <Link href={signupHistoryHref}>{t.signupHistory}</Link>
                </Button>
            </div>

            {filter === "roster" ? (
                <div className="border-border/60 overflow-x-auto rounded-2xl border">
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead scope="col">
                                    {t.columns.player}
                                </TableHead>
                                <TableHead scope="col">
                                    {t.columns.place}
                                </TableHead>
                                <TableHead scope="col">
                                    {t.columns.before}
                                </TableHead>
                                <TableHead scope="col">
                                    {t.columns.attendance}
                                </TableHead>
                                <TableHead scope="col" className="text-right">
                                    {t.columns.points}
                                </TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {attendance.entries.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={5}
                                        className="text-muted-foreground py-8 text-center"
                                    >
                                        {t.empty}
                                    </TableCell>
                                </TableRow>
                            ) : (
                                attendance.entries.map((entry) => (
                                    <TableRow key={entry.userId}>
                                        <TableHead
                                            scope="row"
                                            className="font-medium"
                                        >
                                            <PlayerName
                                                user={usersById.get(
                                                    entry.userId
                                                )}
                                                fallback={nameOf(entry.userId)}
                                            />
                                        </TableHead>
                                        <TableCell className="text-muted-foreground">
                                            {entry.placement.kind === "slot"
                                                ? [
                                                      entry.placement.squadName,
                                                      entry.placement.roleName,
                                                  ]
                                                      .filter(Boolean)
                                                      .join(" · ")
                                                : t.reserve}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground max-w-56 truncate">
                                            {entry.before.kind === "notice"
                                                ? t.before.notice.replace(
                                                      "{reason}",
                                                      entry.before.reason
                                                  )
                                                : t.before[entry.before.kind]}
                                        </TableCell>
                                        <TableCell>
                                            <MarkGroup
                                                entry={entry}
                                                label={t.markGroupLabel.replace(
                                                    "{name}",
                                                    nameOf(entry.userId)
                                                )}
                                                labels={t.marks}
                                                excusedHelp={t.excusedHelp}
                                                disabled={!editable || isSaving}
                                                onChange={(mark) =>
                                                    setMark(entry, mark)
                                                }
                                            />
                                        </TableCell>
                                        <TableCell className="text-right font-medium tabular-nums">
                                            {formatDelta(
                                                pointsFor(entry.userId)
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </div>
            ) : (
                <SimplePlayerList
                    userIds={
                        filter === "declined"
                            ? attendance.declinedUserIds
                            : attendance.noResponseUserIds
                    }
                    before={
                        filter === "declined"
                            ? t.before.declined
                            : t.before.noResponse
                    }
                    points={
                        filter === "declined"
                            ? scoreSettings.declined
                            : scoreSettings.noCategory
                    }
                    usersById={usersById}
                    fallbackName={dictionary.common.unknown}
                    columns={t.columns}
                    empty={t.empty}
                />
            )}

            {changes.size > 0 ? (
                <div className="bg-background/95 border-border/70 fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t px-4 py-3 sm:static sm:rounded-xl sm:border sm:px-4">
                    <span className="text-muted-foreground text-sm">
                        {t.unsavedChanges.replace(
                            "{count}",
                            String(changes.size)
                        )}
                    </span>
                    <Button
                        className="rounded-xl"
                        onClick={save}
                        disabled={isSaving}
                    >
                        {isSaving ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Save className="size-4" />
                        )}
                        {t.save}
                    </Button>
                </div>
            ) : null}
        </div>
    )
}

function PlayerName({
    user,
    fallback,
}: {
    user: AppUser | undefined
    fallback: string
}) {
    return (
        <span className="flex min-w-0 items-center gap-2">
            <Avatar className="size-6 rounded-md">
                {user?.avatar ? <AvatarImage src={user.avatar} alt="" /> : null}
                <AvatarFallback className="rounded-md text-[10px]">
                    {fallback.slice(0, 2).toUpperCase()}
                </AvatarFallback>
            </Avatar>
            <span className="truncate">{user?.name ?? fallback}</span>
        </span>
    )
}

function MarkGroup({
    entry,
    label,
    labels,
    excusedHelp,
    disabled,
    onChange,
}: {
    entry: MatchAttendanceEntry
    label: string
    labels: Record<AttendanceMark, string>
    excusedHelp: string
    disabled: boolean
    onChange: (mark: AttendanceMark) => void
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className="border-border/70 inline-flex rounded-lg border p-0.5"
        >
            {MARKS.map((mark) => {
                const checked = entry.mark === mark
                // An absence notice decides between excused and absent; only
                // the player can send one, so the other choice is unavailable.
                const unavailable =
                    (mark === "excused" && !entry.hasNotice) ||
                    (mark === "absent" && entry.hasNotice)
                return (
                    <button
                        key={mark}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        disabled={disabled || unavailable}
                        title={mark === "excused" ? excusedHelp : undefined}
                        onClick={() => onChange(mark)}
                        className={cn(
                            "rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors disabled:cursor-not-allowed",
                            checked
                                ? mark === "present"
                                    ? "bg-primary text-primary-foreground"
                                    : mark === "absent"
                                      ? "bg-destructive text-white"
                                      : "bg-secondary text-secondary-foreground"
                                : "text-muted-foreground hover:text-foreground disabled:opacity-40"
                        )}
                    >
                        {labels[mark]}
                    </button>
                )
            })}
        </div>
    )
}

function SimplePlayerList({
    userIds,
    before,
    points,
    usersById,
    fallbackName,
    columns,
    empty,
}: {
    userIds: string[]
    before: string
    points: number
    usersById: Map<string, AppUser>
    fallbackName: string
    columns: { player: string; before: string; points: string }
    empty: string
}) {
    return (
        <div className="border-border/60 overflow-x-auto rounded-2xl border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead scope="col">{columns.player}</TableHead>
                        <TableHead scope="col">{columns.before}</TableHead>
                        <TableHead scope="col" className="text-right">
                            {columns.points}
                        </TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {userIds.length === 0 ? (
                        <TableRow>
                            <TableCell
                                colSpan={3}
                                className="text-muted-foreground py-8 text-center"
                            >
                                {empty}
                            </TableCell>
                        </TableRow>
                    ) : (
                        userIds.map((userId) => (
                            <TableRow key={userId}>
                                <TableHead scope="row" className="font-medium">
                                    <PlayerName
                                        user={usersById.get(userId)}
                                        fallback={
                                            usersById.get(userId)?.name ??
                                            fallbackName
                                        }
                                    />
                                </TableHead>
                                <TableCell className="text-muted-foreground">
                                    {before}
                                </TableCell>
                                <TableCell className="text-right font-medium tabular-nums">
                                    {formatDelta(points)}
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
