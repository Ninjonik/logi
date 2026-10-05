"use client"

import {
    ArrowLeft,
    ArrowRight,
    Check,
    CircleCheck,
    EyeOff,
    Info,
    Send,
    X,
} from "lucide-react"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

import {
    NEW_MATCH_STEPS,
    reminderAudience,
    splitLocalDateTime,
    suggestedEventName,
    teamChipCode,
    type NewMatchStep,
} from "@/domain/events/new-match-flow"
import {
    templateSchedule,
    templatesFor,
    type MatchTemplate,
    type TemplateReminderStatus,
    type TemplateSignupStatus,
} from "@/domain/events/match-templates"
import {
    getHllModeOptions,
    getHllTimeOptions,
    inferHllSelection,
    resolveHllPresetCode,
} from "@/lib/hll-map-presets"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    fromDateTimeLocalInTimeZone,
    toDateTimeLocalInTimeZone,
} from "@/lib/timezone-datetime"
import type {
    EventCategory,
    EventRecord,
    Group,
    SquadPreset,
} from "@/types/domain"
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select"
import type { DiscordSelectOption } from "@/components/app/discord-entity-select"
import { matchTeamSides, type MatchTeamInput } from "@/domain/teams/match-teams"
import { NewMatchPreview, type NewMatchPreviewModel } from "./new-match-preview"
import { ConfirmActionDialog } from "@/components/app/confirm-action-dialog"
import { getStratmapMapById, getStratmapMaps } from "@/lib/game-stratmaps"
import { TeamRequestDialog } from "@/components/app/team-request-dialog"
import { matchTeamGame } from "@/lib/teams/match-team-selection"
import type { TeamDto, TeamRecord } from "@/domain/teams/team"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { TeamLogo } from "@/components/app/team-logo"
import type { Dictionary } from "@/i18n/dictionaries"
import { OpponentPicker } from "./opponent-picker"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const STATUSES: TemplateSignupStatus[] = [
    "member",
    "recruit",
    "reserve_member",
    "mercenary",
]
const NO_SIDE = "__none"
const NONE = "__none"
const AUTOSAVE_DELAY_MS = 2500
const HOUR_MS = 60 * 60 * 1000
const MINUTE_MS = 60 * 1000

type Opponent = {
    teamId: string
    name: string
    shortCode: string | null
    logoUrl: string | null
}

type FlowValues = {
    kind: "match" | "training"
    gameId: GameId
    templateId: string | null
    opponent: Opponent | null
    ownSide: string | null
    opponentSide: string | null
    mapId: string
    timeOfDay: string
    cap: string
    name: string
    nameTouched: boolean
    date: string
    time: string
    announcementHours: number | null
    registrationHours: number
    meetingMinutes: number
    durationMinutes: number
    repeatWeekly: boolean
    allowedSignupStatuses: TemplateSignupStatus[]
    signupGroupIds: string[]
    signupGroupLimits: Array<{ groupId: string; max: number }>
    useGeneralSignup: boolean
    signupReminderStatuses: TemplateReminderStatus[]
    announcementChannelId: string
    eventInfoChannelId: string
    pingMode: "none" | "clan" | "roles"
    pingRoleIds: string[]
    createForumChannel: boolean
    createSquadVoiceChannels: boolean
    server: string
    serverPassword: string
    matchType?: string
    topicPresetId?: string
    attendanceReminderHours?: number[]
    createParticipantRoles?: boolean
    squadPresetId?: string
    description?: string
    notes?: string
}

type Metadata = {
    roles: DiscordSelectOption[]
    channels: Array<DiscordSelectOption & { type: number; parentId?: string }>
}

export type NewMatchFlowProps = {
    serverId: string
    locale: string
    dictionary: Dictionary
    /** Preview copy in the clan's bot language. */
    previewCopy: Dictionary["newMatch"]["preview"]
    botLanguage: string
    initialKind: "match" | "training"
    initialGameId: GameId
    enabledGames: GameId[]
    templates: MatchTemplate[]
    groups: Group[]
    squadPresets: SquadPreset[]
    eventCategories: EventCategory[]
    timezone: string
    clan: { name: string }
    linkedTeams: TeamDto[]
    /** Default announcement and roster channels per game. */
    channelDefaults: Partial<
        Record<
            GameId,
            { announcementChannelId?: string; eventInfoChannelId?: string }
        >
    >
    clanRoleId?: string
    draft: EventRecord | null
}

function gameGroups(groups: Group[], gameId: GameId) {
    return groups
        .filter((group) => (group.gameId ?? "hell_let_loose") === gameId)
        .sort((left, right) => left.order - right.order)
}

function defaultStart(timezone: string) {
    const tomorrow = new Date(Date.now() + 24 * HOUR_MS)
    const { date } = splitLocalDateTime(
        toDateTimeLocalInTimeZone(tomorrow.toISOString(), timezone)
    )
    return { date, time: "20:00" }
}

function applyTemplateValues(
    values: FlowValues,
    template: MatchTemplate,
    groups: Group[],
    channelDefaults: NewMatchFlowProps["channelDefaults"]
): FlowValues {
    const offered = gameGroups(groups, values.gameId).map((group) => group.id)
    const isMatch = template.kind === "match"
    return {
        ...values,
        kind: template.kind,
        templateId: template.id,
        announcementHours: template.announcementHoursBeforeStart ?? null,
        registrationHours: template.registrationHoursBeforeMeeting,
        meetingMinutes: isMatch ? template.meetingMinutesBeforeStart : 0,
        durationMinutes: template.durationMinutes,
        allowedSignupStatuses: template.allowedSignupStatuses,
        signupGroupIds: isMatch
            ? (template.signupGroupIds ?? offered).filter((id) =>
                  offered.includes(id)
              )
            : [],
        signupGroupLimits: template.signupGroupLimits ?? [],
        useGeneralSignup: template.useGeneralSignup,
        signupReminderStatuses: template.signupReminderStatuses,
        pingMode: template.pingMode,
        pingRoleIds: template.pingRoleIds,
        createForumChannel: isMatch && template.createForumChannel,
        createSquadVoiceChannels: template.createSquadVoiceChannels,
        matchType: template.categoryId ?? values.matchType,
        topicPresetId: template.topicPresetId,
        attendanceReminderHours: template.attendanceReminderHours,
        createParticipantRoles: template.createParticipantRoles,
        squadPresetId: template.squadPresetId,
        eventInfoChannelId: isMatch
            ? values.eventInfoChannelId ||
              channelDefaults[values.gameId]?.eventInfoChannelId ||
              ""
            : "",
        // Trainings have no opponent or map.
        ...(isMatch
            ? {}
            : {
                  opponent: null,
                  opponentSide: null,
                  mapId: "",
                  timeOfDay: "",
                  cap: "",
              }),
    }
}

