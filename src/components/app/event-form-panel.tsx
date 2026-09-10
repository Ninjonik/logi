"use client"

import { Check, ChevronsUpDown, Loader2, RefreshCw } from "lucide-react"
import { useEffect, useMemo, useState, useTransition } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useForm } from "react-hook-form"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import type {
    DiscordConfig,
    EventCategory,
    EventRecord,
    Group,
    StratmapRecord,
    TopicPreset,
} from "@/types/domain"
import {
    formatHllPresetLabel,
    inferHllBaseMapId,
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
    DiscordEntitySelect,
    type DiscordSelectOption,
} from "@/components/app/discord-entity-select"
import {
    DiscordMarkdownText,
    DiscordMarkdownTextarea,
} from "@/components/app/discord-markdown"
import {
    fromDateTimeLocalInTimeZone,
    toDateTimeLocalInTimeZone,
} from "@/lib/timezone-datetime"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"
import { DiscordMultiEntitySelect } from "@/components/app/discord-multi-entity-select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { eventSchema, type EventInput } from "@/lib/validation/event"
import { HllMapSelector } from "@/components/app/hll-map-selector"
import { getEventCategoryLabel } from "@/lib/event-categories"
import { ConfigNotice } from "@/components/app/config-notice"
import { AvatarPicker } from "@/components/app/avatar-picker"
import { supportedTimezones } from "@/lib/discord-timezones"
import { EmojiValue } from "@/components/app/emoji-value"
import { filterByGameScope } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

type DiscordMetadata = {
    roles: DiscordSelectOption[]
    channels: Array<DiscordSelectOption & { type: number; parentId?: string }>
}

type TopicPresetOption = {
    preset: TopicPreset
    match: ReturnType<typeof getPresetMatch>
}

function FieldLabel({
    label,
    required,
    className,
}: {
    label: string
    required?: boolean
    className?: string
}) {
    return (
        <div
            className={cn(
                "mb-2 flex items-center gap-1 text-sm font-medium",
                className
            )}
        >
            <span>{label}</span>
            {required && <span className="text-destructive font-bold">*</span>}
        </div>
    )
}

function normalizeMatchValue(value?: string) {
    return value?.trim().toLowerCase() ?? ""
}

type TopicPresetMatchContext = {
    mapCode?: string
    mapId?: string
    time?: string
    mode?: string
    side?: string
    cap?: string
}

function getOutcomeLabel(
    outcome: "victory" | "defeat" | "draw",
    dictionary: Dictionary
) {
    switch (outcome) {
        case "victory":
            return dictionary.event.resultVictory
        case "defeat":
            return dictionary.event.resultDefeat
        case "draw":
            return dictionary.event.resultDraw
        default:
            return outcome
    }
}

function getPresetMatch(preset: TopicPreset, context: TopicPresetMatchContext) {
    const presetSelection = inferHllSelection(preset.map)
    const presetMapId = presetSelection?.mapId ?? inferHllBaseMapId(preset.map)
    const hasComparableMapCode = Boolean(context.mapCode && preset.map)
    const hasComparableMapId = Boolean(context.mapId && presetMapId)
    const hasComparableTime = Boolean(context.time && presetSelection?.time)
    const hasComparableMode = Boolean(context.mode && presetSelection?.mode)
    const hasComparableSide = Boolean(context.side && preset.side)
    const hasComparableCap = Boolean(context.cap && preset.cap)

    const exactMapCodeMatch =
        hasComparableMapCode &&
        normalizeMatchValue(context.mapCode) === normalizeMatchValue(preset.map)
    const mapIdMatch = hasComparableMapId && context.mapId === presetMapId
    const timeMatch =
        hasComparableTime && context.time === presetSelection?.time
    const modeMatch =
        hasComparableMode && context.mode === presetSelection?.mode
    const sideMatch =
        hasComparableSide &&
        normalizeMatchValue(context.side) === normalizeMatchValue(preset.side)
    const capMatch =
        hasComparableCap &&
        normalizeMatchValue(context.cap) === normalizeMatchValue(preset.cap)

    const matchedFields = [
        exactMapCodeMatch || mapIdMatch ? "Map" : null,
        timeMatch ? "Time" : null,
        modeMatch ? "Mode" : null,
        sideMatch ? "Side" : null,
        capMatch ? "Point" : null,
    ].filter((value): value is string => Boolean(value))

    const score =
        (exactMapCodeMatch ? 200 : 0) +
        (mapIdMatch ? 120 : 0) +
        (modeMatch ? 30 : 0) +
        (timeMatch ? 20 : 0) +
        (sideMatch ? 8 : 0) +
        (capMatch ? 4 : 0)

    const comparableFieldCount = [
        hasComparableMapCode || hasComparableMapId,
        hasComparableTime,
        hasComparableMode,
        hasComparableSide,
        hasComparableCap,
    ].filter(Boolean).length

    return {
        score,
        isFullMatch:
            comparableFieldCount > 0 &&
            matchedFields.length === comparableFieldCount,
        label: matchedFields.join(" + "),
        metaLabel: formatHllPresetLabel(preset.map) ?? preset.map ?? "",
    }
}

function resolveTrainingEndTime(values: EventInput, timezone: string) {
    const meetingStartIso = fromDateTimeLocalInTimeZone(
        values.meetingStart,
        timezone
    )
    const fallbackEndIso = values.gameEnd
        ? fromDateTimeLocalInTimeZone(values.gameEnd, timezone)
        : meetingStartIso

    const meetingStartMs = new Date(meetingStartIso).getTime()
    const fallbackEndMs = new Date(fallbackEndIso).getTime()

    if (!Number.isFinite(meetingStartMs) || !Number.isFinite(fallbackEndMs)) {
        return fallbackEndIso
    }

    if (fallbackEndMs > meetingStartMs) {
        return fallbackEndIso
    }

    return new Date(meetingStartMs + 90 * 60 * 1000).toISOString()
}

function getAllowedSignupStatusLabel(
    status: "recruit" | "member" | "reserve_member" | "mercenary",
    dictionary: Dictionary
) {
    switch (status) {
        case "recruit":
            return dictionary.userManagement.recruitLabel
        case "reserve_member":
            return dictionary.userManagement.reserveMemberLabel
        case "mercenary":
            return dictionary.userManagement.mercLabel
        default:
            return dictionary.userManagement.memberLabel
    }
}

