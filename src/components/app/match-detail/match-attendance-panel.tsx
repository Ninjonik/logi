"use client"

import { ClipboardList, Loader2, Radio, Save } from "lucide-react"
import { useMemo, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

import {
    applyAttendanceExcuses,
    buildMatchAttendance,
    planAttendanceChanges,
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
import {
    ReminderButton,
    type ReminderAudienceState,
} from "@/components/app/match-detail/reminder-button"
import { ConcludeEventButton } from "@/components/app/conclude-event-button"
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

function deltaClass(delta: number) {
    return delta > 0
        ? "text-emerald-700 dark:text-emerald-400"
        : delta < 0
          ? "text-red-600 dark:text-red-400"
          : undefined
}

/** Counts in a summary line are bold, as in the design. */
function BoldNumbers({ text }: { text: string }) {
    return (
        <>
            {text.split(/(\d+)/).map((part, index) =>
                /^\d+$/.test(part) ? (
                    <strong key={index} className="font-semibold">
                        {part}
                    </strong>
                ) : (
                    part
                )
            )}
        </>
    )
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
    meetingChannelName,
    reminder,
    locale,
    timeZone,
    closeAvailable,
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
    /** Name of the meeting voice channel from Discord, when known. */
    meetingChannelName?: string
    /** Members who have not answered, for the reminder in that filter. */
    reminder: ReminderAudienceState
    locale: string
    timeZone: string
    /** Closing is possible once the meeting has started. */
    closeAvailable: boolean
    signupHistoryHref: string
    createRosterHref?: string
    dictionary: Dictionary
}) {
    const t = dictionary.matchDetail.attendance
    const router = useRouter()
    const [overrides, setOverrides] = useState<Map<string, AttendanceMark>>(
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
    // Presence is saved on the roster, admin excuses on the match; only real
    // differences from the saved state count as changes.
    const plan = useMemo(
        () =>
            planAttendanceChanges({
                entries: savedAttendance.entries,
                marks: overrides,
            }),
        [overrides, savedAttendance.entries]
    )
    const changeCount = new Set([
        ...plan.presence.keys(),
        ...plan.excuses.keys(),
    ]).size
    const board = useMemo(() => {
        if (!roster) return null
        let next = roster
        for (const [userId, present] of plan.presence) {
            next = setRosterPresence(next, userId, present)
        }
        return next
    }, [plan.presence, roster])
    const notices = useMemo(
        () =>
            plan.excuses.size === 0
                ? event.absenceNotices
                : applyAttendanceExcuses({
                      notices: event.absenceNotices,
                      excuses: plan.excuses,
                      actorId: "pending",
                      now: event.updatedAt,
                  }),
        [event.absenceNotices, event.updatedAt, plan.excuses]
    )
    const attendance = useMemo(
        () =>
            changeCount === 0
                ? savedAttendance
                : buildMatchAttendance({
                      roster: board,
                      participants: event.participants,
                      notices,
                      memberIds,
                  }),
        [
            board,
            changeCount,
            event.participants,
            memberIds,
            notices,
            savedAttendance,
        ]
    )

    function pointsFor(userId: string) {
        return scoreSettings[
            resolveRosterScoreCategory({
                userId,
                participants: event.participants,
                notices,
                roster: board,
            })
        ]
    }

    function placeOf(entry: MatchAttendanceEntry) {
        return entry.placement.kind === "slot"
            ? [entry.placement.squadName, entry.placement.roleName]
                  .filter(Boolean)
                  .join(" · ")
            : t.reserve
    }

    function nameOf(userId: string) {
        return usersById.get(userId)?.name ?? dictionary.common.unknown
    }

    function setMark(entry: MatchAttendanceEntry, mark: AttendanceMark) {
        setOverrides((current) => {
            const next = new Map(current)
            next.set(entry.userId, mark)
            return next
        })
    }

    function save() {
        if (!board || changeCount === 0) return
        startSaving(async () => {
            if (plan.presence.size > 0) {
                const response = await fetch(
                    `/api/servers/${serverId}/rosters`,
                    {
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
                    }
                ).catch(() => null)
                const body = (await response?.json().catch(() => null)) as {
                    error?: string
                } | null
                if (!response?.ok) {
                    toast.error(body?.error ?? dictionary.common.error)
                    return
                }
            }
            if (plan.excuses.size > 0) {
                const response = await fetch(
                    `/api/servers/${encodeURIComponent(serverId)}/events/${encodeURIComponent(event.id)}/excuses`,
                    {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            excuses: [...plan.excuses].map(
                                ([userId, excused]) => ({ userId, excused })
                            ),
                        }),
                    }
                ).catch(() => null)
                if (!response?.ok) {
                    toast.error(dictionary.common.error)
                    router.refresh()
                    return
                }
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
    const foundInVoice = new Set(roster?.meetingAttendance?.foundUserIds ?? [])
    const lastLoaded = roster?.meetingAttendance
        ? t.lastLoaded
              .replace(
                  "{time}",
                  new Intl.DateTimeFormat(locale, {
                      timeZone,
                      hour: "2-digit",
                      minute: "2-digit",
                  }).format(new Date(roster.meetingAttendance.loadedAt))
              )
              .replace("{count}", String(roster.meetingAttendance.voiceCount))
              .replace(
                  "{channel}",
                  meetingChannelName ??
                      dictionary.matchDetail.discord.meetingChannel
              )
        : null
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
                className="border-border/70 bg-card grid grid-cols-2 overflow-hidden rounded-2xl border xl:grid-cols-4"
            >
                {summaryCards.map((card, index) => (
                    <div
                        key={card.label}
                        className={cn(
                            "border-border/70 px-4 py-3",
                            index % 2 === 0 && "border-r",
                            index < 2 && "border-b xl:border-b-0",
                            index === 1 && "xl:border-r"
                        )}
                    >
                        <div className="text-muted-foreground text-[11px] font-semibold tracking-[0.08em] uppercase">
                            {card.label}
                        </div>
                        <div className="mt-1 text-sm">
                            <BoldNumbers text={card.value} />
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
                                        <Radio className="size-4" />
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
                            ) : lastLoaded ? (
                                <span className="text-muted-foreground text-sm">
                                    {lastLoaded}
                                </span>
                            ) : null}
                        </div>
                        <ConcludeEventButton
                            serverId={serverId}
                            eventId={event.id}
                            disabled={
                                !closeAvailable || changeCount > 0 || isSaving
                            }
                            dictionary={dictionary}
                            summary={closeSummary}
                            label={t.closeMatch}
                            primary
                        />
                    </div>
                    <p className="text-muted-foreground text-sm">
                        {t.help}
                        {changeCount > 0 ? ` ${t.saveFirst}` : ""}
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
                    <button
                        key={item.id}
                        type="button"
                        aria-pressed={filter === item.id}
                        className={cn(
                            "h-8 rounded-full border px-3 text-sm transition-colors",
                            filter === item.id
                                ? "border-foreground text-foreground font-medium"
                                : "border-border text-muted-foreground hover:text-foreground"
                        )}
                        onClick={() => setFilter(item.id)}
                    >
                        {item.label}
                    </button>
                ))}
                <Link
                    href={signupHistoryHref}
                    className="border-border text-muted-foreground hover:text-foreground inline-flex h-8 items-center rounded-full border px-3 text-sm transition-colors"
                >
                    {t.signupHistory}
                </Link>
            </div>

            {filter === "roster" ? (
                <div className="border-border/70 bg-card overflow-x-auto rounded-2xl border">
                    <Table>
                        <TableHeader className="bg-muted/40">
                            <TableRow>
                                <TableHead scope="col">
                                    {t.columns.player}
                                </TableHead>
                                <TableHead
                                    scope="col"
                                    className="hidden md:table-cell"
                                >
                                    {t.columns.place}
                                </TableHead>
                                <TableHead
                                    scope="col"
                                    className="hidden lg:table-cell"
                                >
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
                                            className="max-w-28 font-normal sm:max-w-none"
                                        >
                                            <span className="text-foreground block truncate">
                                                {nameOf(entry.userId)}
                                            </span>
                                            <span className="text-muted-foreground mt-0.5 block truncate text-xs font-normal md:hidden">
                                                {placeOf(entry)}
                                            </span>
                                        </TableHead>
                                        <TableCell className="text-muted-foreground hidden md:table-cell">
                                            {placeOf(entry)}
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                "hidden max-w-64 truncate lg:table-cell",
                                                entry.before.kind ===
                                                    "acknowledged"
                                                    ? "text-emerald-700 dark:text-emerald-400"
                                                    : entry.before.kind ===
                                                        "notice"
                                                      ? "text-amber-700 dark:text-amber-400"
                                                      : "text-muted-foreground"
                                            )}
                                        >
                                            {entry.before.kind === "notice"
                                                ? t.before.notice.replace(
                                                      "{reason}",
                                                      entry.before.reason
                                                  )
                                                : t.before[entry.before.kind]}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                                                <MarkGroup
                                                    entry={entry}
                                                    label={t.markGroupLabel.replace(
                                                        "{name}",
                                                        nameOf(entry.userId)
                                                    )}
                                                    labels={t.marks}
                                                    excusedHelp={t.excusedHelp}
                                                    disabled={
                                                        !editable || isSaving
                                                    }
                                                    onChange={(mark) =>
                                                        setMark(entry, mark)
                                                    }
                                                />
                                                {entry.mark === "present" &&
                                                foundInVoice.has(
                                                    entry.userId
                                                ) ? (
                                                    <span className="text-muted-foreground hidden text-xs sm:inline">
                                                        {t.fromVoice}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </TableCell>
                                        <TableCell
                                            className={cn(
                                                "text-right font-semibold tabular-nums",
                                                deltaClass(
                                                    pointsFor(entry.userId)
                                                )
                                            )}
                                        >
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
                <div className="space-y-3">
                    {filter === "noResponse" && canAdmin && !concluded ? (
                        <div className="border-border/70 bg-card flex flex-wrap items-center justify-between gap-2 rounded-2xl border px-4 py-3">
                            <span className="text-muted-foreground text-sm">
                                {t.noResponseHint.replace(
                                    "{count}",
                                    String(reminder.count)
                                )}
                            </span>
                            <ReminderButton
                                serverId={serverId}
                                eventId={event.id}
                                audience="unanswered"
                                state={reminder}
                                dictionary={dictionary}
                            />
                        </div>
                    ) : null}
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
                </div>
            )}

            {changeCount > 0 ? (
                <div className="bg-background/95 border-border/70 fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t px-4 py-3 sm:static sm:rounded-xl sm:border sm:px-4">
                    <span className="text-muted-foreground text-sm">
                        {t.unsavedChanges.replace(
                            "{count}",
                            String(changeCount)
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
            className="bg-muted inline-flex rounded-lg p-0.5"
        >
            {MARKS.map((mark) => {
                const checked = entry.mark === mark
                // A player who sent a late notice stays excused at least;
                // an admin can excuse anyone else.
                const unavailable = mark === "absent" && entry.hasNotice
                return (
                    <button
                        key={mark}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        disabled={disabled || unavailable}
                        title={unavailable ? excusedHelp : undefined}
                        onClick={() => onChange(mark)}
                        className={cn(
                            "rounded-md px-1.5 py-1 text-[11px] whitespace-nowrap transition-colors disabled:cursor-not-allowed sm:px-2.5 sm:text-xs",
                            checked
                                ? "bg-background text-foreground font-semibold shadow-sm"
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
        <div className="border-border/70 bg-card overflow-x-auto rounded-2xl border">
            <Table>
                <TableHeader className="bg-muted/40">
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
                                <TableHead scope="row" className="font-normal">
                                    <span className="text-foreground">
                                        {usersById.get(userId)?.name ??
                                            fallbackName}
                                    </span>
                                </TableHead>
                                <TableCell className="text-muted-foreground">
                                    {before}
                                </TableCell>
                                <TableCell
                                    className={cn(
                                        "text-right font-semibold tabular-nums",
                                        deltaClass(points)
                                    )}
                                >
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