function initialValues(props: NewMatchFlowProps): FlowValues {
    const { draft, timezone, channelDefaults } = props
    if (draft) {
        const gameId = draft.gameId ?? "hell_let_loose"
        const start =
            draft.kind === "training" ? draft.meetingStart : draft.gameStart
        const { date, time } = splitLocalDateTime(
            toDateTimeLocalInTimeZone(start, timezone)
        )
        const meeting = Date.parse(draft.meetingStart)
        const opponent = draft.matchTeams?.find((team) => team.slot === "b")
        const own = draft.matchTeams?.find((team) => team.slot === "a")
        const selection = inferHllSelection(draft.map, gameId)
        return {
            kind: draft.kind,
            gameId,
            templateId: null,
            opponent: opponent
                ? {
                      teamId: opponent.teamId,
                      name: opponent.snapshot.name,
                      shortCode: opponent.snapshot.shortCode,
                      logoUrl: opponent.snapshot.logoUrl,
                  }
                : null,
            ownSide: own?.side ?? draft.side ?? null,
            opponentSide: opponent?.side ?? null,
            mapId: selection?.mapId ?? "",
            timeOfDay: selection?.time ?? "",
            cap: draft.cap ?? "",
            name: draft.name,
            nameTouched: Boolean(draft.name),
            date,
            time,
            announcementHours: draft.registrationStart
                ? Math.max(
                      0,
                      Math.round(
                          (Date.parse(start) -
                              Date.parse(draft.registrationStart)) /
                              HOUR_MS
                      )
                  )
                : null,
            registrationHours: Math.max(
                0,
                Math.round(
                    (meeting - Date.parse(draft.registrationEnd)) / HOUR_MS
                )
            ),
            meetingMinutes:
                draft.kind === "training"
                    ? 0
                    : Math.max(
                          0,
                          Math.round(
                              (Date.parse(draft.gameStart) - meeting) /
                                  MINUTE_MS
                          )
                      ),
            durationMinutes: Math.max(
                1,
                Math.round(
                    (Date.parse(draft.gameEnd) - Date.parse(start)) / MINUTE_MS
                ) ||
                    draft.durationMinutes ||
                    90
            ),
            repeatWeekly: draft.recurrence?.frequency === "weekly",
            allowedSignupStatuses: draft.allowedSignupStatuses ?? [],
            signupGroupIds: draft.signupGroupIds ?? [],
            signupGroupLimits: draft.signupGroupLimits ?? [],
            useGeneralSignup: draft.useGeneralSignup ?? false,
            signupReminderStatuses: draft.signupReminderStatuses ?? ["member"],
            announcementChannelId: draft.announcementChannelId ?? "",
            eventInfoChannelId: draft.eventInfoChannelId ?? "",
            pingMode: draft.pingMode ?? (draft.pingClan ? "clan" : "none"),
            pingRoleIds: draft.pingRoleIds ?? [],
            createForumChannel: draft.createForumChannel,
            createSquadVoiceChannels: draft.createSquadVoiceChannels ?? false,
            server: draft.server ?? "",
            serverPassword: draft.serverPassword ?? "",
            matchType: draft.matchType,
            topicPresetId: draft.topicPresetId,
            attendanceReminderHours: draft.attendanceReminderHours,
            createParticipantRoles: draft.createParticipantRoles,
            squadPresetId: draft.squadPresetId,
            description: draft.description,
            notes: draft.notes,
        }
    }
    const gameId = props.initialGameId
    const base: FlowValues = {
        kind: props.initialKind,
        gameId,
        templateId: null,
        opponent: null,
        ownSide: null,
        opponentSide: null,
        mapId: "",
        timeOfDay: "",
        cap: "",
        name: "",
        nameTouched: false,
        ...defaultStart(timezone),
        announcementHours: null,
        registrationHours: 24,
        meetingMinutes: props.initialKind === "match" ? 30 : 0,
        durationMinutes: 90,
        repeatWeekly: false,
        allowedSignupStatuses: [],
        signupGroupIds: gameGroups(props.groups, gameId).map(
            (group) => group.id
        ),
        signupGroupLimits: [],
        useGeneralSignup: false,
        signupReminderStatuses: ["member"],
        announcementChannelId:
            channelDefaults[gameId]?.announcementChannelId ?? "",
        eventInfoChannelId:
            props.initialKind === "match"
                ? (channelDefaults[gameId]?.eventInfoChannelId ?? "")
                : "",
        pingMode: "clan",
        pingRoleIds: [],
        createForumChannel: props.initialKind === "match",
        createSquadVoiceChannels: false,
        server: "",
        serverPassword: "",
    }
    const template = templatesFor(props.templates, props.initialKind, gameId)[0]
    return template
        ? applyTemplateValues(base, template, props.groups, channelDefaults)
        : base
}

function SegmentedControl<T extends string>({
    label,
    value,
    options,
    onChange,
    size = "md",
}: {
    label: string
    value: T
    options: Array<{ value: T; label: string }>
    onChange(value: T): void
    size?: "md" | "sm"
}) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className="bg-muted flex gap-0.5 rounded-[10px] p-[3px]"
        >
            {options.map((option) => {
                const checked = option.value === value
                return (
                    <button
                        key={option.value}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => onChange(option.value)}
                        className={cn(
                            "flex-1 rounded-lg px-2 text-sm transition-colors focus-visible:ring-2 focus-visible:outline-none",
                            size === "md" ? "h-[34px]" : "h-8 text-[13px]",
                            checked
                                ? "bg-background text-foreground font-semibold shadow-sm"
                                : "text-muted-foreground hover:text-foreground font-medium"
                        )}
                    >
                        {option.label}
                    </button>
                )
            })}
        </div>
    )
}

function FieldLabel({
    htmlFor,
    id,
    children,
}: {
    htmlFor?: string
    id?: string
    children: React.ReactNode
}) {
    return htmlFor ? (
        <Label htmlFor={htmlFor} className="text-sm font-medium">
            {children}
        </Label>
    ) : (
        <span id={id} className="text-sm leading-none font-medium">
            {children}
        </span>
    )
}