function TopicPresetSelect({
    value,
    onChange,
    options,
    dictionary,
}: {
    value?: string
    onChange: (value: string) => void
    options: TopicPresetOption[]
    dictionary: Dictionary
}) {
    const [open, setOpen] = useState(false)
    const selectedOption = options.find(({ preset }) => preset.id === value)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className="h-auto w-full justify-between rounded-xl py-3"
                >
                    <span className="flex min-w-0 flex-col items-start text-left">
                        <span className="truncate font-medium">
                            {selectedOption?.preset.name ??
                                dictionary.event.noPreset}
                        </span>
                        {selectedOption?.match.metaLabel ? (
                            <span className="text-muted-foreground truncate text-xs">
                                {selectedOption.match.metaLabel}
                            </span>
                        ) : null}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start">
                <Command>
                    <CommandInput placeholder={dictionary.event.topicPreset} />
                    <CommandList>
                        <CommandEmpty>
                            {dictionary.shared.noMatchingResults}
                        </CommandEmpty>
                        <CommandGroup>
                            <CommandItem
                                value={dictionary.event.noPreset}
                                onSelect={() => {
                                    onChange("")
                                    setOpen(false)
                                }}
                            >
                                <Check
                                    className={cn(
                                        "mr-2 size-4",
                                        !value ? "opacity-100" : "opacity-0"
                                    )}
                                />
                                {dictionary.event.noPreset}
                            </CommandItem>
                            {options.map(({ preset, match }) => (
                                <CommandItem
                                    key={preset.id}
                                    value={[
                                        preset.name,
                                        match.metaLabel,
                                        preset.side,
                                        preset.cap,
                                        preset.map,
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    onSelect={() => {
                                        onChange(preset.id)
                                        setOpen(false)
                                    }}
                                >
                                    <Check
                                        className={cn(
                                            "mt-0.5 mr-2 size-4 shrink-0",
                                            value === preset.id
                                                ? "opacity-100"
                                                : "opacity-0"
                                        )}
                                    />
                                    <div className="flex min-w-0 flex-1 items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate font-medium">
                                                {preset.name}
                                            </div>
                                            {match.metaLabel ? (
                                                <div className="text-muted-foreground truncate text-xs">
                                                    {match.metaLabel}
                                                </div>
                                            ) : null}
                                        </div>
                                        {match.score > 0 ? (
                                            <Badge
                                                variant={
                                                    match.isFullMatch
                                                        ? "default"
                                                        : "secondary"
                                                }
                                                className="shrink-0 rounded-md"
                                            >
                                                {match.isFullMatch
                                                    ? dictionary.event
                                                          .topicPresetCompleteMatch
                                                    : dictionary.event
                                                          .topicPresetPartialMatch}
                                            </Badge>
                                        ) : null}
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

function ReadOnlyValue({
    value,
    emptyLabel,
    className = "",
}: {
    value?: string | null
    emptyLabel: string
    className?: string
}) {
    return (
        <div
            className={`border-border/60 bg-muted/30 rounded-xl border px-4 py-3 text-sm ${className}`.trim()}
        >
            {value?.trim() || emptyLabel}
        </div>
    )
}

function ReadOnlyList({
    values,
    emptyLabel,
}: {
    values: string[]
    emptyLabel: string
}) {
    return (
        <div className="border-border/60 bg-muted/30 rounded-xl border px-4 py-3 text-sm">
            {values.length ? values.join(", ") : emptyLabel}
        </div>
    )
}

function StratmapMultiSelect({
    value,
    onChange,
    stratmaps,
    dictionary,
}: {
    value: string[]
    onChange: (value: string[]) => void
    stratmaps: StratmapRecord[]
    dictionary: Dictionary
}) {
    const [open, setOpen] = useState(false)
    const selectedIds = new Set(value)

    function toggle(stratmapId: string) {
        if (selectedIds.has(stratmapId)) {
            onChange(value.filter((id) => id !== stratmapId))
            return
        }

        onChange([...value, stratmapId])
    }

    const selectedLabels = stratmaps
        .filter((stratmap) => selectedIds.has(stratmap.id))
        .map((stratmap) => stratmap.title)

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    className="h-auto min-h-11 w-full justify-between rounded-xl py-3"
                >
                    <span className="flex min-w-0 flex-1 flex-wrap gap-2 text-left">
                        {selectedLabels.length ? (
                            selectedLabels.map((label) => (
                                <Badge
                                    key={label}
                                    variant="secondary"
                                    className="rounded-md"
                                >
                                    {label}
                                </Badge>
                            ))
                        ) : (
                            <span className="text-muted-foreground text-sm">
                                {dictionary.shared.notSet}
                            </span>
                        )}
                    </span>
                    <ChevronsUpDown className="size-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[420px] p-0" align="start">
                <Command>
                    <CommandInput
                        placeholder={dictionary.event.fields.stratmaps}
                    />
                    <CommandList>
                        <CommandEmpty>
                            {dictionary.shared.noMatchingResults}
                        </CommandEmpty>
                        <CommandGroup>
                            {stratmaps.map((stratmap) => (
                                <CommandItem
                                    key={stratmap.id}
                                    value={[
                                        stratmap.title,
                                        stratmap.baseMapId,
                                        stratmap.side,
                                        stratmap.strongpointId,
                                    ]
                                        .filter(Boolean)
                                        .join(" ")}
                                    onSelect={() => toggle(stratmap.id)}
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 size-4",
                                            selectedIds.has(stratmap.id)
                                                ? "opacity-100"
                                                : "opacity-0"
                                        )}
                                    />
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate font-medium">
                                            {stratmap.title}
                                        </span>
                                        <span className="text-muted-foreground truncate text-xs">
                                            {[
                                                stratmap.baseMapId,
                                                stratmap.side,
                                                stratmap.strongpointId,
                                            ]
                                                .filter(Boolean)
                                                .join(" • ")}
                                        </span>
                                    </div>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}

export function EventFormPanel({
    event,
    serverId,
    locale,
    topicPresets,
    stratmaps,
    groups,
    eventCategories = [],
    timezone = "UTC",
    canEdit,
    dictionary,
    createMode = false,
    discordConfig,
}: {
    event: EventRecord
    serverId: string
    locale: string
    topicPresets: TopicPreset[]
    stratmaps: StratmapRecord[]
    groups: Group[]
    eventCategories?: EventCategory[]
    timezone?: string
    canEdit: boolean
    dictionary: Dictionary
    createMode?: boolean
    discordConfig?: DiscordConfig | null
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const [metadata, setMetadata] = useState<DiscordMetadata | null>(null)
    const [selectedMapId, setSelectedMapId] = useState("")
    const [selectedMapTime, setSelectedMapTime] = useState("")
    const [selectedMapMode, setSelectedMapMode] = useState("")
    const [quickSchedule, setQuickSchedule] = useState({
        eventStart: toDateTimeLocalInTimeZone(
            event.kind === "match" ? event.gameStart : event.meetingStart,
            timezone
        ),
        registrationHours: "24",
        meetingMinutes: "30",
        durationMinutes: "90",
    })
    const [quickScheduleOpen, setQuickScheduleOpen] = useState(false)
    const [quickScheduleStep, setQuickScheduleStep] = useState(0)
    const [isResyncingTopicThread, setIsResyncingTopicThread] = useState(false)
    const eventGroups = useMemo(
        () => filterByGameScope(groups, event.gameId),
        [event.gameId, groups]
    )
    const eventGroupIds = useMemo(
        () => new Set(eventGroups.map((group) => group.id)),
        [eventGroups]
    )

    const form = useForm<EventInput>({
        resolver: zodResolver(eventSchema),
        defaultValues: {
            kind: event.kind ?? "match",
            matchType: event.matchType ?? "",
            name: event.name ?? "",
            description: event.description ?? "",
            thumbnailUrl: event.thumbnailUrl ?? "",
            imageUrl: event.imageUrl ?? "",
            announcementChannelId:
                event.announcementChannelId ??
                (createMode
                    ? (discordConfig?.announcementsChannelId ?? "")
                    : ""),
            eventInfoChannelId:
                event.eventInfoChannelId ??
                (createMode ? (discordConfig?.eventInfoChannelId ?? "") : ""),
            meetingChannelId: event.meetingChannelId ?? "",
            requiredRoleIds: event.requiredRoleIds,
            rewardRoleIds: event.rewardRoleIds,
            server: event.server ?? "",
            serverPassword: event.serverPassword ?? "",
            side: event.side ?? "",
            map: event.map ?? "",
            cap: event.cap ?? "",
            notes: event.notes ?? "",
            registrationEnd: toDateTimeLocalInTimeZone(
                event.registrationEnd,
                timezone
            ),
            meetingStart: toDateTimeLocalInTimeZone(
                event.meetingStart,
                timezone
            ),
            gameStart: toDateTimeLocalInTimeZone(event.gameStart, timezone),
            gameEnd: toDateTimeLocalInTimeZone(event.gameEnd, timezone),
            pingClan: event.pingClan,
            pingMode: event.pingMode ?? (event.pingClan ? "clan" : "none"),
            pingRoleIds: event.pingRoleIds ?? [],
            createForumChannel: event.createForumChannel,
            topicPresetId: event.topicPresetId ?? "",
            stratmapIds: event.stratmapIds ?? [],
            signupGroupIds: (
                event.signupGroupIds ?? eventGroups.map((group) => group.id)
            ).filter((groupId) => eventGroupIds.has(groupId)),
            allowedSignupStatuses: event.allowedSignupStatuses ?? [],
            useGeneralSignup: event.useGeneralSignup ?? false,
            signupReminderStatuses: event.signupReminderStatuses ?? ["member"],
            recurrence: event.recurrence,
        },
    })
    const eventKind = form.watch("kind")
    const detailBasePath = eventKind === "training" ? "trainings" : "matches"
    const eventName = form.watch("name")
    const eventCategoryValue = form.watch("matchType")
    const sideValue = form.watch("side")
    const mapValue = form.watch("map")
    const pingMode = form.watch("pingMode")
    const createForumChannel = form.watch("createForumChannel")
    const recurrence = form.watch("recurrence")
    const eventMatchValues = form.watch(["map", "side", "cap"])
    const scheduleValues = form.watch([
        "registrationEnd",
        "meetingStart",
        "gameStart",
        "gameEnd",
    ])
    const formatScheduleValue = (value?: string) =>
        value && !Number.isNaN(new Date(value).getTime())
            ? new Intl.DateTimeFormat(
                  locale === "cs"
                      ? "cs-CZ"
                      : locale === "de"
                        ? "de-DE"
                        : "en-GB",
                  {
                      dateStyle: "medium",
                      timeStyle: "short",
                  }
              ).format(new Date(value))
            : dictionary.shared.notSet
    const presetMatchValues = {
        map: eventMatchValues[0],
        side: eventMatchValues[1],
        cap: eventMatchValues[2],
    }
    const meetingChannels =
        metadata?.channels?.filter(
            (channel) => channel.type === 2 || channel.type === 13
        ) ?? []
    const announcementChannels =
        metadata?.channels?.filter(
            (channel) => channel.type === 0 || channel.type === 5
        ) ?? []
    const roleNameById = useMemo(
        () =>
            new Map(
                (metadata?.roles ?? []).map((role) => [role.id, role.name])
            ),
        [metadata?.roles]
    )
    const channelNameById = useMemo(
        () =>
            new Map(
                (metadata?.channels ?? []).map((channel) => [
                    channel.id,
                    channel.name,
                ])
            ),
        [metadata?.channels]
    )
    const presetMatchContext = useMemo<TopicPresetMatchContext>(
        () => ({
            mapCode: mapValue,
            mapId: selectedMapId || inferHllSelection(mapValue)?.mapId,
            time: selectedMapTime || inferHllSelection(mapValue)?.time,
            mode: selectedMapMode || inferHllSelection(mapValue)?.mode,
            side: sideValue,
            cap: presetMatchValues.cap,
        }),
        [
            mapValue,
            presetMatchValues.cap,
            selectedMapId,
            selectedMapMode,
            selectedMapTime,
            sideValue,
        ]
    )
    const topicPresetOptions = useMemo(
        () =>
            topicPresets
                .map((preset) => ({
                    preset,
                    match: getPresetMatch(preset, presetMatchContext),
                }))
                .sort(
                    (left, right) =>
                        right.match.score - left.match.score ||
                        right.match.label.length - left.match.label.length ||
                        left.preset.name.localeCompare(right.preset.name)
                ),
        [presetMatchContext, topicPresets]
    )

    useEffect(() => {
        if (!canEdit) return

        fetch(`/api/servers/${serverId}/discord-metadata`)
            .then(async (response) => {
                const body = await response.json()
                if (
                    !response.ok ||
                    !body ||
                    !Array.isArray(body.roles) ||
                    !Array.isArray(body.channels)
                ) {
                    throw new Error("Unable to load Discord metadata.")
                }
                setMetadata(body)
            })
            .catch(() => setMetadata(null))
    }, [canEdit, serverId])

    useEffect(() => {
        if (eventKind !== "match") {
            return
        }

        const inferredSelection = inferHllSelection(mapValue)
        if (inferredSelection) {
            setSelectedMapId(inferredSelection.mapId)
            setSelectedMapTime(inferredSelection.time)
            setSelectedMapMode(inferredSelection.mode)
            return
        }

        setSelectedMapId("")
        setSelectedMapTime("")
        setSelectedMapMode("")
    }, [eventKind, mapValue])

    useEffect(() => {
        if (
            eventKind !== "match" ||
            !selectedMapId ||
            !selectedMapTime ||
            !selectedMapMode
        ) {
            return
        }

        const resolvedCode = resolveHllPresetCode({
            mapId: selectedMapId,
            time: selectedMapTime,
            mode: selectedMapMode,
            side: sideValue,
        })

        if (resolvedCode && resolvedCode !== mapValue) {
            form.setValue("map", resolvedCode, {
                shouldDirty: true,
                shouldTouch: true,
            })
        }
    }, [
        eventKind,
        form,
        mapValue,
        selectedMapId,
        selectedMapMode,
        selectedMapTime,
        sideValue,
    ])

    useEffect(() => {
        if (eventKind === "training" && form.getValues("createForumChannel")) {
            form.setValue("createForumChannel", false, {
                shouldDirty: true,
                shouldTouch: true,
            })
        }
    }, [eventKind, form])

    function handleMapSelection(mapId: string) {
        setSelectedMapId(mapId)
        setSelectedMapTime("")
        setSelectedMapMode("")
        form.setValue("cap", "", {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: true,
        })
    }

    function handleMapTimeSelection(time: string) {
        setSelectedMapTime(time)
        setSelectedMapMode("")
    }

    function handleMapModeSelection(mode: string) {
        setSelectedMapMode(mode)
    }

    function applyQuickSchedule() {
        const eventStart = new Date(
            fromDateTimeLocalInTimeZone(quickSchedule.eventStart, timezone)
        )
        const registrationHours = Number(quickSchedule.registrationHours)
        const meetingMinutes = Number(quickSchedule.meetingMinutes)
        const durationMinutes = Number(quickSchedule.durationMinutes)
        if (
            !Number.isFinite(eventStart.getTime()) ||
            registrationHours < 0 ||
            meetingMinutes < 0 ||
            durationMinutes <= 0
        )
            return
        const toLocal = (value: Date) =>
            toDateTimeLocalInTimeZone(value.toISOString(), timezone)
        const meetingStart = new Date(
            eventStart.getTime() - meetingMinutes * 60 * 1000
        )
        form.setValue(
            "registrationEnd",
            toLocal(
                new Date(
                    meetingStart.getTime() - registrationHours * 60 * 60 * 1000
                )
            ),
            {
                shouldDirty: true,
                shouldValidate: true,
            }
        )
        form.setValue("meetingStart", toLocal(meetingStart), {
            shouldDirty: true,
            shouldValidate: true,
        })
        form.setValue("gameStart", toLocal(eventStart), {
            shouldDirty: true,
            shouldValidate: true,
        })
        form.setValue(
            "gameEnd",
            toLocal(
                new Date(eventStart.getTime() + durationMinutes * 60 * 1000)
            ),
            {
                shouldDirty: true,
                shouldValidate: true,
            }
        )
        toast.success(dictionary.event.quickScheduleApplied)
        setQuickScheduleOpen(false)
    }

    async function submit(values: EventInput) {
        const payload = {
            gameId: event.gameId,
            ...values,
            registrationEnd: fromDateTimeLocalInTimeZone(
                values.registrationEnd,
                timezone
            ),
            meetingStart: fromDateTimeLocalInTimeZone(
                values.meetingStart,
                timezone
            ),
            gameStart:
                values.kind === "match"
                    ? fromDateTimeLocalInTimeZone(
                          values.gameStart ?? values.meetingStart,
                          timezone
                      )
                    : fromDateTimeLocalInTimeZone(
                          values.meetingStart,
                          timezone
                      ),
            gameEnd:
                values.kind === "match"
                    ? fromDateTimeLocalInTimeZone(
                          values.gameEnd ??
                              values.gameStart ??
                              values.meetingStart,
                          timezone
                      )
                    : resolveTrainingEndTime(values, timezone),
            createForumChannel:
                values.kind === "match" ? values.createForumChannel : false,
            topicPresetId: values.topicPresetId || undefined,
            stratmapIds: values.stratmapIds,
            signupGroupIds:
                values.kind === "match"
                    ? (values.signupGroupIds ?? []).filter((groupId) =>
                          eventGroupIds.has(groupId)
                      )
                    : [],
            allowedSignupStatuses:
                values.kind === "match" &&
                (values.allowedSignupStatuses ?? []).length > 0
                    ? values.allowedSignupStatuses
                    : undefined,
            useGeneralSignup:
                values.kind === "match" ? values.useGeneralSignup : false,
            signupReminderStatuses:
                values.kind === "match"
                    ? (values.signupReminderStatuses ?? [])
                    : [],
            thumbnailUrl: values.thumbnailUrl || undefined,
            imageUrl: values.imageUrl || undefined,
            announcementChannelId: values.announcementChannelId || undefined,
            eventInfoChannelId:
                values.kind === "match"
                    ? values.eventInfoChannelId || undefined
                    : undefined,
            pingClan: values.pingMode === "clan",
            pingRoleIds: values.pingMode === "roles" ? values.pingRoleIds : [],
        }

        const response = await fetch(
            createMode
                ? `/api/servers/${serverId}/events`
                : `/api/servers/${serverId}/events/${event.id}`,
            {
                method: createMode ? "POST" : "PATCH",
                headers: {
                    "content-type": "application/json",
                },
                body: JSON.stringify(payload),
            }
        )

        const body = await response.json()
        if (!response.ok) {
            toast.error(body.error ?? dictionary.event.saveError)
            form.setError("root", {
                message: body.error ?? dictionary.event.saveError,
            })
            return
        }

        toast.success(
            createMode ? dictionary.event.created : dictionary.event.saved
        )
        startTransition(() => {
            router.push(
                `/${locale}/dashboard/servers/${serverId}/${detailBasePath}/${createMode ? body.eventId : event.id}`
            )
            router.refresh()
        })
    }

    async function resyncTopicThread() {
        setIsResyncingTopicThread(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/events/${event.id}/resync-topic-thread`,
                { method: "POST" }
            )
            const body = (await response.json().catch(() => null)) as {
                error?: string
            } | null
            if (!response.ok)
                throw new Error(body?.error ?? dictionary.common.error)
            toast.success(dictionary.event.topicThreadResyncQueued)
            router.refresh()
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : dictionary.common.error
            )
        } finally {
            setIsResyncingTopicThread(false)
        }
    }

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardHeader>
                <CardTitle className="text-2xl">
                    {createMode
                        ? dictionary.event.createTitle
                        : dictionary.event.infoTitle}
                </CardTitle>
                <p className="text-muted-foreground text-sm">
                    {createMode
                        ? dictionary.event.createDescription
                        : dictionary.event.infoDescription}
                </p>
            </CardHeader>
            <CardContent>
                <form
                    className="space-y-6"
                    onSubmit={form.handleSubmit(submit)}
                >
                    {eventKind === "match" &&
                    pingMode !== "none" &&
                    !form.watch("announcementChannelId") ? (
                        <ConfigNotice
                            title={dictionary.event.notices.announcementsTitle}
                            href={
                                canEdit
                                    ? `/${locale}/dashboard/servers/${serverId}/settings`
                                    : undefined
                            }
                            ctaLabel={
                                canEdit
                                    ? dictionary.event.notices.openClanSettings
                                    : undefined
                            }
                        >
                            {dictionary.event.notices.announcementsDescription}
                        </ConfigNotice>
                    ) : null}
                    {eventKind === "match" &&
                    createForumChannel &&
                    !discordConfig?.forumCategoryId ? (
                        <ConfigNotice
                            title={dictionary.event.notices.forumTitle}
                            href={
                                canEdit
                                    ? `/${locale}/dashboard/servers/${serverId}/settings`
                                    : undefined
                            }
                            ctaLabel={
                                canEdit
                                    ? dictionary.event.notices.openClanSettings
                                    : undefined
                            }
                        >
                            {dictionary.event.notices.forumDescription}
                        </ConfigNotice>
                    ) : null}
                    {!discordConfig?.meetingChannelId ? (
                        <ConfigNotice
                            tone="info"
                            title={
                                dictionary.event.notices.meetingAutomationTitle
                            }
                            href={
                                canEdit
                                    ? `/${locale}/dashboard/servers/${serverId}/settings`
                                    : undefined
                            }
                            ctaLabel={
                                canEdit
                                    ? dictionary.event.notices.openClanSettings
                                    : undefined
                            }
                        >
                            {
                                dictionary.event.notices
                                    .meetingAutomationDescription
                            }
                        </ConfigNotice>
                    ) : null}
                    {event.kind === "match" && event.eventResult ? (
                        <div className="border-border/60 bg-muted/20 rounded-2xl border p-4">
                            <div className="flex flex-wrap items-center gap-3">
                                <Badge
                                    variant={
                                        event.eventResult.outcome === "victory"
                                            ? "default"
                                            : "secondary"
                                    }
                                    className="rounded-full px-3"
                                >
                                    {getOutcomeLabel(
                                        event.eventResult.outcome,
                                        dictionary
                                    )}
                                </Badge>
                                <div className="text-lg font-semibold">
                                    {event.eventResult.sideA}{" "}
                                    {event.eventResult.score.sideA} -{" "}
                                    {event.eventResult.score.sideB}{" "}
                                    {event.eventResult.sideB}
                                </div>
                                <div className="text-muted-foreground text-sm">
                                    {event.eventResult.mapName ??
                                        event.eventResult.mapId}
                                </div>
                                {event.matchStatsId ? (
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="rounded-full"
                                        onClick={() =>
                                            router.push(
                                                `/${locale}/dashboard/servers/${serverId}/matches/${event.id}/match-stats`
                                            )
                                        }
                                    >
                                        {dictionary.event.openMatch}
                                    </Button>
                                ) : null}
                            </div>
                        </div>
                    ) : null}
                    <div className="grid gap-4 md:grid-cols-2">
                        <div className={"col-span-2 flex flex-row gap-4"}>
                            <div className="md:col-span-2">
                                <FieldLabel
                                    label={dictionary.event.fields.kind}
                                    required
                                />
                                {canEdit ? (
                                    <Controller
                                        control={form.control}
                                        name="kind"
                                        render={({ field }) => (
                                            <Select
                                                value={field.value}
                                                onValueChange={(value) =>
                                                    field.onChange(
                                                        value as EventInput["kind"]
                                                    )
                                                }
                                            >
                                                <SelectTrigger className="rounded-xl">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="match">
                                                        {
                                                            dictionary.sidebar
                                                                .matches
                                                        }
                                                    </SelectItem>
                                                    <SelectItem value="training">
                                                        {
                                                            dictionary.sidebar
                                                                .trainings
                                                        }
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                        )}
                                    />
                                ) : (
                                    <ReadOnlyValue
                                        value={
                                            eventKind === "training"
                                                ? dictionary.sidebar.trainings
                                                : dictionary.sidebar.matches
                                        }
                                        emptyLabel={dictionary.shared.notSet}
                                    />
                                )}
                            </div>
                            {eventKind === "match" ? (
                                <div className="w-40">
                                    <FieldLabel
                                        label={
                                            dictionary.event.fields.matchType
                                        }
                                    />
                                    {canEdit ? (
                                        <Controller
                                            control={form.control}
                                            name="matchType"
                                            render={({ field }) => (
                                                <Select
                                                    value={
                                                        field.value || "__none"
                                                    }
                                                    onValueChange={(value) =>
                                                        field.onChange(
                                                            value === "__none"
                                                                ? ""
                                                                : value
                                                        )
                                                    }
                                                >
                                                    <SelectTrigger className="w-40 rounded-xl">
                                                        <SelectValue
                                                            placeholder={
                                                                dictionary
                                                                    .shared
                                                                    .notSet
                                                            }
                                                        />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="__none">
                                                            {
                                                                dictionary
                                                                    .shared
                                                                    .notSet
                                                            }
                                                        </SelectItem>
                                                        {eventCategories.map(
                                                            (category) => (
                                                                <SelectItem
                                                                    key={
                                                                        category.id
                                                                    }
                                                                    value={
                                                                        category.id
                                                                    }
                                                                >
                                                                    <span className="inline-flex items-center gap-2">
                                                                        <EmojiValue
                                                                            value={
                                                                                category.emoji
                                                                            }
                                                                        />
                                                                        <span>
                                                                            {
                                                                                category.label
                                                                            }
                                                                        </span>
                                                                    </span>
                                                                </SelectItem>
                                                            )
                                                        )}
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                    ) : (
                                        <ReadOnlyValue
                                            value={getEventCategoryLabel(
                                                {
                                                    matchType:
                                                        eventCategoryValue,
                                                },
                                                eventCategories
                                            )}
                                            emptyLabel={
                                                dictionary.shared.notSet
                                            }
                                        />
                                    )}
                                </div>
                            ) : null}
                            <div className="w-full">
                                <FieldLabel
                                    label={dictionary.event.fields.name}
                                    required
                                />
                                {canEdit ? (
                                    <Input
                                        {...form.register("name")}
                                        className="rounded-xl"
                                    />
                                ) : (
                                    <ReadOnlyValue
                                        value={form.watch("name")}
                                        emptyLabel={dictionary.shared.notSet}
                                    />
                                )}
                                {form.formState.errors.name ? (
                                    <p className="text-destructive mt-2 text-sm">
                                        {form.formState.errors.name.message}
                                    </p>
                                ) : null}
                            </div>
                        </div>
                        {eventKind === "match" ? (
                            <div className="flex flex-row gap-4 space-y-3 md:col-span-2">
                                {canEdit ? (
                                    <HllMapSelector
                                        mapId={selectedMapId}
                                        onMapIdChange={(value) => {
                                            handleMapSelection(value)
                                            form.setValue("map", "", {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                                shouldValidate: true,
                                            })
                                        }}
                                        time={selectedMapTime}
                                        onTimeChange={(value) => {
                                            handleMapTimeSelection(value)
                                            form.setValue("map", "", {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                                shouldValidate: true,
                                            })
                                        }}
                                        mode={selectedMapMode}
                                        onModeChange={handleMapModeSelection}
                                        pointValue={form.watch("cap")}
                                        onPointValueChange={(value) =>
                                            form.setValue("cap", value, {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                                shouldValidate: true,
                                            })
                                        }
                                        sideValue={form.watch("side")}
                                        onSideValueChange={(value) =>
                                            form.setValue("side", value, {
                                                shouldDirty: true,
                                                shouldTouch: true,
                                                shouldValidate: true,
                                            })
                                        }
                                        includeVariants
                                        includeSide
                                        labels={{
                                            map: dictionary.event.fields.map,
                                            mapSearch:
                                                dictionary.event.fields.map,
                                            time: dictionary.event.fields
                                                .mapVariant,
                                            mode: dictionary.event.fields
                                                .mapMode,
                                            point: dictionary.event.fields
                                                .capMode,
                                            pointSearch:
                                                dictionary.event.fields.capMode,
                                            side: dictionary.event.fields.side,
                                            optional: dictionary.shared.notSet,
                                            noResults:
                                                dictionary.shared
                                                    .noMatchingResults,
                                        }}
                                    />
                                ) : (
                                    <ReadOnlyValue
                                        value={
                                            formatHllPresetLabel(mapValue) ??
                                            mapValue
                                        }
                                        emptyLabel={dictionary.shared.notSet}
                                    />
                                )}
                            </div>
                        ) : null}
                        {eventKind === "match" ? (
                            <>
                                {canEdit ? (
                                    <div className="border-border/60 bg-muted/20 flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3 md:col-span-2">
                                        <div className="grid gap-x-5 gap-y-1 text-sm sm:grid-cols-2">
                                            <span>
                                                <strong>
                                                    {
                                                        dictionary.event.fields
                                                            .registrationEnd
                                                    }
                                                    :
                                                </strong>{" "}
                                                {formatScheduleValue(
                                                    scheduleValues[0]
                                                )}
                                            </span>
                                            <span>
                                                <strong>
                                                    {
                                                        dictionary.event.fields
                                                            .meetingStart
                                                    }
                                                    :
                                                </strong>{" "}
                                                {formatScheduleValue(
                                                    scheduleValues[1]
                                                )}
                                            </span>
                                            <span>
                                                <strong>
                                                    {
                                                        dictionary.event.fields
                                                            .gameStart
                                                    }
                                                    :
                                                </strong>{" "}
                                                {formatScheduleValue(
                                                    scheduleValues[2]
                                                )}
                                            </span>
                                            <span>
                                                <strong>
                                                    {
                                                        dictionary.event.fields
                                                            .gameEnd
                                                    }
                                                    :
                                                </strong>{" "}
                                                {formatScheduleValue(
                                                    scheduleValues[3]
                                                )}
                                            </span>
                                        </div>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            className="rounded-xl"
                                            onClick={() => {
                                                setQuickScheduleStep(0)
                                                setQuickScheduleOpen(true)
                                            }}
                                        >
                                            {dictionary.event.editSchedule}
                                        </Button>
                                    </div>
                                ) : null}
                                {createMode && canEdit ? (
                                    <div className="border-border/60 space-y-4 rounded-2xl border p-4 md:col-span-2">
                                        <div className="flex items-center gap-3 md:flex-row">
                                            <Checkbox
                                                id="recurring-match"
                                                checked={Boolean(recurrence)}
                                                onCheckedChange={(checked) =>
                                                    form.setValue(
                                                        "recurrence",
                                                        checked
                                                            ? {
                                                                  frequency:
                                                                      "weekly",
                                                                  interval: 1,
                                                                  weekdays: [
                                                                      new Date(
                                                                          event.gameStart
                                                                      ).getDay(),
                                                                  ],
                                                              }
                                                            : undefined,
                                                        {
                                                            shouldDirty: true,
                                                            shouldValidate: true,
                                                        }
                                                    )
                                                }
                                            />
                                            <Label htmlFor="recurring-match">
                                                {
                                                    dictionary.event
                                                        .recurringMatch
                                                }
                                            </Label>
                                        </div>
                                        {recurrence ? (
                                            <div className="flex flex-col gap-3 md:flex-row">
                                                <div className={""}>
                                                    <FieldLabel
                                                        label={
                                                            dictionary.event
                                                                .recurrenceFrequency
                                                        }
                                                    />
                                                    <Controller
                                                        control={form.control}
                                                        name="recurrence.frequency"
                                                        render={({ field }) => (
                                                            <Select
                                                                value={
                                                                    field.value
                                                                }
                                                                onValueChange={
                                                                    field.onChange
                                                                }
                                                            >
                                                                <SelectTrigger className="w-full rounded-xl md:w-64">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    <SelectItem value="weekly">
                                                                        {
                                                                            dictionary
                                                                                .event
                                                                                .recurrenceWeekly
                                                                        }
                                                                    </SelectItem>
                                                                    <SelectItem value="monthly_date">
                                                                        {
                                                                            dictionary
                                                                                .event
                                                                                .recurrenceMonthlyDate
                                                                        }
                                                                    </SelectItem>
                                                                    <SelectItem value="monthly_nth_weekday">
                                                                        {
                                                                            dictionary
                                                                                .event
                                                                                .recurrenceMonthlyNthWeekday
                                                                        }
                                                                    </SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                        )}
                                                    />
                                                </div>
                                                <div
                                                    className={
                                                        "w-full md:w-auto"
                                                    }
                                                >
                                                    <FieldLabel
                                                        label={
                                                            dictionary.event
                                                                .recurrenceInterval
                                                        }
                                                    />
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max="52"
                                                        {...form.register(
                                                            "recurrence.interval",
                                                            {
                                                                valueAsNumber: true,
                                                            }
                                                        )}
                                                        className="rounded-xl"
                                                    />
                                                </div>
                                                {recurrence.frequency ===
                                                "monthly_date" ? (
                                                    <div
                                                        className={
                                                            "w-full md:w-auto"
                                                        }
                                                    >
                                                        <FieldLabel
                                                            label={
                                                                dictionary.event
                                                                    .recurrenceMonthDay
                                                            }
                                                        />
                                                        <Input
                                                            type="number"
                                                            min="1"
                                                            max="31"
                                                            {...form.register(
                                                                "recurrence.monthDay",
                                                                {
                                                                    valueAsNumber: true,
                                                                }
                                                            )}
                                                            className="rounded-xl"
                                                        />
                                                    </div>
                                                ) : null}
                                                {recurrence.frequency ===
                                                "monthly_nth_weekday" ? (
                                                    <>
                                                        <div
                                                            className={
                                                                "w-full md:w-auto"
                                                            }
                                                        >
                                                            <FieldLabel
                                                                label={
                                                                    dictionary
                                                                        .event
                                                                        .recurrenceNth
                                                                }
                                                            />
                                                            <Input
                                                                type="number"
                                                                min="1"
                                                                max="5"
                                                                {...form.register(
                                                                    "recurrence.nth",
                                                                    {
                                                                        valueAsNumber: true,
                                                                    }
                                                                )}
                                                                className="rounded-xl"
                                                            />
                                                        </div>
                                                        <div
                                                            className={
                                                                "w-full md:w-auto"
                                                            }
                                                        >
                                                            <FieldLabel
                                                                label={
                                                                    dictionary
                                                                        .event
                                                                        .recurrenceWeekday
                                                                }
                                                            />
                                                            <Select
                                                                value={String(
                                                                    recurrence.weekday ??
                                                                        0
                                                                )}
                                                                onValueChange={(
                                                                    value
                                                                ) =>
                                                                    form.setValue(
                                                                        "recurrence.weekday",
                                                                        Number(
                                                                            value
                                                                        ),
                                                                        {
                                                                            shouldDirty: true,
                                                                            shouldValidate: true,
                                                                        }
                                                                    )
                                                                }
                                                            >
                                                                <SelectTrigger className="rounded-xl">
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {Array.from(
                                                                        {
                                                                            length: 7,
                                                                        },
                                                                        (
                                                                            _,
                                                                            day
                                                                        ) => (
                                                                            <SelectItem
                                                                                key={
                                                                                    day
                                                                                }
                                                                                value={String(
                                                                                    day
                                                                                )}
                                                                            >
                                                                                {new Intl.DateTimeFormat(
                                                                                    locale ===
                                                                                        "cs"
                                                                                        ? "cs-CZ"
                                                                                        : locale ===
                                                                                            "de"
                                                                                          ? "de-DE"
                                                                                          : "en-GB",
                                                                                    {
                                                                                        weekday:
                                                                                            "long",
                                                                                    }
                                                                                ).format(
                                                                                    new Date(
                                                                                        2024,
                                                                                        0,
                                                                                        7 +
                                                                                            day
                                                                                    )
                                                                                )}
                                                                            </SelectItem>
                                                                        )
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </>
                                                ) : null}
                                                {recurrence.frequency ===
                                                "weekly" ? (
                                                    <div className="md:col-span-3">
                                                        <FieldLabel
                                                            label={
                                                                dictionary.event
                                                                    .recurrenceWeekdays
                                                            }
                                                        />
                                                        <div className="flex flex-wrap gap-3">
                                                            {Array.from(
                                                                { length: 7 },
                                                                (_, day) => (
                                                                    <label
                                                                        key={
                                                                            day
                                                                        }
                                                                        className="flex items-center gap-2 p-2 text-sm"
                                                                    >
                                                                        <Checkbox
                                                                            checked={(
                                                                                recurrence.weekdays ??
                                                                                []
                                                                            ).includes(
                                                                                day
                                                                            )}
                                                                            onCheckedChange={(
                                                                                checked
                                                                            ) =>
                                                                                form.setValue(
                                                                                    "recurrence.weekdays",
                                                                                    checked
                                                                                        ? [
                                                                                              ...(recurrence.weekdays ??
                                                                                                  []),
                                                                                              day,
                                                                                          ]
                                                                                        : (
                                                                                              recurrence.weekdays ??
                                                                                              []
                                                                                          ).filter(
                                                                                              (
                                                                                                  value
                                                                                              ) =>
                                                                                                  value !==
                                                                                                  day
                                                                                          ),
                                                                                    {
                                                                                        shouldDirty: true,
                                                                                        shouldValidate: true,
                                                                                    }
                                                                                )
                                                                            }
                                                                        />
                                                                        {new Intl.DateTimeFormat(
                                                                            locale ===
                                                                                "cs"
                                                                                ? "cs-CZ"
                                                                                : locale ===
                                                                                    "de"
                                                                                  ? "de-DE"
                                                                                  : "en-GB",
                                                                            {
                                                                                weekday:
                                                                                    "short",
                                                                            }
                                                                        ).format(
                                                                            new Date(
                                                                                2024,
                                                                                0,
                                                                                7 +
                                                                                    day
                                                                            )
                                                                        )}
                                                                    </label>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                ) : null}
                                            </div>
                                        ) : null}
                                        <p className="text-muted-foreground text-sm">
                                            {dictionary.event.recurrenceHelp}
                                        </p>
                                    </div>
                                ) : null}
                                <Dialog
                                    open={quickScheduleOpen}
                                    onOpenChange={setQuickScheduleOpen}
                                >
                                    <DialogContent className="max-w-md rounded-2xl">
                                        <DialogHeader>
                                            <DialogTitle>
                                                {
                                                    dictionary.event
                                                        .quickScheduleTitle
                                                }
                                            </DialogTitle>
                                            <DialogDescription>
                                                {dictionary.event.quickScheduleStepLabel.replace(
                                                    "{step}",
                                                    String(
                                                        quickScheduleStep + 1
                                                    )
                                                )}
                                            </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-3">
                                            <FieldLabel
                                                label={
                                                    [
                                                        dictionary.event
                                                            .quickEventStart,
                                                        dictionary.event
                                                            .meetingMinutesBefore,
                                                        dictionary.event
                                                            .registrationHoursBefore,
                                                        dictionary.event
                                                            .durationMinutes,
                                                    ][quickScheduleStep]
                                                }
                                                required={
                                                    quickScheduleStep === 0
                                                }
                                            />
                                            {quickScheduleStep === 0 ? (
                                                <Input
                                                    type="datetime-local"
                                                    value={
                                                        quickSchedule.eventStart
                                                    }
                                                    onChange={(event) =>
                                                        setQuickSchedule(
                                                            (current) => ({
                                                                ...current,
                                                                eventStart:
                                                                    event.target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                />
                                            ) : null}
                                            {quickScheduleStep === 1 ? (
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={
                                                        quickSchedule.meetingMinutes
                                                    }
                                                    onChange={(event) =>
                                                        setQuickSchedule(
                                                            (current) => ({
                                                                ...current,
                                                                meetingMinutes:
                                                                    event.target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                />
                                            ) : null}
                                            {quickScheduleStep === 2 ? (
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={
                                                        quickSchedule.registrationHours
                                                    }
                                                    onChange={(event) =>
                                                        setQuickSchedule(
                                                            (current) => ({
                                                                ...current,
                                                                registrationHours:
                                                                    event.target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                />
                                            ) : null}
                                            {quickScheduleStep === 3 ? (
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={
                                                        quickSchedule.durationMinutes
                                                    }
                                                    onChange={(event) =>
                                                        setQuickSchedule(
                                                            (current) => ({
                                                                ...current,
                                                                durationMinutes:
                                                                    event.target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                />
                                            ) : null}
                                        </div>
                                        <DialogFooter>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                disabled={
                                                    quickScheduleStep === 0
                                                }
                                                onClick={() =>
                                                    setQuickScheduleStep(
                                                        (step) => step - 1
                                                    )
                                                }
                                            >
                                                {dictionary.event.wizardBack}
                                            </Button>
                                            {quickScheduleStep < 3 ? (
                                                <Button
                                                    type="button"
                                                    onClick={() =>
                                                        setQuickScheduleStep(
                                                            (step) => step + 1
                                                        )
                                                    }
                                                >
                                                    {
                                                        dictionary.event
                                                            .wizardNext
                                                    }
                                                </Button>
                                            ) : (
                                                <Button
                                                    type="button"
                                                    onClick={applyQuickSchedule}
                                                >
                                                    {
                                                        dictionary.event
                                                            .applyQuickSchedule
                                                    }
                                                </Button>
                                            )}
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                                {canEdit ? (
                                    <div className="border-border/60 bg-muted/20 hidden space-y-3 rounded-xl border p-4 md:col-span-2">
                                        <div>
                                            <FieldLabel
                                                label={
                                                    dictionary.event
                                                        .quickScheduleTitle
                                                }
                                            />
                                            <p className="text-muted-foreground text-sm">
                                                {
                                                    dictionary.event
                                                        .quickScheduleDescription
                                                }
                                            </p>
                                        </div>
                                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                                            <div>
                                                <FieldLabel
                                                    label={
                                                        dictionary.event
                                                            .quickEventStart
                                                    }
                                                    required
                                                />
                                                <Input
                                                    type="datetime-local"
                                                    value={
                                                        quickSchedule.eventStart
                                                    }
                                                    onChange={(event) =>
                                                        setQuickSchedule(
                                                            (current) => ({
                                                                ...current,
                                                                eventStart:
                                                                    event.target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel
                                                    label={
                                                        dictionary.event
                                                            .registrationHoursBefore
                                                    }
                                                />
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={
                                                        quickSchedule.registrationHours
                                                    }
                                                    onChange={(event) =>
                                                        setQuickSchedule(
                                                            (current) => ({
                                                                ...current,
                                                                registrationHours:
                                                                    event.target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel
                                                    label={
                                                        dictionary.event
                                                            .meetingMinutesBefore
                                                    }
                                                />
                                                <Input
                                                    type="number"
                                                    min="0"
                                                    value={
                                                        quickSchedule.meetingMinutes
                                                    }
                                                    onChange={(event) =>
                                                        setQuickSchedule(
                                                            (current) => ({
                                                                ...current,
                                                                meetingMinutes:
                                                                    event.target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                />
                                            </div>
                                            <div>
                                                <FieldLabel
                                                    label={
                                                        dictionary.event
                                                            .durationMinutes
                                                    }
                                                />
                                                <Input
                                                    type="number"
                                                    min="1"
                                                    step="1"
                                                    value={
                                                        quickSchedule.durationMinutes
                                                    }
                                                    onChange={(event) =>
                                                        setQuickSchedule(
                                                            (current) => ({
                                                                ...current,
                                                                durationMinutes:
                                                                    event.target
                                                                        .value,
                                                            })
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            <span className="text-muted-foreground text-sm">
                                                {
                                                    dictionary.event
                                                        .registrationHoursBefore
                                                }{" "}
                                                ·{" "}
                                                {
                                                    dictionary.event
                                                        .meetingMinutesBefore
                                                }{" "}
                                                ·{" "}
                                                {dictionary.event.durationHours}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="rounded-xl"
                                                onClick={applyQuickSchedule}
                                            >
                                                {
                                                    dictionary.event
                                                        .applyQuickSchedule
                                                }
                                            </Button>
                                        </div>
                                    </div>
                                ) : null}
                            </>
                        ) : null}
                        <div className="md:col-span-2">
                            <div className="border-border/60 bg-muted/20 text-muted-foreground rounded-xl border px-4 py-3 text-sm">
                                {dictionary.serverSettings.timezone}:{" "}
                                {supportedTimezones.includes(
                                    timezone as (typeof supportedTimezones)[number]
                                )
                                    ? timezone
                                    : "UTC"}
                            </div>
                        </div>
                        <div className={"col-span-2 flex flex-row gap-4"}>
                            <div className="w-1/2">
                                {canEdit ? (
                                    <Controller
                                        control={form.control}
                                        name="thumbnailUrl"
                                        render={({ field }) => (
                                            <AvatarPicker
                                                value={field.value || ""}
                                                onChange={field.onChange}
                                                fallback={
                                                    eventName
                                                        .slice(0, 2)
                                                        .toUpperCase() || "EV"
                                                }
                                                label={
                                                    dictionary.event.fields
                                                        .thumbnail
                                                }
                                                buttonLabel={
                                                    dictionary.common.upload
                                                }
                                                disabled={!canEdit || isPending}
                                                className="border-border/60 rounded-2xl border p-4"
                                            />
                                        )}
                                    />
                                ) : (
                                    <ReadOnlyValue
                                        value={form.watch("thumbnailUrl")}
                                        emptyLabel={dictionary.shared.notSet}
                                    />
                                )}
                            </div>
                            {eventKind === "match" ? (
                                <div className="w-1/2">
                                    {canEdit ? (
                                        <Controller
                                            control={form.control}
                                            name="imageUrl"
                                            render={({ field }) => (
                                                <AvatarPicker
                                                    value={field.value || ""}
                                                    onChange={field.onChange}
                                                    fallback={
                                                        eventName
                                                            .slice(0, 2)
                                                            .toUpperCase() ||
                                                        "EV"
                                                    }
                                                    label={
                                                        dictionary.event.fields
                                                            .image
                                                    }
                                                    buttonLabel={
                                                        dictionary.common.upload
                                                    }
                                                    disabled={
                                                        !canEdit || isPending
                                                    }
                                                    className="border-border/60 rounded-2xl border p-4"
                                                />
                                            )}
                                        />
                                    ) : (
                                        <ReadOnlyValue
                                            value={form.watch("imageUrl")}
                                            emptyLabel={
                                                dictionary.shared.notSet
                                            }
                                        />
                                    )}
                                </div>
                            ) : null}
                        </div>
                        <div className="md:col-span-2">
                            <FieldLabel
                                label={dictionary.event.fields.description}
                            />
                            {canEdit ? (
                                <Controller
                                    control={form.control}
                                    name="description"
                                    render={({ field }) => (
                                        <DiscordMarkdownTextarea
                                            value={field.value ?? ""}
                                            onChange={field.onChange}
                                            className="min-h-24 rounded-xl"
                                            rows={6}
                                        />
                                    )}
                                />
                            ) : (
                                <DiscordMarkdownText
                                    markdown={form.watch("description")}
                                    emptyLabel={dictionary.shared.notSet}
                                    className="min-h-24 rounded-xl"
                                />
                            )}
                        </div>
                        {eventKind === "match" ? (
                            <div className="md:col-span-2 md:grid md:grid-cols-3 md:gap-4">
                                <div>
                                    <FieldLabel
                                        label={
                                            dictionary.event.fields
                                                .meetingChannelId
                                        }
                                    />
                                    {canEdit ? (
                                        <Controller
                                            control={form.control}
                                            name="meetingChannelId"
                                            render={({ field }) => (
                                                <DiscordEntitySelect
                                                    value={
                                                        field.value || undefined
                                                    }
                                                    onChange={(value) =>
                                                        field.onChange(
                                                            value ?? ""
                                                        )
                                                    }
                                                    options={meetingChannels}
                                                    placeholder={
                                                        dictionary.event.fields
                                                            .meetingChannelId
                                                    }
                                                    noneLabel={
                                                        dictionary.shared.notSet
                                                    }
                                                />
                                            )}
                                        />
                                    ) : (
                                        <ReadOnlyValue
                                            value={(() => {
                                                const meetingChannelId =
                                                    form.watch(
                                                        "meetingChannelId"
                                                    )
                                                return meetingChannelId
                                                    ? (channelNameById.get(
                                                          meetingChannelId
                                                      ) ?? meetingChannelId)
                                                    : undefined
                                            })()}
                                            emptyLabel={
                                                dictionary.shared.notSet
                                            }
                                        />
                                    )}
                                </div>
                                <div>
                                    <FieldLabel
                                        label={dictionary.event.fields.server}
                                    />
                                    {canEdit ? (
                                        <Input
                                            {...form.register("server")}
                                            autoComplete="one-time-code"
                                            className="rounded-xl"
                                        />
                                    ) : (
                                        <ReadOnlyValue
                                            value={form.watch("server")}
                                            emptyLabel={
                                                dictionary.shared.notSet
                                            }
                                        />
                                    )}
                                </div>
                                <div>
                                    <FieldLabel
                                        label={
                                            dictionary.event.fields
                                                .serverPassword
                                        }
                                    />
                                    {canEdit ? (
                                        <Input
                                            {...form.register("serverPassword")}
                                            autoComplete={"new-password"}
                                            className="rounded-xl"
                                        />
                                    ) : (
                                        <ReadOnlyValue
                                            value={form.watch("serverPassword")}
                                            emptyLabel={
                                                dictionary.shared.notSet
                                            }
                                        />
                                    )}
                                </div>
                            </div>
                        ) : null}
                        <div className="border-border/60 rounded-xl border p-4 md:col-span-2">
                            {canEdit && createMode ? (
                                <div className="grid gap-4 md:grid-cols-2">
                                    <div>
                                        <FieldLabel
                                            label={
                                                dictionary.event.fields
                                                    .announcementChannelId
                                            }
                                            required
                                        />
                                        <Controller
                                            control={form.control}
                                            name="announcementChannelId"
                                            render={({ field }) => (
                                                <DiscordEntitySelect
                                                    value={
                                                        field.value || undefined
                                                    }
                                                    onChange={(value) =>
                                                        field.onChange(
                                                            value ?? ""
                                                        )
                                                    }
                                                    options={
                                                        announcementChannels
                                                    }
                                                    placeholder={
                                                        dictionary.event.fields
                                                            .announcementChannelId
                                                    }
                                                    noneLabel={
                                                        dictionary.shared.notSet
                                                    }
                                                />
                                            )}
                                        />
                                    </div>
                                    {eventKind === "match" ? (
                                        <div>
                                            <FieldLabel
                                                label={
                                                    dictionary.event.fields
                                                        .eventInfoChannelId
                                                }
                                            />
                                            <Controller
                                                control={form.control}
                                                name="eventInfoChannelId"
                                                render={({ field }) => (
                                                    <DiscordEntitySelect
                                                        value={
                                                            field.value ||
                                                            undefined
                                                        }
                                                        onChange={(value) =>
                                                            field.onChange(
                                                                value ?? ""
                                                            )
                                                        }
                                                        options={
                                                            announcementChannels
                                                        }
                                                        placeholder={
                                                            dictionary.event
                                                                .fields
                                                                .eventInfoChannelId
                                                        }
                                                        noneLabel={
                                                            dictionary.shared
                                                                .notSet
                                                        }
                                                    />
                                                )}
                                            />
                                        </div>
                                    ) : null}
                                </div>
                            ) : (
                                <ReadOnlyList
                                    values={[
                                        form.watch("announcementChannelId"),
                                        eventKind === "match"
                                            ? form.watch("eventInfoChannelId")
                                            : undefined,
                                    ]
                                        .filter((value): value is string =>
                                            Boolean(value)
                                        )
                                        .map(
                                            (id) =>
                                                channelNameById.get(id) ?? id
                                        )}
                                    emptyLabel={dictionary.shared.notSet}
                                />
                            )}
                            <p className="text-muted-foreground mt-2 text-sm">
                                {createMode
                                    ? dictionary.event.channelRoutingSharedHelp
                                    : dictionary.event.channelRoutingLockedHelp}
                            </p>
                        </div>
                        {eventKind === "training" ? (
                            <>
                                <div>
                                    <FieldLabel
                                        label={
                                            dictionary.event.fields
                                                .registrationEnd
                                        }
                                        required
                                    />
                                    {canEdit ? (
                                        <Input
                                            type="datetime-local"
                                            {...form.register(
                                                "registrationEnd"
                                            )}
                                            className="rounded-xl"
                                        />
                                    ) : (
                                        <ReadOnlyValue
                                            value={form.watch(
                                                "registrationEnd"
                                            )}
                                            emptyLabel={
                                                dictionary.shared.notSet
                                            }
                                        />
                                    )}
                                    {form.formState.errors.registrationEnd ? (
                                        <p className="text-destructive mt-2 text-sm">
                                            {
                                                form.formState.errors
                                                    .registrationEnd.message
                                            }
                                        </p>
                                    ) : null}
                                </div>
                                <div>
                                    <FieldLabel
                                        label={
                                            dictionary.event.fields.meetingStart
                                        }
                                        required
                                    />
                                    {canEdit ? (
                                        <Input
                                            type="datetime-local"
                                            {...form.register("meetingStart")}
                                            className="rounded-xl"
                                        />
                                    ) : (
                                        <ReadOnlyValue
                                            value={form.watch("meetingStart")}
                                            emptyLabel={
                                                dictionary.shared.notSet
                                            }
                                        />
                                    )}
                                    {form.formState.errors.meetingStart ? (
                                        <p className="text-destructive mt-2 text-sm">
                                            {
                                                form.formState.errors
                                                    .meetingStart.message
                                            }
                                        </p>
                                    ) : null}
                                </div>
                            </>
                        ) : null}
                        {eventKind === "match" ? (
                            <div className="md:col-span-2">
                                <FieldLabel
                                    label={dictionary.event.topicPreset}
                                />
                                {canEdit ? (
                                    <Controller
                                        control={form.control}
                                        name="topicPresetId"
                                        render={({ field }) => (
                                            <TopicPresetSelect
                                                value={field.value}
                                                onChange={field.onChange}
                                                options={topicPresetOptions}
                                                dictionary={dictionary}
                                            />
                                        )}
                                    />
                                ) : (
                                    <ReadOnlyValue
                                        value={
                                            topicPresets.find(
                                                (preset) =>
                                                    preset.id ===
                                                    form.watch("topicPresetId")
                                            )?.name
                                        }
                                        emptyLabel={dictionary.event.noPreset}
                                    />
                                )}
                            </div>
                        ) : null}
                        <div className="md:col-span-2">
                            <FieldLabel label={dictionary.event.fields.notes} />
                            {canEdit ? (
                                <Controller
                                    control={form.control}
                                    name="notes"
                                    render={({ field }) => (
                                        <DiscordMarkdownTextarea
                                            value={field.value ?? ""}
                                            onChange={field.onChange}
                                            className="min-h-28 rounded-xl"
                                            rows={8}
                                        />
                                    )}
                                />
                            ) : (
                                <DiscordMarkdownText
                                    markdown={form.watch("notes")}
                                    emptyLabel={dictionary.shared.notSet}
                                    className="min-h-28 rounded-xl"
                                />
                            )}
                        </div>
                        {eventKind === "match" ? (
                            <div className="md:col-span-2">
                                <FieldLabel
                                    label={dictionary.event.fields.stratmaps}
                                />
                                {canEdit ? (
                                    <Controller
                                        control={form.control}
                                        name="stratmapIds"
                                        render={({ field }) => (
                                            <StratmapMultiSelect
                                                value={field.value ?? []}
                                                onChange={field.onChange}
                                                stratmaps={stratmaps}
                                                dictionary={dictionary}
                                            />
                                        )}
                                    />
                                ) : (
                                    <ReadOnlyList
                                        values={(
                                            form.watch("stratmapIds") ?? []
                                        ).map(
                                            (id) =>
                                                stratmaps.find(
                                                    (item) => item.id === id
                                                )?.title ?? id
                                        )}
                                        emptyLabel={dictionary.shared.notSet}
                                    />
                                )}
                            </div>
                        ) : null}
                        {eventKind === "match" ? (
                            <>
                                <div className="md:col-span-2">
                                    <FieldLabel
                                        label={
                                            dictionary.event.fields
                                                .allowedSignupStatuses
                                        }
                                    />
                                    {canEdit ? (
                                        <Controller
                                            control={form.control}
                                            name="allowedSignupStatuses"
                                            render={({ field }) => {
                                                const selectedStatuses =
                                                    new Set(field.value ?? [])
                                                const statusOptions = [
                                                    "recruit",
                                                    "member",
                                                    "reserve_member",
                                                    "mercenary",
                                                ] as const

                                                return (
                                                    <div className="border-border/60 space-y-3 rounded-xl border p-4">
                                                        <p className="text-muted-foreground text-sm">
                                                            {
                                                                dictionary.event
                                                                    .allowedSignupStatusesDescription
                                                            }
                                                        </p>
                                                        <div className="grid gap-2 md:grid-cols-2">
                                                            {statusOptions.map(
                                                                (status) => (
                                                                    <label
                                                                        key={
                                                                            status
                                                                        }
                                                                        className="border-border/60 flex items-center gap-3 rounded-xl border px-3 py-2"
                                                                    >
                                                                        <Checkbox
                                                                            checked={selectedStatuses.has(
                                                                                status
                                                                            )}
                                                                            onCheckedChange={(
                                                                                checked
                                                                            ) => {
                                                                                const nextValues =
                                                                                    checked
                                                                                        ? [
                                                                                              ...selectedStatuses,
                                                                                              status,
                                                                                          ]
                                                                                        : [
                                                                                              ...selectedStatuses,
                                                                                          ].filter(
                                                                                              (
                                                                                                  value
                                                                                              ) =>
                                                                                                  value !==
                                                                                                  status
                                                                                          )
                                                                                field.onChange(
                                                                                    nextValues
                                                                                )
                                                                            }}
                                                                        />
                                                                        <span className="text-sm">
                                                                            {getAllowedSignupStatusLabel(
                                                                                status,
                                                                                dictionary
                                                                            )}
                                                                        </span>
                                                                    </label>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            }}
                                        />
                                    ) : (
                                        <ReadOnlyList
                                            values={
                                                (
                                                    form.watch(
                                                        "allowedSignupStatuses"
                                                    ) ?? []
                                                ).length
                                                    ? (
                                                          form.watch(
                                                              "allowedSignupStatuses"
                                                          ) ?? []
                                                      ).map((status) =>
                                                          getAllowedSignupStatusLabel(
                                                              status,
                                                              dictionary
                                                          )
                                                      )
                                                    : [
                                                          dictionary.event
                                                              .allowedSignupStatusesAll,
                                                      ]
                                            }
                                            emptyLabel={
                                                dictionary.event
                                                    .allowedSignupStatusesAll
                                            }
                                        />
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    {canEdit ? (
                                        <div className="border-border/60 flex items-center justify-between rounded-xl border px-4 py-3">
                                            <div>
                                                <FieldLabel
                                                    label={
                                                        dictionary.event.fields
                                                            .useGeneralSignup
                                                    }
                                                />
                                                <p className="text-muted-foreground text-sm">
                                                    {
                                                        dictionary.event
                                                            .generalSignupDescription
                                                    }
                                                </p>
                                            </div>
                                            <Controller
                                                control={form.control}
                                                name="useGeneralSignup"
                                                render={({ field }) => (
                                                    <Switch
                                                        checked={field.value}
                                                        onCheckedChange={
                                                            field.onChange
                                                        }
                                                    />
                                                )}
                                            />
                                        </div>
                                    ) : (
                                        <ReadOnlyValue
                                            value={
                                                form.watch("useGeneralSignup")
                                                    ? dictionary.tables.enabled
                                                    : dictionary.tables.disabled
                                            }
                                            emptyLabel={
                                                dictionary.shared.notSet
                                            }
                                        />
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <FieldLabel
                                        label={
                                            dictionary.event.fields
                                                .signupReminderStatuses
                                        }
                                    />
                                    {canEdit ? (
                                        <Controller
                                            control={form.control}
                                            name="signupReminderStatuses"
                                            render={({ field }) => {
                                                const selectedStatuses =
                                                    new Set(field.value ?? [])
                                                const statusOptions = [
                                                    "member",
                                                    "recruit",
                                                    "reserve_member",
                                                ] as const
                                                return (
                                                    <div className="border-border/60 space-y-3 rounded-xl border p-4">
                                                        <p className="text-muted-foreground text-sm">
                                                            {
                                                                dictionary.event
                                                                    .signupReminderStatusesDescription
                                                            }
                                                        </p>
                                                        <div className="grid gap-2 md:grid-cols-3">
                                                            {statusOptions.map(
                                                                (status) => (
                                                                    <label
                                                                        key={
                                                                            status
                                                                        }
                                                                        className="border-border/60 flex items-center gap-3 rounded-xl border px-3 py-2"
                                                                    >
                                                                        <Checkbox
                                                                            checked={selectedStatuses.has(
                                                                                status
                                                                            )}
                                                                            onCheckedChange={(
                                                                                checked
                                                                            ) =>
                                                                                field.onChange(
                                                                                    checked
                                                                                        ? [
                                                                                              ...selectedStatuses,
                                                                                              status,
                                                                                          ]
                                                                                        : [
                                                                                              ...selectedStatuses,
                                                                                          ].filter(
                                                                                              (
                                                                                                  value
                                                                                              ) =>
                                                                                                  value !==
                                                                                                  status
                                                                                          )
                                                                                )
                                                                            }
                                                                        />
                                                                        <span className="text-sm">
                                                                            {getAllowedSignupStatusLabel(
                                                                                status,
                                                                                dictionary
                                                                            )}
                                                                        </span>
                                                                    </label>
                                                                )
                                                            )}
                                                        </div>
                                                    </div>
                                                )
                                            }}
                                        />
                                    ) : (
                                        <ReadOnlyList
                                            values={(
                                                form.watch(
                                                    "signupReminderStatuses"
                                                ) ?? []
                                            ).map((status) =>
                                                getAllowedSignupStatusLabel(
                                                    status,
                                                    dictionary
                                                )
                                            )}
                                            emptyLabel={
                                                dictionary.event
                                                    .signupReminderDisabled
                                            }
                                        />
                                    )}
                                </div>
                            </>
                        ) : null}
                        {eventKind === "match" ? (
                            <div className="md:col-span-2">
                                <FieldLabel
                                    label={
                                        dictionary.event.fields.signupGroupIds
                                    }
                                />
                                {canEdit ? (
                                    <Controller
                                        control={form.control}
                                        name="signupGroupIds"
                                        render={({ field }) => {
                                            const selectedIds = new Set(
                                                field.value ?? []
                                            )

                                            return (
                                                <div className="border-border/60 space-y-3 rounded-xl border p-4">
                                                    <p className="text-muted-foreground text-sm">
                                                        {
                                                            dictionary.event
                                                                .signupGroupsDescription
                                                        }
                                                    </p>
                                                    <div className="grid gap-2 md:grid-cols-2">
                                                        {eventGroups.map(
                                                            (group) => (
                                                                <label
                                                                    key={
                                                                        group.id
                                                                    }
                                                                    className="border-border/60 flex items-center gap-3 rounded-xl border px-3 py-2"
                                                                >
                                                                    <Checkbox
                                                                        checked={selectedIds.has(
                                                                            group.id
                                                                        )}
                                                                        onCheckedChange={(
                                                                            checked
                                                                        ) => {
                                                                            const nextValues =
                                                                                checked
                                                                                    ? [
                                                                                          ...selectedIds,
                                                                                          group.id,
                                                                                      ]
                                                                                    : [
                                                                                          ...selectedIds,
                                                                                      ].filter(
                                                                                          (
                                                                                              groupId
                                                                                          ) =>
                                                                                              groupId !==
                                                                                              group.id
                                                                                      )
                                                                            field.onChange(
                                                                                nextValues
                                                                            )
                                                                        }}
                                                                    />
                                                                    <span
                                                                        className="border-border/60 size-3 rounded-full border"
                                                                        style={{
                                                                            backgroundColor:
                                                                                group.color,
                                                                        }}
                                                                    />
                                                                    <span className="text-sm">
                                                                        {
                                                                            group.name
                                                                        }
                                                                    </span>
                                                                </label>
                                                            )
                                                        )}
                                                    </div>
                                                    {!eventGroups.length ? (
                                                        <div className="text-muted-foreground text-sm">
                                                            {
                                                                dictionary
                                                                    .shared
                                                                    .nothingCreatedYet
                                                            }
                                                        </div>
                                                    ) : null}
                                                </div>
                                            )
                                        }}
                                    />
                                ) : (
                                    <ReadOnlyList
                                        values={(
                                            form.watch("signupGroupIds") ?? []
                                        ).map(
                                            (id) =>
                                                eventGroups.find(
                                                    (group) => group.id === id
                                                )?.name ?? id
                                        )}
                                        emptyLabel={dictionary.shared.notSet}
                                    />
                                )}
                            </div>
                        ) : null}
                        {eventKind === "match" ? (
                            <div className="md:col-span-2">
                                {canEdit ? (
                                    <div className="border-border/60 flex items-center justify-between rounded-xl border px-4 py-3">
                                        <div>
                                            <FieldLabel
                                                label={
                                                    dictionary.event.fields
                                                        .createForumChannel
                                                }
                                            />
                                            <p className="text-muted-foreground text-sm">
                                                {
                                                    dictionary.event
                                                        .createForumChannelDescription
                                                }
                                            </p>
                                        </div>
                                        <Controller
                                            control={form.control}
                                            name="createForumChannel"
                                            render={({ field }) => (
                                                <Switch
                                                    checked={field.value}
                                                    onCheckedChange={
                                                        field.onChange
                                                    }
                                                />
                                            )}
                                        />
                                    </div>
                                ) : (
                                    <ReadOnlyValue
                                        value={
                                            form.watch("createForumChannel")
                                                ? dictionary.tables.enabled
                                                : dictionary.tables.disabled
                                        }
                                        emptyLabel={dictionary.shared.notSet}
                                    />
                                )}
                            </div>
                        ) : null}
                        <div className="md:col-span-2">
                            <FieldLabel
                                label={dictionary.event.fields.requiredRoleIds}
                            />
                            {canEdit ? (
                                <Controller
                                    control={form.control}
                                    name="requiredRoleIds"
                                    render={({ field }) => (
                                        <DiscordMultiEntitySelect
                                            value={field.value ?? []}
                                            onChange={field.onChange}
                                            options={metadata?.roles ?? []}
                                            placeholder={
                                                dictionary.event.fields
                                                    .requiredRoleIds
                                            }
                                        />
                                    )}
                                />
                            ) : (
                                <ReadOnlyList
                                    values={(
                                        form.watch("requiredRoleIds") ?? []
                                    ).map((id) => roleNameById.get(id) ?? id)}
                                    emptyLabel={dictionary.shared.notSet}
                                />
                            )}
                        </div>
                        <div className="md:col-span-2">
                            <FieldLabel
                                label={dictionary.event.fields.rewardRoleIds}
                            />
                            {canEdit ? (
                                <Controller
                                    control={form.control}
                                    name="rewardRoleIds"
                                    render={({ field }) => (
                                        <DiscordMultiEntitySelect
                                            value={field.value ?? []}
                                            onChange={field.onChange}
                                            options={metadata?.roles ?? []}
                                            placeholder={
                                                dictionary.event.fields
                                                    .rewardRoleIds
                                            }
                                        />
                                    )}
                                />
                            ) : (
                                <ReadOnlyList
                                    values={(
                                        form.watch("rewardRoleIds") ?? []
                                    ).map((id) => roleNameById.get(id) ?? id)}
                                    emptyLabel={dictionary.shared.notSet}
                                />
                            )}
                        </div>
                        {eventKind === "match" ? (
                            <div className="md:col-span-2">
                                {canEdit ? (
                                    <div className="border-border/60 space-y-3 rounded-xl border p-4">
                                        <FieldLabel
                                            label={
                                                dictionary.event.fields.pingMode
                                            }
                                        />
                                        <Controller
                                            control={form.control}
                                            name="pingMode"
                                            render={({ field }) => (
                                                <Select
                                                    value={field.value}
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                >
                                                    <SelectTrigger className="rounded-xl">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">
                                                            {
                                                                dictionary.event
                                                                    .pingNone
                                                            }
                                                        </SelectItem>
                                                        <SelectItem value="clan">
                                                            {
                                                                dictionary.event
                                                                    .pingClanOption
                                                            }
                                                        </SelectItem>
                                                        <SelectItem value="roles">
                                                            {
                                                                dictionary.event
                                                                    .pingRolesOption
                                                            }
                                                        </SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            )}
                                        />
                                        {pingMode === "roles" ? (
                                            <Controller
                                                control={form.control}
                                                name="pingRoleIds"
                                                render={({ field }) => (
                                                    <DiscordMultiEntitySelect
                                                        value={
                                                            field.value ?? []
                                                        }
                                                        onChange={
                                                            field.onChange
                                                        }
                                                        options={
                                                            metadata?.roles ??
                                                            []
                                                        }
                                                        placeholder={
                                                            dictionary.event
                                                                .fields
                                                                .pingRoleIds
                                                        }
                                                    />
                                                )}
                                            />
                                        ) : null}
                                    </div>
                                ) : (
                                    <ReadOnlyValue
                                        value={
                                            pingMode === "clan"
                                                ? dictionary.event
                                                      .pingClanOption
                                                : pingMode === "roles"
                                                  ? (
                                                        form.watch(
                                                            "pingRoleIds"
                                                        ) ?? []
                                                    )
                                                        .map(
                                                            (id) =>
                                                                roleNameById.get(
                                                                    id
                                                                ) ?? id
                                                        )
                                                        .join(", ")
                                                  : dictionary.event.pingNone
                                        }
                                        emptyLabel={dictionary.shared.notSet}
                                    />
                                )}
                            </div>
                        ) : null}
                    </div>
                    {form.formState.errors.root ? (
                        <p className="text-destructive text-sm">
                            {form.formState.errors.root.message}
                        </p>
                    ) : null}
                    {canEdit ? (
                        <div className="flex flex-wrap gap-3">
                            <Button
                                className="rounded-xl"
                                type="submit"
                                disabled={
                                    !canEdit ||
                                    isPending ||
                                    form.formState.isSubmitting
                                }
                            >
                                {dictionary.common.save}
                            </Button>
                            {!createMode &&
                            event.kind === "match" &&
                            event.status !== "concluded" &&
                            event.createForumChannel &&
                            event.topicPresetId ? (
                                <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-xl"
                                    onClick={() => void resyncTopicThread()}
                                    disabled={isResyncingTopicThread}
                                >
                                    {isResyncingTopicThread ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="size-4" />
                                    )}
                                    {dictionary.event.resyncTopicThread}
                                </Button>
                            ) : null}
                        </div>
                    ) : null}
                </form>
            </CardContent>
        </Card>
    )
}