function fill(template: string, values: Record<string, string | number>) {
    return Object.entries(values).reduce(
        (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
        template
    )
}

/**
 * The new-match flow (design D2): five steps (match, time, sign-ups,
 * Discord, review) with the Discord preview beside them. Work in progress is
 * autosaved as a draft that only managers see; publishing turns the draft
 * into the match the bot announces.
 */
export function NewMatchFlow(props: NewMatchFlowProps) {
    const {
        serverId,
        locale,
        dictionary,
        timezone,
        templates,
        groups,
        linkedTeams,
        channelDefaults,
    } = props
    const t = dictionary.newMatch
    const router = useRouter()
    const [values, setValues] = useState<FlowValues>(() => initialValues(props))
    const [step, setStep] = useState<NewMatchStep>("match")
    const [draftId, setDraftId] = useState<string | null>(
        props.draft?.id ?? null
    )
    const [dirty, setDirty] = useState(false)
    const [saveState, setSaveState] = useState<
        | { kind: "idle" }
        | { kind: "saving" }
        | { kind: "saved"; at: Date }
        | { kind: "failed" }
    >({ kind: "idle" })
    const [busy, setBusy] = useState<"publish" | "draft" | null>(null)
    const [editingTimes, setEditingTimes] = useState(false)
    const [metadata, setMetadata] = useState<Metadata | null>(null)
    const [requestOpen, setRequestOpen] = useState(false)
    const [deleteOpen, setDeleteOpen] = useState(false)
    const saving = useRef<Promise<unknown> | null>(null)
    const draftIdRef = useRef(draftId)
    draftIdRef.current = draftId

    // Counts edits so a save only clears "dirty" for the values it sent.
    const edits = useRef(0)
    const markDirty = useCallback(() => {
        edits.current += 1
        setDirty(true)
    }, [])

    const update = useCallback(
        (patch: Partial<FlowValues>) => {
            setValues((current) => ({ ...current, ...patch }))
            markDirty()
        },
        [markDirty]
    )

    useEffect(() => {
        fetch(`/api/servers/${serverId}/discord-metadata`)
            .then(async (response) => {
                const body = (await response.json()) as Metadata
                if (!response.ok || !Array.isArray(body?.channels))
                    throw new Error()
                setMetadata(body)
            })
            .catch(() => setMetadata(null))
    }, [serverId])

    const isMatch = values.kind === "match"
    const teamGame = matchTeamGame(values.gameId)
    const ownTeam = teamGame
        ? (linkedTeams.find((team) => team.gameId === teamGame) ?? null)
        : null
    const sides = teamGame ? matchTeamSides(teamGame) : ["Allies", "Axis"]
    const sideLabel = (side: string | null) =>
        side ? ((t.match.sides as Record<string, string>)[side] ?? side) : null
    const template =
        templates.find((entry) => entry.id === values.templateId) ?? null
    const offeredTemplates = useMemo(
        () =>
            templates.filter(
                (entry) => !entry.gameId || entry.gameId === values.gameId
            ),
        [templates, values.gameId]
    )
    const groupsOfGame = gameGroups(groups, values.gameId)
    const ownCode = teamChipCode(
        ownTeam?.name ?? props.clan.name,
        ownTeam?.shortCode
    )
    const opponentCode = values.opponent
        ? teamChipCode(values.opponent.name, values.opponent.shortCode)
        : null
    const suggestedName = suggestedEventName({
        kind: values.kind,
        ownCode,
        opponentCode,
        templateName: template?.name ?? (isMatch ? null : t.steps.training),
    })
    const name = values.nameTouched ? values.name : suggestedName

    // Map choices.
    const maps = getStratmapMaps(values.gameId)
    const selectedMap = values.mapId
        ? getStratmapMapById(values.mapId, values.gameId)
        : undefined
    const timeOptions = values.mapId
        ? getHllTimeOptions(values.mapId, values.gameId)
        : []
    const strongpoints =
        values.gameId === "wardogs" ? [] : (selectedMap?.strongpoints ?? [])
    const timeLabel = (time: string) =>
        (t.match.timesOfDay as Record<string, string>)[time] ?? time
    const mapCode = (() => {
        if (!values.mapId) return ""
        if (!values.timeOfDay) return values.mapId
        const modes = getHllModeOptions(
            values.mapId,
            values.timeOfDay,
            values.gameId
        )
        const mode =
            modes.find((option) => option.value === "warfare")?.value ??
            modes[0]?.value
        return mode
            ? (resolveHllPresetCode({
                  mapId: values.mapId,
                  time: values.timeOfDay,
                  mode,
                  side: values.ownSide,
                  gameId: values.gameId,
              }) ?? values.mapId)
            : values.mapId
    })()

    // The timeline from the start and the template's offsets.
    const startLocal =
        values.date && values.time ? `${values.date}T${values.time}` : ""
    const startIso = startLocal
        ? fromDateTimeLocalInTimeZone(startLocal, timezone)
        : ""
    const schedule = startIso
        ? templateSchedule(
              {
                  kind: values.kind,
                  announcementHoursBeforeStart:
                      values.announcementHours ?? undefined,
                  registrationHoursBeforeMeeting: values.registrationHours,
                  meetingMinutesBeforeStart: values.meetingMinutes,
                  durationMinutes: values.durationMinutes,
              },
              startIso
          )
        : null

    const intl = locale === "cs" ? "cs-CZ" : locale === "de" ? "de-DE" : "en-GB"
    const formatAt = (iso: string, withWeekday = true) =>
        new Intl.DateTimeFormat(intl, {
            timeZone: timezone,
            weekday: withWeekday ? "short" : undefined,
            day: "numeric",
            month: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(iso))
    const formatTimeOnly = (iso: string) =>
        new Intl.DateTimeFormat(intl, {
            timeZone: timezone,
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(iso))

    const textChannels = (metadata?.channels ?? []).filter(
        (channel) => channel.type === 0 || channel.type === 5
    )
    const channelName = (id: string) =>
        textChannels.find((channel) => channel.id === id)?.name ?? null
    const roleName = (id: string | undefined) =>
        id
            ? (metadata?.roles.find((role) => role.id === id)?.name ?? null)
            : null
    const category = props.eventCategories.find(
        (entry) => entry.id === values.matchType
    )

    const offeredGroups = groupsOfGame.filter((group) =>
        values.signupGroupIds.includes(group.id)
    )
    const limitOf = (groupId: string) =>
        values.signupGroupLimits.find((limit) => limit.groupId === groupId)?.max

    // The bot lists the stored team assignments by slot; without any it shows
    // the clan's own side.
    const previewTeams = [
        ...(ownTeam ? [{ code: ownCode, side: values.ownSide }] : []),
        ...(opponentCode
            ? [{ code: opponentCode, side: values.opponentSide }]
            : []),
    ]
    const previewModel: NewMatchPreviewModel = {
        kind: values.kind,
        language: props.botLanguage,
        title: name,
        categoryLabel: category?.label ?? null,
        teams: isMatch
            ? previewTeams.length
                ? previewTeams
                : values.ownSide
                  ? [{ code: ownCode, side: values.ownSide }]
                  : []
            : [],
        map: selectedMap
            ? { name: selectedMap.name, time: values.timeOfDay || null }
            : null,
        cap: values.cap || null,
        meetingStart: schedule?.meetingStart ?? null,
        gameStart: schedule?.gameStart ?? null,
        registrationEnd: schedule?.registrationEnd ?? null,
        groups: offeredGroups.map((group) => ({
            name: group.name,
            max: limitOf(group.id),
        })),
        mentions:
            values.pingMode === "clan"
                ? [roleName(props.clanRoleId) ?? t.discord.pingClan]
                : values.pingMode === "roles"
                  ? values.pingRoleIds.map((id) => roleName(id) ?? id)
                  : [],
        forum: isMatch && values.createForumChannel,
        accentColor: category?.color,
    }

    function matchTeams(): MatchTeamInput[] | undefined {
        if (!teamGame || !isMatch) return undefined
        const teams: MatchTeamInput[] = []
        if (ownTeam)
            teams.push({ teamId: ownTeam.id, slot: "a", side: values.ownSide })
        if (values.opponent)
            teams.push({
                teamId: values.opponent.teamId,
                slot: "b",
                side: values.opponentSide,
            })
        return teams
    }

    function payload() {
        const start = schedule
        const weekday = startIso
            ? new Date(`${values.date}T00:00:00Z`).getUTCDay()
            : 0
        return {
            gameId: values.gameId,
            kind: values.kind,
            matchType: values.matchType || undefined,
            name: name.trim(),
            description: values.description || undefined,
            notes: values.notes || undefined,
            registrationStart: start?.registrationStart ?? "",
            registrationEnd: start?.registrationEnd ?? "",
            meetingStart: start?.meetingStart ?? "",
            gameStart: start?.gameStart ?? "",
            gameEnd: start?.gameEnd ?? "",
            durationMinutes: values.durationMinutes,
            pingClan: values.pingMode === "clan",
            pingMode: values.pingMode,
            pingRoleIds: values.pingMode === "roles" ? values.pingRoleIds : [],
            createForumChannel: isMatch && values.createForumChannel,
            createSquadVoiceChannels: values.createSquadVoiceChannels,
            announcementChannelId: values.announcementChannelId || undefined,
            eventInfoChannelId: isMatch
                ? values.eventInfoChannelId || undefined
                : undefined,
            server: values.server || undefined,
            serverPassword: values.serverPassword || undefined,
            side: isMatch ? (values.ownSide ?? undefined) : undefined,
            map: isMatch ? mapCode || undefined : undefined,
            cap: isMatch ? values.cap || undefined : undefined,
            topicPresetId: isMatch ? values.topicPresetId : undefined,
            signupGroupIds: isMatch ? values.signupGroupIds : [],
            allowedSignupStatuses: isMatch ? values.allowedSignupStatuses : [],
            useGeneralSignup: isMatch && values.useGeneralSignup,
            signupReminderStatuses: isMatch
                ? values.signupReminderStatuses
                : [],
            signupGroupLimits: isMatch
                ? values.signupGroupLimits.filter((limit) =>
                      values.signupGroupIds.includes(limit.groupId)
                  )
                : undefined,
            attendanceReminderHours: values.attendanceReminderHours,
            createParticipantRoles: values.createParticipantRoles,
            squadPresetId: isMatch ? values.squadPresetId : undefined,
            recurrence:
                isMatch && values.repeatWeekly
                    ? {
                          frequency: "weekly" as const,
                          interval: 1,
                          weekdays: [weekday],
                      }
                    : undefined,
            matchTeams: matchTeams(),
        }
    }

    const stepOfField = (field: string): NewMatchStep => {
        if (
            [
                "registrationStart",
                "registrationEnd",
                "meetingStart",
                "gameStart",
                "gameEnd",
                "durationMinutes",
                "recurrence",
            ].includes(field)
        )
            return "time"
        if (
            field.startsWith("signup") ||
            field === "allowedSignupStatuses" ||
            field === "useGeneralSignup"
        )
            return "signups"
        if (
            [
                "announcementChannelId",
                "eventInfoChannelId",
                "pingMode",
                "pingRoleIds",
                "pingClan",
                "createForumChannel",
                "createSquadVoiceChannels",
                "server",
                "serverPassword",
            ].includes(field)
        )
            return "discord"
        return "match"
    }

    const errorMessage = (
        body: { error?: string; fields?: string[] } | null
    ) => {
        const code = body?.error ?? "save_failed"
        if (code === "invalid_event") {
            const steps = [
                ...new Set((body?.fields ?? []).map(stepOfField)),
            ].map((entry) => t.steps[entry])
            return fill(t.errors.invalid_event, {
                fields: steps.join(", ") || t.steps.match,
            })
        }
        const teamErrors = dictionary.teams.picker.errors as Record<
            string,
            string
        >
        return (
            (t.errors as Record<string, string>)[code] ??
            teamErrors[code] ??
            t.errors.save_failed
        )
    }

    const write = useCallback(
        async (publish: boolean) => {
            const response = await fetch(
                `/api/servers/${serverId}/event-drafts`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({
                        ...(draftIdRef.current
                            ? { eventId: draftIdRef.current }
                            : {}),
                        publish,
                        event: payload(),
                    }),
                }
            )
            const body = (await response.json().catch(() => null)) as {
                ok?: boolean
                eventId?: string
                error?: string
                fields?: string[]
            } | null
            return { ok: response.ok && Boolean(body?.eventId), body }
        },
        // payload() reads the current render's values.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [serverId, values, name, schedule?.registrationEnd, mapCode]
    )

    const rememberDraft = useCallback((eventId: string) => {
        setDraftId(eventId)
        const url = new URL(window.location.href)
        if (url.searchParams.get("draftId") !== eventId) {
            url.searchParams.set("draftId", eventId)
            window.history.replaceState(window.history.state, "", url)
        }
    }, [])

    const saveDraft = useCallback(
        async (manual: boolean) => {
            if (!schedule) return
            setSaveState({ kind: "saving" })
            const sentEdits = edits.current
            const run = write(false)
            saving.current = run
            try {
                const result = await run
                if (result.ok && result.body?.eventId) {
                    rememberDraft(result.body.eventId)
                    setSaveState({ kind: "saved", at: new Date() })
                    if (edits.current === sentEdits) setDirty(false)
                    if (manual) toast.success(t.draftSaved)
                } else {
                    setSaveState({ kind: "failed" })
                    if (manual) toast.error(errorMessage(result.body))
                }
            } catch {
                setSaveState({ kind: "failed" })
                if (manual) toast.error(t.errors.save_failed)
            } finally {
                saving.current = null
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [write, schedule?.registrationEnd]
    )

    // Autosave a little after the last change.
    useEffect(() => {
        if (!dirty || busy) return
        const timer = setTimeout(() => {
            if (!saving.current) void saveDraft(false)
        }, AUTOSAVE_DELAY_MS)
        return () => clearTimeout(timer)
    }, [busy, dirty, saveDraft, values])

    async function publish() {
        setBusy("publish")
        try {
            if (saving.current) await saving.current.catch(() => undefined)
            const result = await write(true)
            if (!result.ok || !result.body?.eventId) {
                toast.error(errorMessage(result.body))
                return
            }
            setDirty(false)
            toast.success(isMatch ? t.published : t.publishedTraining)
            router.push(
                `/${locale}/dashboard/servers/${serverId}/${isMatch ? "matches" : "trainings"}/${result.body.eventId}?game=${values.gameId}`
            )
            router.refresh()
        } catch {
            toast.error(t.errors.save_failed)
        } finally {
            setBusy(null)
        }
    }

    async function saveAsDraft() {
        setBusy("draft")
        try {
            if (saving.current) await saving.current.catch(() => undefined)
            await saveDraft(true)
        } finally {
            setBusy(null)
        }
    }

    async function deleteDraft() {
        if (!draftId) return
        const response = await fetch(
            `/api/servers/${serverId}/event-drafts/${draftId}`,
            { method: "DELETE" }
        )
        const body = (await response.json().catch(() => null)) as {
            error?: string
        } | null
        if (!response.ok) {
            toast.error(errorMessage(body))
            return
        }
        setDirty(false)
        toast.success(t.draftDeleted)
        router.push(`/${locale}/dashboard/servers/${serverId}/matches`)
        router.refresh()
    }

    function changeGame(gameId: GameId) {
        const next: FlowValues = {
            ...values,
            gameId,
            opponent: null,
            ownSide: null,
            opponentSide: null,
            mapId: "",
            timeOfDay: "",
            cap: "",
            signupGroupIds: gameGroups(groups, gameId).map((group) => group.id),
            signupGroupLimits: [],
            announcementChannelId:
                channelDefaults[gameId]?.announcementChannelId ??
                values.announcementChannelId,
            eventInfoChannelId: isMatch
                ? (channelDefaults[gameId]?.eventInfoChannelId ??
                  values.eventInfoChannelId)
                : "",
        }
        const current = templates.find(
            (entry) => entry.id === values.templateId
        )
        const keep =
            current && (!current.gameId || current.gameId === gameId)
                ? current
                : templatesFor(templates, values.kind, gameId)[0]
        setValues(
            keep
                ? applyTemplateValues(next, keep, groups, channelDefaults)
                : { ...next, templateId: null }
        )
        markDirty()
    }

    function pickTemplate(entry: MatchTemplate) {
        setValues((current) =>
            applyTemplateValues(current, entry, groups, channelDefaults)
        )
        markDirty()
    }

    function setOwnSide(side: string | null) {
        const other =
            side && sides.length === 2
                ? (sides.find((entry) => entry !== side) ?? null)
                : values.opponentSide
        update({
            ownSide: side,
            opponentSide:
                values.opponentSide === side || (side && !values.opponentSide)
                    ? other
                    : values.opponentSide,
        })
    }

    function setOpponentSide(side: string | null) {
        const other =
            side && sides.length === 2
                ? (sides.find((entry) => entry !== side) ?? null)
                : values.ownSide
        update({
            opponentSide: side,
            ownSide:
                values.ownSide === side || (side && !values.ownSide)
                    ? other
                    : values.ownSide,
        })
    }

    const stepIndex = NEW_MATCH_STEPS.indexOf(step)
    const stepTitle = (entry: NewMatchStep) =>
        entry === "match" && !isMatch ? t.steps.training : t.steps[entry]
    const autosaveText =
        saveState.kind === "saving"
            ? t.autosave.saving
            : saveState.kind === "saved"
              ? fill(t.autosave.saved, {
                    time: formatTimeOnly(saveState.at.toISOString()),
                })
              : saveState.kind === "failed"
                ? t.autosave.failed
                : t.autosave.idle

    const sideSelect = (
        value: string | null,
        onChange: (side: string | null) => void,
        label: string
    ) => (
        <Select
            value={value ?? NO_SIDE}
            onValueChange={(next) => onChange(next === NO_SIDE ? null : next)}
        >
            <SelectTrigger
                aria-label={label}
                size="sm"
                className="h-8 rounded-lg text-[13px]"
            >
                <SelectValue />
            </SelectTrigger>
            <SelectContent>
                <SelectItem value={NO_SIDE}>{t.match.noSide}</SelectItem>
                {sides.map((side) => (
                    <SelectItem key={side} value={side}>
                        {sideLabel(side)}
                    </SelectItem>
                ))}
            </SelectContent>
        </Select>
    )

    // Review texts.
    const teamsText = isMatch
        ? opponentCode
            ? `${ownCode} vs ${opponentCode}`
            : t.review.noOpponent
        : null
    const reviewRows: Array<{ step: NewMatchStep; text: string }> = [
        {
            step: "match",
            text: [
                teamsText,
                selectedMap
                    ? [
                          selectedMap.name,
                          values.timeOfDay
                              ? timeLabel(values.timeOfDay).toLocaleLowerCase(
                                    intl
                                )
                              : null,
                      ]
                          .filter(Boolean)
                          .join(", ")
                    : null,
                template
                    ? fill(t.review.template, { name: template.name })
                    : null,
            ]
                .filter(Boolean)
                .join(" · "),
        },
        {
            step: "time",
            text: schedule
                ? [
                      formatAt(
                          isMatch ? schedule.gameStart : schedule.meetingStart
                      ),
                      isMatch
                          ? fill(t.review.reviewMeeting, {
                                time: formatTimeOnly(schedule.meetingStart),
                            })
                          : null,
                      fill(t.review.reviewSignupsUntil, {
                          date: formatAt(schedule.registrationEnd),
                      }),
                      values.repeatWeekly && isMatch ? t.review.repeats : null,
                  ]
                      .filter(Boolean)
                      .join(" · ")
                : t.review.missing,
        },
        {
            step: "signups",
            text: isMatch
                ? [
                      (values.allowedSignupStatuses.length
                          ? values.allowedSignupStatuses
                          : STATUSES
                      )
                          .map((status) => t.signups.statuses[status])
                          .join(", "),
                      offeredGroups
                          .map((group) =>
                              limitOf(group.id)
                                  ? fill(t.review.groupMax, {
                                        name: group.name,
                                        count: limitOf(group.id) ?? 0,
                                    })
                                  : group.name
                          )
                          .join(", "),
                  ]
                      .filter(Boolean)
                      .join(" · ")
                : t.signups.trainingNote,
        },
        {
            step: "discord",
            text: [
                values.announcementChannelId
                    ? `#${channelName(values.announcementChannelId) ?? values.announcementChannelId}`
                    : t.discord.defaultChannel,
                values.pingMode === "clan"
                    ? t.review.pingClan
                    : values.pingMode === "roles"
                      ? t.review.pingRoles
                      : t.review.pingNone,
                [
                    isMatch && values.createForumChannel
                        ? t.review.forum
                        : null,
                    values.createSquadVoiceChannels ? t.review.voice : null,
                ]
                    .filter(Boolean)
                    .join(` ${t.review.and} `),
            ]
                .filter(Boolean)
                .join(" · "),
        },
    ]
    const squadPreset = props.squadPresets.find(
        (preset) => preset.id === values.squadPresetId
    )
    const notice = fill(t.review.notice, {
        channel: values.announcementChannelId
            ? `#${channelName(values.announcementChannelId) ?? values.announcementChannelId}`
            : t.review.channelFallback,
        forum: isMatch && values.createForumChannel ? t.review.noticeForum : "",
        preset:
            isMatch && squadPreset
                ? fill(t.review.noticePreset, { name: squadPreset.name })
                : "",
    })

    const statusChip = (status: TemplateSignupStatus) => {
        const pressed = values.allowedSignupStatuses.length
            ? values.allowedSignupStatuses.includes(status)
            : true
        return (
            <button
                key={status}
                type="button"
                aria-pressed={pressed}
                onClick={() => {
                    const current = values.allowedSignupStatuses.length
                        ? values.allowedSignupStatuses
                        : STATUSES
                    const next = pressed
                        ? current.filter((entry) => entry !== status)
                        : [...current, status]
                    // Every status chosen is stored as "no restriction".
                    update({
                        allowedSignupStatuses:
                            next.length === STATUSES.length ? [] : next,
                    })
                }}
                className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                    pressed
                        ? "border-foreground bg-muted text-foreground"
                        : "border-border bg-background text-muted-foreground"
                )}
            >
                {pressed ? (
                    <Check className="size-3" strokeWidth={3} aria-hidden />
                ) : null}
                {t.signups.statuses[status]}
            </button>
        )
    }

    const timeRow = (label: string, value: string, first = false) => (
        <div
            className={cn(
                "flex justify-between gap-3 px-3.5 py-2.5 text-sm",
                !first && "border-border/50 border-t"
            )}
        >
            <span className="text-muted-foreground">{label}</span>
            <span className="text-right font-medium">{value}</span>
        </div>
    )

    const numberField = (
        id: string,
        label: string,
        value: number,
        unit: string,
        onChange: (value: number) => void,
        max: number
    ) => (
        <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor={id}>{label}</FieldLabel>
            <div className="flex items-center gap-2">
                <Input
                    id={id}
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={max}
                    value={value}
                    onChange={(event) => {
                        const next = Number(event.target.value)
                        if (Number.isInteger(next) && next >= 0 && next <= max)
                            onChange(next)
                    }}
                    className="h-9 w-20"
                />
                <span className="text-muted-foreground text-xs leading-tight">
                    {unit}
                </span>
            </div>
        </div>
    )

    return (
        <div className="flex flex-col gap-6 px-4 pb-12 lg:px-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-2xl leading-8 font-semibold tracking-tight">
                        {isMatch ? t.title : t.titleTraining}
                    </h1>
                    <p className="text-muted-foreground text-sm">
                        {t.description}
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <span
                        role="status"
                        aria-live="polite"
                        className={cn(
                            "text-[13px]",
                            saveState.kind === "failed"
                                ? "text-destructive"
                                : "text-muted-foreground"
                        )}
                    >
                        {autosaveText}
                    </span>
                    {draftId ? (
                        <ConfirmActionDialog
                            open={deleteOpen}
                            onOpenChange={setDeleteOpen}
                            trigger={
                                <Button type="button" variant="ghost" size="sm">
                                    {t.deleteDraft}
                                </Button>
                            }
                            title={fill(t.deleteDraftTitle, {
                                name: name || t.untitled,
                            })}
                            description={t.deleteDraftDescription}
                            confirmLabel={t.deleteDraft}
                            cancelLabel={dictionary.common.cancel}
                            onConfirm={deleteDraft}
                        />
                    ) : null}
                </div>
            </div>

            <ol
                aria-label={t.steps.label}
                className="m-0 flex list-none flex-wrap gap-2 p-0"
            >
                {NEW_MATCH_STEPS.map((entry, index) => {
                    const current = entry === step
                    const done = index < stepIndex
                    return (
                        <li key={entry}>
                            <button
                                type="button"
                                aria-current={current ? "step" : undefined}
                                onClick={() => setStep(entry)}
                                className={cn(
                                    "inline-flex h-10 items-center gap-2 rounded-full border pr-3.5 pl-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                    current
                                        ? "border-primary bg-primary text-primary-foreground"
                                        : "border-border bg-background text-foreground hover:bg-muted"
                                )}
                            >
                                {done ? (
                                    <span className="bg-primary text-primary-foreground flex size-7 items-center justify-center rounded-full">
                                        <Check
                                            className="size-3.5"
                                            strokeWidth={3}
                                            aria-label={t.steps.done}
                                        />
                                    </span>
                                ) : current ? (
                                    <span className="bg-background text-foreground flex size-7 items-center justify-center rounded-full text-[13px] font-semibold">
                                        {index + 1}
                                    </span>
                                ) : (
                                    <span className="border-border text-muted-foreground flex size-7 items-center justify-center rounded-full border text-[13px]">
                                        {index + 1}
                                    </span>
                                )}
                                {stepTitle(entry)}
                            </button>
                        </li>
                    )
                })}
            </ol>

            <div className="flex flex-wrap items-start gap-6">
                <section
                    aria-live="polite"
                    aria-labelledby="new-match-step"
                    className="bg-card text-card-foreground border-border flex min-w-0 flex-[999_1_440px] flex-col gap-[22px] rounded-[14px] border p-5 shadow-xs sm:p-7"
                >
                    {step === "match" ? (
                        <div className="flex flex-col gap-[22px]">
                            <h2
                                id="new-match-step"
                                className="text-lg leading-[26px] font-semibold"
                            >
                                {stepTitle("match")}
                            </h2>
                            {props.enabledGames.length > 1 ? (
                                <div className="flex flex-col gap-2">
                                    <FieldLabel id="nm-game">
                                        {t.match.game}
                                    </FieldLabel>
                                    <SegmentedControl
                                        label={t.match.game}
                                        value={values.gameId}
                                        onChange={changeGame}
                                        options={props.enabledGames.map(
                                            (gameId) => ({
                                                value: gameId,
                                                label: GAME_LABELS[gameId],
                                            })
                                        )}
                                    />
                                </div>
                            ) : null}
                            <div className="flex flex-col gap-2">
                                <FieldLabel id="nm-template">
                                    {t.match.template}
                                </FieldLabel>
                                {offeredTemplates.length ? (
                                    <div
                                        role="radiogroup"
                                        aria-labelledby="nm-template"
                                        className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-2"
                                    >
                                        {offeredTemplates.map((entry) => {
                                            const checked =
                                                entry.id === values.templateId
                                            return (
                                                <button
                                                    key={entry.id}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={checked}
                                                    onClick={() =>
                                                        pickTemplate(entry)
                                                    }
                                                    className={cn(
                                                        "flex flex-col items-start gap-0.5 rounded-[10px] border p-3 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                                                        checked
                                                            ? "border-foreground bg-muted/50"
                                                            : "border-border bg-background hover:bg-muted/40"
                                                    )}
                                                >
                                                    <span className="text-sm font-semibold">
                                                        {entry.name}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs leading-4">
                                                        {entry.kind ===
                                                        "training"
                                                            ? t.match
                                                                  .templateTraining
                                                            : fill(
                                                                  t.match
                                                                      .templateRegistration,
                                                                  {
                                                                      hours: entry.registrationHoursBeforeMeeting,
                                                                  }
                                                              )}
                                                    </span>
                                                </button>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <p className="text-muted-foreground text-sm">
                                        {t.match.noTemplates}{" "}
                                        <Link
                                            href={`/${locale}/dashboard/servers/${serverId}/settings/match-templates`}
                                            className="text-foreground underline underline-offset-[3px]"
                                        >
                                            {t.match.manageTemplates}
                                        </Link>
                                    </p>
                                )}
                            </div>
                            {isMatch ? (
                                <div className="flex flex-col gap-2">
                                    <FieldLabel id="nm-teams">
                                        {t.match.teams}
                                    </FieldLabel>
                                    <div className="border-border flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2.5">
                                        {ownTeam?.logoUrl ? (
                                            <TeamLogo
                                                name={ownTeam.name}
                                                shortCode={ownTeam.shortCode}
                                                logoUrl={ownTeam.logoUrl}
                                                className="size-8"
                                            />
                                        ) : (
                                            <span
                                                aria-hidden
                                                className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-semibold"
                                            >
                                                {ownCode}
                                            </span>
                                        )}
                                        <span className="flex min-w-0 flex-[1_1_140px] flex-col leading-[18px]">
                                            <span className="truncate text-sm font-medium">
                                                {ownTeam?.name ??
                                                    props.clan.name}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                {t.match.yourTeam}
                                            </span>
                                        </span>
                                        {sideSelect(
                                            values.ownSide,
                                            setOwnSide,
                                            t.match.yourSide
                                        )}
                                    </div>
                                    {teamGame ? (
                                        values.opponent ? (
                                            <div className="border-border flex flex-wrap items-center gap-2 rounded-[10px] border px-3 py-2.5">
                                                <TeamLogo
                                                    name={values.opponent.name}
                                                    shortCode={
                                                        values.opponent
                                                            .shortCode
                                                    }
                                                    logoUrl={
                                                        values.opponent.logoUrl
                                                    }
                                                    className="size-8"
                                                />
                                                <span className="flex min-w-0 flex-[1_1_140px] flex-col leading-[18px]">
                                                    <span className="truncate text-sm font-medium">
                                                        {values.opponent.name}
                                                    </span>
                                                    <span className="text-muted-foreground text-xs">
                                                        {
                                                            t.match
                                                                .opponentFromCatalogue
                                                        }
                                                    </span>
                                                </span>
                                                {sideSelect(
                                                    values.opponentSide,
                                                    setOpponentSide,
                                                    t.match.opponentSide
                                                )}
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon"
                                                    className="size-8"
                                                    aria-label={
                                                        t.match.changeOpponent
                                                    }
                                                    onClick={() =>
                                                        update({
                                                            opponent: null,
                                                            opponentSide: null,
                                                        })
                                                    }
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </div>
                                        ) : (
                                            <OpponentPicker
                                                serverId={serverId}
                                                gameId={teamGame}
                                                excludeIds={
                                                    ownTeam ? [ownTeam.id] : []
                                                }
                                                dictionary={dictionary}
                                                onPick={(team: TeamRecord) =>
                                                    update({
                                                        opponent: {
                                                            teamId: team.id,
                                                            name: team.name,
                                                            shortCode:
                                                                team.shortCode,
                                                            logoUrl:
                                                                team.logoUrl,
                                                        },
                                                    })
                                                }
                                            />
                                        )
                                    ) : null}
                                    {teamGame ? (
                                        <span className="text-muted-foreground text-[13px]">
                                            {t.match.missingTeam}{" "}
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    setRequestOpen(true)
                                                }
                                                className="text-foreground underline underline-offset-[3px]"
                                            >
                                                {t.match.requestTeam}
                                            </button>
                                        </span>
                                    ) : null}
                                    {teamGame ? (
                                        <TeamRequestDialog
                                            serverId={serverId}
                                            dictionary={dictionary}
                                            open={requestOpen}
                                            onOpenChange={setRequestOpen}
                                            target={{
                                                kind: "create",
                                                gameId: teamGame,
                                            }}
                                            onSubmitted={() => {
                                                setRequestOpen(false)
                                                toast.success(
                                                    t.match.requestSent
                                                )
                                            }}
                                        />
                                    ) : null}
                                </div>
                            ) : null}
                            {isMatch ? (
                                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(160px,100%),1fr))] gap-3">
                                    <div className="flex flex-col gap-1.5">
                                        <FieldLabel htmlFor="nm-map">
                                            {t.match.map}
                                        </FieldLabel>
                                        <Select
                                            value={values.mapId || NONE}
                                            onValueChange={(mapId) =>
                                                update({
                                                    mapId:
                                                        mapId === NONE
                                                            ? ""
                                                            : mapId,
                                                    timeOfDay:
                                                        mapId === NONE
                                                            ? ""
                                                            : (getHllTimeOptions(
                                                                  mapId,
                                                                  values.gameId
                                                              ).find(
                                                                  (option) =>
                                                                      option.value ===
                                                                      "day"
                                                              )?.value ??
                                                              getHllTimeOptions(
                                                                  mapId,
                                                                  values.gameId
                                                              )[0]?.value ??
                                                              ""),
                                                    cap: "",
                                                })
                                            }
                                        >
                                            <SelectTrigger
                                                id="nm-map"
                                                className="h-9 w-full"
                                            >
                                                <SelectValue
                                                    placeholder={t.match.choose}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE}>
                                                    {t.match.choose}
                                                </SelectItem>
                                                {maps.map((map) => (
                                                    <SelectItem
                                                        key={map.id}
                                                        value={map.id}
                                                    >
                                                        {map.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="flex flex-col gap-1.5">
                                        <FieldLabel htmlFor="nm-tod">
                                            {t.match.timeOfDay}
                                        </FieldLabel>
                                        <Select
                                            value={values.timeOfDay || NONE}
                                            disabled={!timeOptions.length}
                                            onValueChange={(timeOfDay) =>
                                                update({
                                                    timeOfDay:
                                                        timeOfDay === NONE
                                                            ? ""
                                                            : timeOfDay,
                                                })
                                            }
                                        >
                                            <SelectTrigger
                                                id="nm-tod"
                                                className="h-9 w-full"
                                            >
                                                <SelectValue
                                                    placeholder={t.match.choose}
                                                />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE}>
                                                    {t.match.choose}
                                                </SelectItem>
                                                {timeOptions.map((option) => (
                                                    <SelectItem
                                                        key={option.value}
                                                        value={option.value}
                                                    >
                                                        {timeLabel(
                                                            option.value
                                                        )}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    {values.gameId !== "wardogs" ? (
                                        <div className="flex flex-col gap-1.5">
                                            <FieldLabel htmlFor="nm-cap">
                                                {t.match.strongpoint}
                                            </FieldLabel>
                                            <Select
                                                value={values.cap || NONE}
                                                disabled={!strongpoints.length}
                                                onValueChange={(cap) =>
                                                    update({
                                                        cap:
                                                            cap === NONE
                                                                ? ""
                                                                : cap,
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id="nm-cap"
                                                    className="h-9 w-full"
                                                >
                                                    <SelectValue
                                                        placeholder={
                                                            t.match.choose
                                                        }
                                                    />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value={NONE}>
                                                        {t.match.choose}
                                                    </SelectItem>
                                                    {strongpoints.map(
                                                        (point) => (
                                                            <SelectItem
                                                                key={point.id}
                                                                value={
                                                                    point.label
                                                                }
                                                            >
                                                                {point.label}
                                                            </SelectItem>
                                                        )
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    ) : null}
                                </div>
                            ) : null}
                            <div className="flex flex-col gap-1.5">
                                <FieldLabel htmlFor="nm-name">
                                    {t.match.name}
                                </FieldLabel>
                                <Input
                                    id="nm-name"
                                    value={name}
                                    maxLength={200}
                                    aria-describedby="nm-name-hint"
                                    onChange={(event) =>
                                        update({
                                            name: event.target.value,
                                            nameTouched: true,
                                        })
                                    }
                                    className="h-9"
                                />
                                <span
                                    id="nm-name-hint"
                                    className="text-muted-foreground text-xs"
                                >
                                    {t.match.nameHint}
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {step === "time" ? (
                        <div className="flex flex-col gap-[22px]">
                            <h2
                                id="new-match-step"
                                className="text-lg leading-[26px] font-semibold"
                            >
                                {t.steps.time}
                            </h2>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <FieldLabel htmlFor="nm-date">
                                        {isMatch
                                            ? t.time.date
                                            : t.time.trainingDate}
                                    </FieldLabel>
                                    <Input
                                        id="nm-date"
                                        type="date"
                                        value={values.date}
                                        onChange={(event) =>
                                            update({ date: event.target.value })
                                        }
                                        className="h-9"
                                    />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <FieldLabel htmlFor="nm-time">
                                        {isMatch
                                            ? t.time.time
                                            : t.time.trainingTime}
                                    </FieldLabel>
                                    <Input
                                        id="nm-time"
                                        type="time"
                                        value={values.time}
                                        onChange={(event) =>
                                            update({ time: event.target.value })
                                        }
                                        className="h-9"
                                    />
                                </div>
                            </div>
                            <div className="border-border flex flex-col rounded-[10px] border">
                                <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-b px-3.5 py-3">
                                    <span className="text-muted-foreground text-[13px] font-medium">
                                        {template
                                            ? fill(t.time.fromTemplate, {
                                                  name: template.name,
                                              })
                                            : t.time.defaults}
                                    </span>
                                    <button
                                        type="button"
                                        aria-expanded={editingTimes}
                                        onClick={() =>
                                            setEditingTimes((open) => !open)
                                        }
                                        className="text-foreground h-7 rounded-md px-2.5 text-[13px] font-medium underline underline-offset-[3px]"
                                    >
                                        {editingTimes
                                            ? t.time.doneEditing
                                            : isMatch
                                              ? t.time.editHere
                                              : t.time.editHereTraining}
                                    </button>
                                </div>
                                {editingTimes ? (
                                    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(150px,100%),1fr))] gap-3 px-3.5 py-3">
                                        <div className="flex flex-col gap-1.5">
                                            <FieldLabel htmlFor="nm-ann">
                                                {t.time.announcement}
                                            </FieldLabel>
                                            <Select
                                                value={
                                                    values.announcementHours ===
                                                    null
                                                        ? "now"
                                                        : "before"
                                                }
                                                onValueChange={(mode) =>
                                                    update({
                                                        announcementHours:
                                                            mode === "now"
                                                                ? null
                                                                : (values.announcementHours ??
                                                                  72),
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    id="nm-ann"
                                                    className="h-9 w-full"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="now">
                                                        {t.time.immediately}
                                                    </SelectItem>
                                                    <SelectItem value="before">
                                                        {t.time.beforeStart}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {values.announcementHours !==
                                            null ? (
                                                <div className="flex items-center gap-2">
                                                    <Input
                                                        type="number"
                                                        aria-label={
                                                            t.time
                                                                .hoursBeforeStart
                                                        }
                                                        min={0}
                                                        max={720}
                                                        value={
                                                            values.announcementHours
                                                        }
                                                        onChange={(event) => {
                                                            const next = Number(
                                                                event.target
                                                                    .value
                                                            )
                                                            if (
                                                                Number.isInteger(
                                                                    next
                                                                ) &&
                                                                next >= 0 &&
                                                                next <= 720
                                                            )
                                                                update({
                                                                    announcementHours:
                                                                        next,
                                                                })
                                                        }}
                                                        className="h-9 w-20"
                                                    />
                                                    <span className="text-muted-foreground text-xs">
                                                        {
                                                            t.time
                                                                .hoursBeforeStart
                                                        }
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>
                                        {numberField(
                                            "nm-reg",
                                            t.time.registrationEnd,
                                            values.registrationHours,
                                            t.time.hoursBeforeMeeting,
                                            (registrationHours) =>
                                                update({ registrationHours }),
                                            720
                                        )}
                                        {isMatch
                                            ? numberField(
                                                  "nm-meet",
                                                  t.time.meeting,
                                                  values.meetingMinutes,
                                                  t.time.minutesBeforeStart,
                                                  (meetingMinutes) =>
                                                      update({
                                                          meetingMinutes,
                                                      }),
                                                  1440
                                              )
                                            : null}
                                        {numberField(
                                            "nm-dur",
                                            t.time.duration,
                                            values.durationMinutes,
                                            t.time.minutes,
                                            (durationMinutes) =>
                                                update({
                                                    durationMinutes: Math.max(
                                                        1,
                                                        durationMinutes
                                                    ),
                                                }),
                                            1440
                                        )}
                                    </div>
                                ) : null}
                                {timeRow(
                                    t.time.announcement,
                                    schedule?.registrationStart
                                        ? formatAt(schedule.registrationStart)
                                        : t.time.onPublish,
                                    editingTimes ? false : true
                                )}
                                {timeRow(
                                    t.time.registrationEnd,
                                    schedule
                                        ? formatAt(schedule.registrationEnd)
                                        : "—"
                                )}
                                {timeRow(
                                    t.time.meeting,
                                    schedule
                                        ? formatAt(schedule.meetingStart)
                                        : "—"
                                )}
                                {timeRow(
                                    isMatch ? t.time.end : t.time.endTraining,
                                    schedule ? formatAt(schedule.gameEnd) : "—"
                                )}
                            </div>
                            {isMatch ? (
                                <div className="flex items-start gap-3">
                                    <Switch
                                        id="nm-repeat"
                                        checked={values.repeatWeekly}
                                        onCheckedChange={(repeatWeekly) =>
                                            update({ repeatWeekly })
                                        }
                                        className="mt-0.5"
                                    />
                                    <label
                                        htmlFor="nm-repeat"
                                        className="flex flex-col leading-5"
                                    >
                                        <span className="text-sm">
                                            {t.time.repeat}
                                        </span>
                                        <span className="text-muted-foreground text-[13px]">
                                            {t.time.repeatHint}
                                        </span>
                                    </label>
                                </div>
                            ) : null}
                        </div>
                    ) : null}

                    {step === "signups" ? (
                        <div className="flex flex-col gap-[22px]">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h2
                                    id="new-match-step"
                                    className="text-lg leading-[26px] font-semibold"
                                >
                                    {t.steps.signups}
                                </h2>
                                {template ? (
                                    <span className="border-border text-muted-foreground rounded-md border px-2 py-0.5 text-xs font-medium">
                                        {fill(t.signups.fromTemplate, {
                                            name: template.name,
                                        })}
                                    </span>
                                ) : null}
                            </div>
                            {isMatch ? (
                                <>
                                    <div className="flex flex-col gap-2">
                                        <FieldLabel id="nm-who">
                                            {t.signups.who}
                                        </FieldLabel>
                                        <div
                                            role="group"
                                            aria-labelledby="nm-who"
                                            className="flex flex-wrap gap-2"
                                        >
                                            {STATUSES.map(statusChip)}
                                        </div>
                                    </div>
                                    {groupsOfGame.length ? (
                                        <div className="border-border flex flex-col rounded-[10px] border">
                                            {offeredGroups.map(
                                                (group, index) => (
                                                    <div
                                                        key={group.id}
                                                        className={cn(
                                                            "flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm",
                                                            index &&
                                                                "border-border/50 border-t"
                                                        )}
                                                    >
                                                        <span>
                                                            {group.name}
                                                        </span>
                                                        <span className="text-muted-foreground">
                                                            {limitOf(group.id)
                                                                ? fill(
                                                                      t.signups
                                                                          .max,
                                                                      {
                                                                          count:
                                                                              limitOf(
                                                                                  group.id
                                                                              ) ??
                                                                              0,
                                                                      }
                                                                  )
                                                                : t.signups
                                                                      .noLimit}
                                                        </span>
                                                    </div>
                                                )
                                            )}
                                            {values.useGeneralSignup ? (
                                                <div
                                                    className={cn(
                                                        "flex items-center justify-between gap-3 px-3.5 py-2.5 text-sm",
                                                        offeredGroups.length &&
                                                            "border-border/50 border-t"
                                                    )}
                                                >
                                                    <span>
                                                        {t.signups.general}
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {t.signups.generalOn}
                                                    </span>
                                                </div>
                                            ) : null}
                                        </div>
                                    ) : (
                                        <p className="text-muted-foreground text-sm">
                                            {t.signups.noGroups}
                                        </p>
                                    )}
                                    <div className="flex flex-wrap justify-between gap-3 text-sm">
                                        <span className="text-muted-foreground">
                                            {t.signups.reminder}
                                        </span>
                                        <span className="font-medium">
                                            {reminderAudience(
                                                values.signupReminderStatuses
                                            ) === "off"
                                                ? t.signups.reminderOff
                                                : fill(t.signups.reminderOn, {
                                                      audience:
                                                          t.signups.audience[
                                                              reminderAudience(
                                                                  values.signupReminderStatuses
                                                              ) as
                                                                  | "member"
                                                                  | "memberRecruit"
                                                                  | "all"
                                                          ],
                                                  })}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <p className="text-muted-foreground text-sm">
                                    {t.signups.trainingNote}
                                </p>
                            )}
                        </div>
                    ) : null}

                    {step === "discord" ? (
                        <div className="flex flex-col gap-[22px]">
                            <h2
                                id="new-match-step"
                                className="text-lg leading-[26px] font-semibold"
                            >
                                {t.steps.discord}
                            </h2>
                            <div className="grid grid-cols-[repeat(auto-fit,minmax(min(180px,100%),1fr))] gap-3">
                                {(
                                    [
                                        [
                                            "nm-ch",
                                            t.discord.announcement,
                                            "announcementChannelId",
                                        ],
                                        ...(isMatch
                                            ? ([
                                                  [
                                                      "nm-ch2",
                                                      t.discord.roster,
                                                      "eventInfoChannelId",
                                                  ],
                                              ] as const)
                                            : []),
                                    ] as const
                                ).map(([id, label, field]) => (
                                    <div
                                        key={id}
                                        className="flex flex-col gap-1.5"
                                    >
                                        <FieldLabel htmlFor={id}>
                                            {label}
                                        </FieldLabel>
                                        <Select
                                            value={values[field] || NONE}
                                            onValueChange={(channelId) =>
                                                update({
                                                    [field]:
                                                        channelId === NONE
                                                            ? ""
                                                            : channelId,
                                                })
                                            }
                                        >
                                            <SelectTrigger
                                                id={id}
                                                className="h-9 w-full"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value={NONE}>
                                                    {t.discord.defaultChannel}
                                                </SelectItem>
                                                {values[field] &&
                                                !channelName(values[field]) ? (
                                                    <SelectItem
                                                        value={values[field]}
                                                    >
                                                        <span className="text-muted-foreground">
                                                            #
                                                        </span>{" "}
                                                        {values[field]}
                                                    </SelectItem>
                                                ) : null}
                                                {textChannels.map((channel) => (
                                                    <SelectItem
                                                        key={channel.id}
                                                        value={channel.id}
                                                    >
                                                        <span className="text-muted-foreground">
                                                            #
                                                        </span>{" "}
                                                        {channel.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                ))}
                            </div>
                            <div className="flex flex-col gap-2">
                                <FieldLabel id="nm-ping">
                                    {t.discord.ping}
                                </FieldLabel>
                                <SegmentedControl
                                    label={t.discord.ping}
                                    size="sm"
                                    value={values.pingMode}
                                    onChange={(pingMode) =>
                                        update({ pingMode })
                                    }
                                    options={[
                                        {
                                            value: "none",
                                            label: t.discord.pingNone,
                                        },
                                        {
                                            value: "clan",
                                            label: t.discord.pingClan,
                                        },
                                        {
                                            value: "roles",
                                            label: t.discord.pingRoles,
                                        },
                                    ]}
                                />
                                {values.pingMode === "roles" ? (
                                    <DiscordMultiEntitySelect
                                        value={values.pingRoleIds}
                                        onChange={(pingRoleIds) =>
                                            update({ pingRoleIds })
                                        }
                                        options={metadata?.roles ?? []}
                                        placeholder={t.discord.pingRolesLabel}
                                    />
                                ) : null}
                            </div>
                            <div className="flex flex-col gap-3">
                                {isMatch ? (
                                    <div className="flex items-center gap-3">
                                        <Switch
                                            id="nm-forum"
                                            checked={values.createForumChannel}
                                            onCheckedChange={(
                                                createForumChannel
                                            ) => update({ createForumChannel })}
                                        />
                                        <Label
                                            htmlFor="nm-forum"
                                            className="text-sm font-normal"
                                        >
                                            {t.discord.forum}
                                        </Label>
                                    </div>
                                ) : null}
                                <div className="flex items-center gap-3">
                                    <Switch
                                        id="nm-voice"
                                        checked={
                                            values.createSquadVoiceChannels
                                        }
                                        onCheckedChange={(
                                            createSquadVoiceChannels
                                        ) =>
                                            update({ createSquadVoiceChannels })
                                        }
                                    />
                                    <Label
                                        htmlFor="nm-voice"
                                        className="text-sm font-normal"
                                    >
                                        {t.discord.voice}
                                    </Label>
                                </div>
                            </div>
                            <div className="flex flex-col gap-1.5">
                                <FieldLabel htmlFor="nm-pass">
                                    {t.discord.serverAndPassword}
                                </FieldLabel>
                                <div className="flex flex-wrap gap-2">
                                    <Input
                                        aria-label={t.discord.server}
                                        placeholder={
                                            t.discord.serverPlaceholder
                                        }
                                        value={values.server}
                                        maxLength={200}
                                        onChange={(event) =>
                                            update({
                                                server: event.target.value,
                                            })
                                        }
                                        className="h-9 flex-[2_1_180px]"
                                    />
                                    <Input
                                        id="nm-pass"
                                        type="password"
                                        autoComplete="off"
                                        placeholder={t.discord.password}
                                        value={values.serverPassword}
                                        maxLength={200}
                                        onChange={(event) =>
                                            update({
                                                serverPassword:
                                                    event.target.value,
                                            })
                                        }
                                        className="h-9 flex-[1_1_120px]"
                                    />
                                </div>
                                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
                                    <EyeOff className="size-3" aria-hidden />
                                    {t.discord.passwordHint}
                                </span>
                            </div>
                        </div>
                    ) : null}

                    {step === "review" ? (
                        <div className="flex flex-col gap-[18px]">
                            <h2
                                id="new-match-step"
                                className="text-lg leading-[26px] font-semibold"
                            >
                                {t.steps.review}
                            </h2>
                            <ul className="border-border m-0 flex list-none flex-col rounded-[10px] border p-0">
                                {reviewRows.map((row, index) => (
                                    <li
                                        key={row.step}
                                        className={cn(
                                            "flex items-start gap-2.5 px-3.5 py-3",
                                            index && "border-border/60 border-t"
                                        )}
                                    >
                                        <CircleCheck
                                            className="mt-px size-[18px] shrink-0 text-green-700 dark:text-green-500"
                                            role="img"
                                            aria-label={t.steps.done}
                                        />
                                        <span className="flex min-w-0 flex-1 flex-col leading-5">
                                            <span className="text-sm font-medium">
                                                {stepTitle(row.step)}
                                            </span>
                                            <span className="text-muted-foreground text-[13px] break-words">
                                                {row.text}
                                            </span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setStep(row.step)}
                                            className="text-foreground h-7 rounded-md px-2.5 text-[13px] font-medium underline underline-offset-[3px]"
                                        >
                                            {t.review.edit}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                            <p className="bg-muted text-foreground/80 m-0 flex gap-2.5 rounded-[10px] px-3.5 py-3 text-sm leading-5">
                                <Info
                                    className="mt-px size-[18px] shrink-0"
                                    aria-hidden
                                />
                                {notice}
                            </p>
                        </div>
                    ) : null}

                    <div className="border-border/60 flex flex-wrap items-center justify-between gap-3 border-t pt-[18px]">
                        <div className="flex">
                            {stepIndex > 0 ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() =>
                                        setStep(NEW_MATCH_STEPS[stepIndex - 1])
                                    }
                                >
                                    <ArrowLeft aria-hidden />
                                    {t.back}
                                </Button>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {step !== "review" ? (
                                <Button
                                    type="button"
                                    onClick={() =>
                                        setStep(NEW_MATCH_STEPS[stepIndex + 1])
                                    }
                                >
                                    {t.next}
                                    <ArrowRight aria-hidden />
                                </Button>
                            ) : (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        disabled={busy !== null}
                                        onClick={() => void saveAsDraft()}
                                    >
                                        {t.saveDraft}
                                    </Button>
                                    <Button
                                        type="button"
                                        disabled={busy !== null}
                                        onClick={() => void publish()}
                                    >
                                        <Send aria-hidden />
                                        {t.publish}
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>
                </section>

                <div className="flex max-w-[460px] min-w-0 flex-[1_1_360px] flex-col">
                    <NewMatchPreview
                        model={previewModel}
                        step={step}
                        dictionary={dictionary}
                        copy={props.previewCopy}
                    />
                </div>
            </div>
        </div>
    )
}
