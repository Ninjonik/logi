"use client"

import {
    Archive,
    Bell,
    BellRing,
    Bug,
    CalendarCheck,
    CalendarDays,
    CircleCheck,
    ClipboardList,
    Clock,
    Flag,
    GraduationCap,
    ListChecks,
    Medal,
    MessageCircle,
    MessagesSquare,
    Megaphone,
    MousePointerClick,
    Plus,
    Radio,
    Shield,
    SlidersHorizontal,
    SquareTerminal,
    Ticket,
    Trophy,
    UserCheck,
    UserPlus,
    Users,
    Volume2,
    BarChart3,
    ChevronRight,
    Info,
    Layers,
} from "lucide-react"
import { useCallback, useEffect, useId, useState, useTransition } from "react"
import type { LucideIcon } from "lucide-react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import Link from "next/link"

import {
    normalizeAccentColor,
    normalizeMessageStyle,
    type MessageIconDensity,
} from "@/domain/discord-messages/message-style"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    resolveMessageSettings,
    type MessageSettings,
} from "@/domain/discord-messages/notification-settings"
import {
    ROSTER_MESSAGE_VARIANTS,
    type RosterMessageVariant,
} from "@/domain/discord-messages/roster-message"
import {
    channelOptions,
    SettingsChannelPicker,
} from "@/components/app/settings/settings-channel-picker"
import {
    clearableId,
    saveDiscordSettings,
} from "@/components/app/settings/save-discord-settings"
import type { SettingsPreviewKind } from "@/domain/discord-messages/settings-previews"
import { UnsavedChangesBar } from "@/components/app/settings/unsaved-changes-bar"
import { useDiscordMetadataState } from "@/hooks/use-discord-metadata"
import { gameDataSettingsSchema } from "@/domain/game-data/contracts"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"
import { Button } from "@/components/ui/button"

import {
    panelOverviewItems,
    panelPaused,
    panelToggleAction,
    parseCalendarPanel,
    parseSavedPanels,
    type CalendarPanel,
    type PanelOverviewItem,
    type PanelSource,
    type SavedPanel,
} from "./messages/panel-overview"
import {
    MessageGroup,
    MessageRow,
    MessageTargetView,
    PreviewButton,
    RowChip,
    type MessageTarget,
} from "./messages/message-row"
import {
    PreviewPanel,
    SettingsMessagePreview,
} from "./messages/message-preview-panel"
import { MessagesLook } from "./messages/messages-look"

const GAME_SHORT: Record<GameId, string> = {
    hell_let_loose: "HLL",
    hell_let_loose_vietnam: "HLL: Vietnam",
    wardogs: "Wardogs",
}

type Draft = {
    /** As typed; saved only when it is a hex colour or blank. */
    accentColor: string
    iconDensity: MessageIconDensity
    errorsChannelId?: string
    settings: MessageSettings
    /** Panel switches by saved panel ID. */
    panels: Record<string, boolean>
}

function initialDraft(config: DiscordConfig | null): Draft {
    const style = normalizeMessageStyle(config?.messageStyle)
    return {
        accentColor: style.accentColor ?? "",
        iconDensity: style.iconDensity ?? "sparse",
        errorsChannelId: config?.errorsChannelId,
        settings: resolveMessageSettings(config),
        panels: {},
    }
}

export type Overview = {
    status: "loading" | "ready" | "failed"
    panels: SavedPanel[]
    /** The calendar panel of "Panely v Discordu"; null without one. */
    calendarPanel?: CalendarPanel | null
    sources: Map<string, PanelSource>
    reportCategories: Array<{ id: string; label: string }>
    seed: {
        configured: boolean
        enabled: boolean
        controlChannelId: string | null
    } | null
}

/** The clan's panels, their names and the seed control, for the overview. */
function usePanelOverview(serverId: string, version: number): Overview {
    const [state, setState] = useState<Overview & { version: number }>({
        version: -1,
        status: "loading",
        panels: [],
        sources: new Map(),
        reportCategories: [],
        seed: null,
    })
    useEffect(() => {
        let active = true
        const json = (path: string) =>
            fetch(path)
                .then((response) => (response.ok ? response.json() : null))
                .catch(() => null)
        void Promise.all([
            json(`/api/servers/${serverId}/discord-public-panels`),
            json(`/api/servers/${serverId}/game-data`),
            json(`/api/servers/${serverId}/discord-seed`),
        ]).then(([list, data, seed]) => {
            if (!active) return
            const parsed = gameDataSettingsSchema.safeParse(data)
            const sources = new Map<string, PanelSource>(
                parsed.success
                    ? parsed.data.connections.map((connection) => [
                          connection.snapshot.id,
                          {
                              name:
                                  connection.snapshot.displayName ??
                                  connection.sourceRef,
                              gameId: connection.snapshot.gameId,
                          },
                      ])
                    : []
            )
            const selected = (
                seed as {
                    selected?: {
                        configured?: boolean
                        settings?: {
                            enabled?: boolean
                            controlChannelId?: string | null
                        }
                    } | null
                } | null
            )?.selected
            setState({
                version,
                status: list ? "ready" : "failed",
                panels: parseSavedPanels(list),
                calendarPanel: parseCalendarPanel(list),
                sources,
                reportCategories: Array.isArray(
                    (list as { reportCategories?: unknown })?.reportCategories
                )
                    ? (
                          list as {
                              reportCategories: Array<{
                                  id: string
                                  label: string
                              }>
                          }
                      ).reportCategories
                    : [],
                seed: selected
                    ? {
                          configured: Boolean(selected.configured),
                          enabled: Boolean(selected.settings?.enabled),
                          controlChannelId:
                              selected.settings?.controlChannelId ?? null,
                      }
                    : null,
            })
        })
        return () => {
            active = false
        }
    }, [serverId, version])
    return state.version === version
        ? state
        : { ...state, status: "loading" as const }
}

type MessagesSettingsProps = {
    serverId: string
    config: DiscordConfig | null
    enabledGames: readonly GameId[]
    siteUrl: string
    hrefs: {
        channels: string
        matchTemplates: string
        commands: string
        membership: string
        tickets: string
        factionSigns: string
        league: string
        accountMessages: string
        /** "Panely v Discordu" (board P1), where every panel is edited. */
        panels: string
        /** "Seed serverů" (board P3), where the server control message is set. */
        seed: string
    }
    dictionary: Dictionary
}

/**
 * "Zprávy a panely v Discordu" (board N1) with its live data: the server's
 * channels, the panels, their names and the seed control.
 */
export function DiscordMessagesSettings(props: MessagesSettingsProps) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const metadata = useDiscordMetadataState(props.serverId)
    const [overviewVersion, setOverviewVersion] = useState(0)
    const overview = usePanelOverview(props.serverId, overviewVersion)
    return (
        <DiscordMessagesSettingsView
            {...props}
            channels={metadata.metadata?.channels ?? []}
            channelsStatus={metadata.status}
            overview={overview}
            refreshing={isPending}
            onSaved={() => startTransition(() => router.refresh())}
            onPanelsChanged={() => setOverviewVersion((value) => value + 1)}
        />
    )
}

/**
 * The page without routing or fetching, so tests can render it: the look of
 * every bot message with a live preview, everything the bot sends with
 * where it goes, its switch and a rendered "Náhled", an overview of the
 * panels and the errors channel, all saved with one save bar. Channels
 * owned by another page show a lock and a link to it (N1-B04).
 */
export function DiscordMessagesSettingsView({
    serverId,
    config,
    enabledGames,
    siteUrl,
    hrefs,
    dictionary,
    channels,
    channelsStatus,
    overview,
    refreshing = false,
    onSaved,
    onPanelsChanged,
}: MessagesSettingsProps & {
    channels: ReadonlyArray<{
        id: string
        name: string
        type: number
        parentId?: string
    }>
    channelsStatus: "loading" | "ready" | "failed"
    overview: Overview
    refreshing?: boolean
    onSaved(): void
    onPanelsChanged(): void
}) {
    const text = dictionary.settingsHub.messagesPage
    const ids = useId()
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState<Draft>(() => initialDraft(config))
    const [draft, setDraft] = useState<Draft>(saved)
    const [open, setOpen] = useState<string | null>(null)
    const metadata = { status: channelsStatus }
    const language = config?.defaultLanguage ?? "en"
    const timeZone = config?.timezone || "UTC"

    const accentColor = normalizeAccentColor(draft.accentColor.trim())
    const colorInvalid = Boolean(draft.accentColor.trim()) && !accentColor
    const style = {
        iconDensity: draft.iconDensity,
        ...(accentColor ? { accentColor } : {}),
    }
    const styleChanged =
        (accentColor ?? "") !==
            (normalizeAccentColor(saved.accentColor) ?? "") ||
        draft.iconDensity !== saved.iconDensity
    const changedSettings = (
        Object.keys(draft.settings) as Array<keyof MessageSettings>
    ).filter((key) => draft.settings[key] !== saved.settings[key])
    const errorsChanged =
        (draft.errorsChannelId || undefined) !==
        (saved.errorsChannelId || undefined)
    // A switch is on while its panel runs (sent and not paused).
    const savedEnabled = new Map<string, boolean>([
        ...overview.panels.map((panel): [string, boolean] => [
            panel._id,
            !panel.draft && !panelPaused(panel),
        ]),
        ...(overview.calendarPanel
            ? [
                  [
                      overview.calendarPanel._id,
                      !overview.calendarPanel.draft &&
                          !overview.calendarPanel.paused,
                  ] as [string, boolean],
              ]
            : []),
    ])
    const changedPanels = Object.entries(draft.panels).filter(
        ([id, enabled]) => savedEnabled.get(id) !== enabled
    )
    const changes =
        (accentColor ?? "") !== (normalizeAccentColor(saved.accentColor) ?? "")
            ? 1
            : 0
    const count =
        changes +
        (draft.iconDensity !== saved.iconDensity ? 1 : 0) +
        changedSettings.length +
        (errorsChanged ? 1 : 0) +
        changedPanels.length

    function setSetting<K extends keyof MessageSettings>(
        key: K,
        value: MessageSettings[K]
    ) {
        setDraft((current) => ({
            ...current,
            settings: { ...current.settings, [key]: value },
        }))
    }

    const togglePreview = useCallback(
        (key: string) => setOpen((current) => (current === key ? null : key)),
        []
    )

    async function save() {
        if (colorInvalid) {
            toast.error(text.clanColorInvalid)
            return
        }
        setSaving(true)
        try {
            const result = await saveDiscordSettings(serverId, {
                ...(styleChanged
                    ? {
                          messageStyle: {
                              accentColor: accentColor ?? null,
                              iconDensity: draft.iconDensity,
                          },
                      }
                    : {}),
                ...(errorsChanged
                    ? { errorsChannelId: clearableId(draft.errorsChannelId) }
                    : {}),
                ...(changedSettings.length
                    ? {
                          messageSettings: Object.fromEntries(
                              changedSettings.map((key) => [
                                  key,
                                  draft.settings[key],
                              ])
                          ),
                      }
                    : {}),
            })
            if (!result.ok) {
                toast.error(
                    result.error ??
                        dictionary.serverSettings.discordSettingsSaveError
                )
                return
            }
            // A panel switch is "Pozastavit" / "Spustit" of "Panely v Discordu".
            for (const [id, enabled] of changedPanels) {
                const response = await fetch(
                    `/api/servers/${encodeURIComponent(serverId)}/discord-panels/${encodeURIComponent(id)}/actions`,
                    {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            action: panelToggleAction(enabled),
                        }),
                    }
                ).catch(() => null)
                if (!response?.ok) {
                    toast.error(
                        dictionary.serverSettings.discordSettingsSaveError
                    )
                    return
                }
            }
            const next = {
                ...draft,
                accentColor: accentColor ?? "",
                panels: {},
            }
            setSaved(next)
            setDraft(next)
            if (changedPanels.length) onPanelsChanged()
            toast.success(dictionary.serverSettings.discordSettingsSaved)
            onSaved()
        } finally {
            setSaving(false)
        }
    }

    // --- Targets ------------------------------------------------------------

    const channelName = (id: string | undefined) => {
        if (!id) return undefined
        return (
            channels.find((channel) => channel.id === id)?.name ??
            text.channelUnknown
        )
    }
    const from = (label: string, href: string) => ({
        prefix: text.fromPage,
        label,
        href,
    })
    /** A clan-wide channel and each game's own one, owned by Kanály a jazyk. */
    function routed(
        field:
            | "announcementsChannelId"
            | "eventInfoChannelId"
            | "forumCategoryId"
            | "meetingChannelId",
        kind: "channel" | "category" | "voice"
    ): MessageTarget {
        const line = (id: string | undefined, game?: GameId) => {
            const name = channelName(id)
            return {
                text: name
                    ? kind === "category"
                        ? text.category.replace("{name}", name)
                        : name
                    : text.notSet,
                kind: name
                    ? kind === "voice"
                        ? ("voice" as const)
                        : kind === "channel"
                          ? ("channel" as const)
                          : ("plain" as const)
                    : ("plain" as const),
                game,
            }
        }
        return {
            lines: [
                line(config?.[field]),
                ...enabledGames.flatMap((game) => {
                    const own = config?.gameOverrides?.[game]?.[field]
                    return own ? [line(own, game)] : []
                }),
            ],
            from: from(text.pages.channels, hrefs.channels),
        }
    }
    const plain = (value: string): MessageTarget => ({
        lines: [{ text: value, kind: "plain" }],
    })
    /** A channel owned by another page; `format` writes it as "vlákna pod # x". */
    const owned = (
        id: string | undefined,
        page: string,
        href: string,
        format?: (name: string) => string
    ): MessageTarget => {
        const name = channelName(id)
        return {
            lines: [
                !name
                    ? { text: text.notSet, kind: "plain" }
                    : format
                      ? { text: format(name), kind: "plain" }
                      : { text: name, kind: "channel" },
            ],
            from: from(page, href),
        }
    }

    // --- Rows ---------------------------------------------------------------

    const previewProps = {
        language,
        style,
        rosterVariant: draft.settings.rosterMessageVariant,
        timeZone,
        siteUrl,
        dictionary,
    }
    const previewOf = (
        key: SettingsPreviewKind,
        title: string,
        options: { panelTitle?: string; aside?: React.ReactNode } = {}
    ) => ({
        action: (
            <PreviewButton
                open={open === key}
                onClick={() => togglePreview(key)}
                controls={`${ids}-preview-${key}`}
                previewLabel={text.preview}
                closeLabel={text.close}
            />
        ),
        children:
            open === key ? (
                <PreviewPanel
                    id={`${ids}-preview-${key}`}
                    label={text.previewRegion.replace("{message}", title)}
                    title={options.panelTitle}
                    aside={options.aside}
                >
                    <SettingsMessagePreview kind={key} {...previewProps} />
                </PreviewPanel>
            ) : null,
    })
    const settingToggle = (key: keyof MessageSettings, label: string) => {
        const value = draft.settings[key]
        return typeof value === "boolean"
            ? {
                  checked: value,
                  onChange: (checked: boolean) =>
                      setSetting(key, checked as never),
                  label,
              }
            : undefined
    }
    const row = (input: {
        key: SettingsPreviewKind
        icon: LucideIcon
        title: string
        detail: string
        target?: MessageTarget
        chips?: React.ReactNode
        toggle?: ReturnType<typeof settingToggle>
        extra?: React.ReactNode
        panelTitle?: string
        aside?: React.ReactNode
    }) => {
        const preview = previewOf(input.key, input.title, input)
        return (
            <MessageRow
                key={input.key}
                icon={input.icon}
                title={input.title}
                chips={input.chips}
                detail={input.detail}
                extra={input.extra}
                target={
                    input.target ? (
                        <MessageTargetView target={input.target} />
                    ) : undefined
                }
                toggle={input.toggle}
                action={preview.action}
            >
                {preview.children}
            </MessageRow>
        )
    }

    const rows = text.rows
    const variantOther = ROSTER_MESSAGE_VARIANTS.find(
        (variant) => variant !== draft.settings.rosterMessageVariant
    )!
    const reportCategoryId = overview.panels
        .map(
            (panel) => (panel as { reportCategoryId?: string }).reportCategoryId
        )
        .find((id): id is string => Boolean(id))
    const reportCategory = overview.reportCategories.find(
        (category) => category.id === reportCategoryId
    )
    const panelItems = panelOverviewItems({
        panels: overview.panels,
        sources: overview.sources,
        seed: overview.seed,
        calendar: {
            channelId: config?.calendarChannelId,
            messageId: config?.calendarMessageId,
        },
        calendarPanel: overview.calendarPanel,
        wardogs: enabledGames.includes("wardogs"),
    })

    return (
        <div className="space-y-6">
            <header className="space-y-1">
                <h1 className="text-2xl font-semibold tracking-tight">
                    {text.title}
                </h1>
                <p className="text-muted-foreground text-sm">
                    {text.description}
                </p>
            </header>
            <MessagesLook
                accentColor={draft.accentColor}
                iconDensity={draft.iconDensity}
                onChange={(patch) =>
                    setDraft((current) => ({ ...current, ...patch }))
                }
                language={language}
                timeZone={timeZone}
                siteUrl={siteUrl}
                hrefs={{
                    channels: hrefs.channels,
                    factionSigns: hrefs.factionSigns,
                }}
                dictionary={dictionary}
            />
            <section
                aria-labelledby={`${ids}-list`}
                className="bg-card overflow-hidden rounded-2xl border"
            >
                <div className="space-y-1.5 px-4 py-4 sm:px-6">
                    <h2 id={`${ids}-list`} className="text-base font-semibold">
                        {text.listTitle}
                    </h2>
                    <p className="text-muted-foreground flex items-start gap-1.5 text-[13px] leading-5">
                        <Info
                            className="mt-0.5 size-3.5 shrink-0"
                            aria-hidden="true"
                        />
                        {text.listIntro}
                    </p>
                </div>
                <ul className="divide-y">
                    <MessageGroup title={text.groups.matches}>
                        {row({
                            key: "announcement",
                            icon: Megaphone,
                            title: rows.announcement.title,
                            detail: rows.announcement.detail,
                            target: routed("announcementsChannelId", "channel"),
                        })}
                        {row({
                            key: "roster",
                            icon: Users,
                            title: rows.roster.title,
                            detail: rows.roster.detail,
                            target: routed("eventInfoChannelId", "channel"),
                            extra: (
                                <div className="space-y-1">
                                    <div className="flex flex-wrap items-center gap-2 text-[13px]">
                                        <span id={`${ids}-variant`}>
                                            {rows.roster.variantLabel}
                                        </span>
                                        <Select
                                            value={
                                                draft.settings
                                                    .rosterMessageVariant
                                            }
                                            onValueChange={(value) =>
                                                setSetting(
                                                    "rosterMessageVariant",
                                                    value as RosterMessageVariant
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                size="sm"
                                                aria-labelledby={`${ids}-variant`}
                                                className="h-8 w-auto rounded-lg"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {ROSTER_MESSAGE_VARIANTS.map(
                                                    (variant) => (
                                                        <SelectItem
                                                            key={variant}
                                                            value={variant}
                                                        >
                                                            {
                                                                rows.roster
                                                                    .variants[
                                                                    variant
                                                                ]
                                                            }
                                                        </SelectItem>
                                                    )
                                                )}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <p className="text-muted-foreground text-xs">
                                        {rows.roster.variantNote.replace(
                                            "{other}",
                                            rows.roster.variants[variantOther]
                                        )}
                                    </p>
                                </div>
                            ),
                        })}
                        {row({
                            key: "rosterChanges",
                            icon: ListChecks,
                            title: rows.rosterChanges.title,
                            detail: rows.rosterChanges.detail,
                            target: plain(rows.rosterChanges.target),
                            toggle: settingToggle(
                                "rosterChangesPost",
                                rows.rosterChanges.switchLabel
                            ),
                        })}
                        {row({
                            key: "forum",
                            icon: MessagesSquare,
                            title: rows.forum.title,
                            detail: rows.forum.detail,
                            target: routed("forumCategoryId", "category"),
                        })}
                        {row({
                            key: "debrief",
                            icon: ClipboardList,
                            title: rows.debrief.title,
                            detail: rows.debrief.detail,
                            target: plain(rows.debrief.target),
                            toggle: settingToggle(
                                "debriefPost",
                                rows.debrief.switchLabel
                            ),
                        })}
                        {row({
                            key: "attendanceNotice",
                            icon: Clock,
                            title: rows.notices.title,
                            chips: <RowChip tone="new">{text.newChip}</RowChip>,
                            detail: rows.notices.detail,
                            target: plain(rows.notices.target),
                            toggle: settingToggle(
                                "attendanceNoticesInThread",
                                rows.notices.switchLabel
                            ),
                        })}
                        {row({
                            key: "scheduledEvent",
                            icon: CalendarCheck,
                            title: rows.scheduledEvent.title,
                            detail: rows.scheduledEvent.detail,
                            target: routed("meetingChannelId", "voice"),
                            toggle: settingToggle(
                                "scheduledEvent",
                                rows.scheduledEvent.switchLabel
                            ),
                        })}
                        <MessageRow
                            icon={Volume2}
                            title={rows.squadRoles.title}
                            detail={rows.squadRoles.detail}
                            target={
                                <MessageTargetView
                                    target={{
                                        lines: [
                                            {
                                                text: channelName(
                                                    config?.squadVoiceCategoryId
                                                )
                                                    ? text.category.replace(
                                                          "{name}",
                                                          channelName(
                                                              config?.squadVoiceCategoryId
                                                          )!
                                                      )
                                                    : text.notSet,
                                                kind: "plain",
                                            },
                                        ],
                                        from: from(
                                            text.pages.channels,
                                            hrefs.channels
                                        ),
                                    }}
                                />
                            }
                        />
                    </MessageGroup>
                    <MessageGroup
                        title={text.groups.direct}
                        note={text.groups.directNote}
                    >
                        {row({
                            key: "signupReminder",
                            icon: Bell,
                            title: rows.signupReminder.title,
                            detail: rows.signupReminder.detail,
                            target: {
                                ...plain(rows.signupReminder.target),
                                from: from(
                                    text.pages.matchTemplates,
                                    hrefs.matchTemplates
                                ),
                            },
                        })}
                        {row({
                            key: "attendanceReminder",
                            icon: BellRing,
                            title: rows.attendanceReminder.title,
                            detail: rows.attendanceReminder.detail,
                            target: {
                                ...plain(rows.attendanceReminder.target),
                                from: from(
                                    text.pages.matchTemplates,
                                    hrefs.matchTemplates
                                ),
                            },
                        })}
                        {row({
                            key: "matchRecap",
                            icon: BarChart3,
                            title: rows.recap.title,
                            detail: rows.recap.detail,
                            target: plain(rows.recap.target),
                            toggle: settingToggle(
                                "matchRecapDm",
                                rows.recap.switchLabel
                            ),
                            panelTitle: rows.recap.previewTitle,
                            aside: (
                                <div className="space-y-2">
                                    <h4 className="text-sm font-semibold">
                                        {rows.recap.whoTitle}
                                    </h4>
                                    <p className="text-muted-foreground">
                                        {rows.recap.who}
                                    </p>
                                    <p className="text-muted-foreground">
                                        {rows.recap.whoOff.split("{link}")[0]}
                                        <Link
                                            href={hrefs.accountMessages}
                                            className="text-foreground underline underline-offset-3"
                                        >
                                            {rows.recap.whoLink}
                                        </Link>
                                        {rows.recap.whoOff.split("{link}")[1]}
                                    </p>
                                </div>
                            ),
                        })}
                        {row({
                            key: "trainingResult",
                            icon: GraduationCap,
                            title: rows.trainingResult.title,
                            detail: rows.trainingResult.detail,
                            target: plain(rows.trainingResult.target),
                            toggle: settingToggle(
                                "trainingResultDm",
                                rows.trainingResult.switchLabel
                            ),
                        })}
                        {row({
                            key: "rosterChangeDm",
                            icon: SlidersHorizontal,
                            title: rows.rosterChangeDm.title,
                            detail: rows.rosterChangeDm.detail,
                            target: plain(rows.rosterChangeDm.target),
                            toggle: settingToggle(
                                "rosterChangesDm",
                                rows.rosterChangeDm.switchLabel
                            ),
                        })}
                        {row({
                            key: "teamRequest",
                            icon: CircleCheck,
                            title: rows.teamRequest.title,
                            detail: rows.teamRequest.detail,
                            target: plain(rows.teamRequest.target),
                        })}
                        {row({
                            key: "buttonReplies",
                            icon: MousePointerClick,
                            title: rows.buttonReplies.title,
                            detail: rows.buttonReplies.detail,
                            target: plain(rows.buttonReplies.target),
                        })}
                        <MessageRow
                            icon={SquareTerminal}
                            title={rows.commandReplies.title}
                            detail={rows.commandReplies.detail}
                            target={
                                <MessageTargetView
                                    target={owned(
                                        config?.statsSettings
                                            ?.defaultShareChannelId,
                                        text.pages.commands,
                                        hrefs.commands
                                    )}
                                />
                            }
                            action={
                                <Button
                                    asChild
                                    variant="outline"
                                    size="sm"
                                    className="rounded-lg"
                                >
                                    <Link href={hrefs.commands}>
                                        {text.pages.commands}
                                        <ChevronRight
                                            className="size-3.5"
                                            aria-hidden="true"
                                        />
                                    </Link>
                                </Button>
                            }
                        />
                    </MessageGroup>
                    <MessageGroup title={text.groups.panels}>
                        <li
                            id={`${ids}-panels`}
                            className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6"
                        >
                            <p className="text-muted-foreground flex items-start gap-1.5 text-[13px] leading-5">
                                <Info
                                    className="mt-0.5 size-3.5 shrink-0"
                                    aria-hidden="true"
                                />
                                <span>
                                    {text.panels.intro.split("{link}")[0]}
                                    <Link
                                        href={hrefs.panels}
                                        className="text-foreground underline underline-offset-3"
                                    >
                                        {text.pages.panels}
                                    </Link>
                                    {text.panels.intro.split("{link}")[1]}
                                </span>
                            </p>
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="rounded-lg"
                            >
                                <Link href={`${hrefs.panels}/new`}>
                                    <Plus
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    {text.panels.add}
                                </Link>
                            </Button>
                        </li>
                        {overview.status === "loading" ? (
                            <li
                                role="status"
                                className="text-muted-foreground px-4 py-3 text-sm sm:px-6"
                            >
                                {text.panels.loading}
                            </li>
                        ) : overview.status === "failed" ? (
                            <li
                                role="alert"
                                className="text-muted-foreground px-4 py-3 text-sm sm:px-6"
                            >
                                {text.panels.unavailable}
                            </li>
                        ) : null}
                        {panelItems.map((item) => (
                            <PanelRow
                                key={item.key}
                                item={item}
                                enabled={
                                    item.panelId && item.panelId in draft.panels
                                        ? draft.panels[item.panelId]!
                                        : item.enabled
                                }
                                onToggle={(enabled) =>
                                    item.panelId &&
                                    setDraft((current) => ({
                                        ...current,
                                        panels: {
                                            ...current.panels,
                                            [item.panelId!]: enabled,
                                        },
                                    }))
                                }
                                channelName={channelName}
                                calendarCategories={
                                    config?.calendarCategories ?? []
                                }
                                hrefs={hrefs}
                                dictionary={dictionary}
                            />
                        ))}
                    </MessageGroup>
                    <MessageGroup title={text.groups.membership}>
                        {row({
                            key: "recruitmentPanel",
                            icon: UserPlus,
                            title: rows.recruitmentPanel.title,
                            detail: rows.recruitmentPanel.detail,
                            target: owned(
                                config?.membershipSettings?.submitChannelId,
                                text.pages.membership,
                                hrefs.membership
                            ),
                        })}
                        {row({
                            key: "application",
                            icon: UserCheck,
                            title: rows.application.title,
                            detail: rows.application.detail,
                            target: owned(
                                config?.membershipSettings
                                    ?.applicationParentChannelId,
                                text.pages.membership,
                                hrefs.membership,
                                (name) =>
                                    text.threadsUnder.replace(
                                        "{channel}",
                                        `# ${name}`
                                    )
                            ),
                        })}
                        {row({
                            key: "applicationClose",
                            icon: Archive,
                            title: rows.applicationClose.title,
                            detail: rows.applicationClose.detail,
                            target: plain(rows.applicationClose.target),
                            toggle: settingToggle(
                                "applicationCloseDm",
                                rows.applicationClose.switchLabel
                            ),
                        })}
                        {row({
                            key: "ticketPanel",
                            icon: Ticket,
                            title: rows.ticketPanel.title,
                            detail: rows.ticketPanel.detail,
                            target: owned(
                                config?.ticketSettings?.submitChannelId,
                                text.pages.tickets,
                                hrefs.tickets
                            ),
                        })}
                        {row({
                            key: "ticket",
                            icon: MessageCircle,
                            title: rows.ticket.title,
                            detail: rows.ticket.detail,
                            target: owned(
                                config?.ticketSettings?.ticketParentChannelId,
                                text.pages.tickets,
                                hrefs.tickets,
                                (name) =>
                                    text.threadsUnder.replace(
                                        "{channel}",
                                        `# ${name}`
                                    )
                            ),
                        })}
                        {row({
                            key: "ticketClose",
                            icon: Archive,
                            title: rows.ticketClose.title,
                            detail: rows.ticketClose.detail,
                            target: plain(rows.ticketClose.target),
                            toggle: settingToggle(
                                "ticketCloseDm",
                                rows.ticketClose.switchLabel
                            ),
                        })}
                        {row({
                            key: "playerReport",
                            icon: Flag,
                            title: rows.playerReport.title,
                            detail: rows.playerReport.detail,
                            target: {
                                lines: [
                                    {
                                        text: reportCategory
                                            ? text.category.replace(
                                                  "{name}",
                                                  reportCategory.label
                                              )
                                            : text.notSet,
                                        kind: "plain",
                                    },
                                ],
                                from: from(text.pages.tickets, hrefs.tickets),
                            },
                        })}
                    </MessageGroup>
                    <MessageGroup title={text.groups.system}>
                        {(() => {
                            const preview = previewOf(
                                "errors",
                                rows.errors.title
                            )
                            return (
                                <MessageRow
                                    icon={Bug}
                                    title={rows.errors.title}
                                    detail={rows.errors.detail}
                                    target={
                                        <div className="space-y-1">
                                            <label
                                                htmlFor={`${ids}-errors`}
                                                className="sr-only"
                                            >
                                                {rows.errors.selectLabel}
                                            </label>
                                            <SettingsChannelPicker
                                                id={`${ids}-errors`}
                                                value={draft.errorsChannelId}
                                                onChange={(value) =>
                                                    setDraft((current) => ({
                                                        ...current,
                                                        errorsChannelId: value,
                                                    }))
                                                }
                                                options={channelOptions(
                                                    channels,
                                                    "text"
                                                )}
                                                kind="text"
                                                placeholder={
                                                    rows.errors.selectLabel
                                                }
                                                noneLabel={
                                                    rows.errors.noChannel
                                                }
                                                loading={
                                                    metadata.status ===
                                                    "loading"
                                                }
                                                unavailable={
                                                    metadata.status === "failed"
                                                }
                                            />
                                        </div>
                                    }
                                    action={preview.action}
                                >
                                    {preview.children}
                                </MessageRow>
                            )
                        })()}
                    </MessageGroup>
                </ul>
            </section>
            <UnsavedChangesBar
                changes={count}
                saving={saving || refreshing}
                onDiscard={() => setDraft(saved)}
                onSave={() => void save()}
                dictionary={dictionary}
            />
        </div>
    )
}

const PANEL_ICONS: Record<PanelOverviewItem["kind"], LucideIcon> = {
    live: Radio,
    combined: Layers,
    control: Shield,
    results: Trophy,
    league: Medal,
    calendar: CalendarDays,
}

/** One panel of the overview (N1-29..36) with its status chip and switch. */
function PanelRow({
    item,
    enabled,
    onToggle,
    channelName,
    calendarCategories,
    hrefs,
    dictionary,
}: {
    item: PanelOverviewItem
    enabled: boolean | undefined
    onToggle(enabled: boolean): void
    channelName(id: string | undefined): string | undefined
    calendarCategories: readonly string[]
    hrefs: { panels: string; seed: string }
    dictionary: Dictionary
}) {
    const text = dictionary.settingsHub.messagesPage
    const t = text.panels
    const hintId = useId()
    const game = item.game
    const name =
        item.kind === "control"
            ? t.controlTitle
            : item.kind === "calendar"
              ? t.calendarTitle
              : item.kind === "league"
                ? t.leagueTitle
                : item.kind === "combined"
                  ? t.combinedTitle
                  : item.kind === "results"
                    ? t.resultsTitle.replace(
                          "{game}",
                          game ? GAME_SHORT[game] : (item.name ?? "")
                      )
                    : (item.name ?? GAME_LABELS[game ?? "hell_let_loose"])
    const detail =
        item.status === "error"
            ? (item.error ?? t.errorFallback)
            : item.kind === "control"
              ? t.controlDetail
              : item.kind === "calendar"
                ? t.calendarDetail.replace(
                      "{categories}",
                      calendarCategories.length
                          ? calendarCategories.join(", ")
                          : t.calendarAll
                  )
                : item.kind === "league"
                  ? t.leagueDetail
                  : item.kind === "results"
                    ? t.resultsDetail
                    : item.kind === "combined"
                      ? t.combinedDetail.replace("{servers}", item.name ?? "")
                      : item.showPassword
                        ? t.privateDetail
                        : t.liveDetail.replace(
                              "{seconds}",
                              String(item.refreshSeconds ?? 60)
                          )
    const switchLabel =
        item.kind === "control"
            ? t.controlSwitch
            : item.kind === "calendar"
              ? t.calendarSwitch
              : item.kind === "league"
                ? t.leagueSwitch
                : t.switchLabel.replace("{name}", name)
    const channel = channelName(item.channelId)
    // The calendar's channel is set on "Panely v Discordu" too (N1-47, N1-48).
    const editHref =
        item.kind === "control"
            ? hrefs.seed
            : item.panelId
              ? `${hrefs.panels}/${encodeURIComponent(item.panelId)}`
              : item.kind === "calendar"
                ? `${hrefs.panels}/new?type=calendar`
                : hrefs.panels
    return (
        <MessageRow
            icon={PANEL_ICONS[item.kind]}
            title={name}
            chips={
                <>
                    {game && item.kind !== "results" ? (
                        <RowChip tone="game">{GAME_SHORT[game]}</RowChip>
                    ) : null}
                    {item.status ? (
                        <RowChip
                            tone={
                                item.status === "error"
                                    ? "error"
                                    : item.status === "unsent"
                                      ? "warning"
                                      : "neutral"
                            }
                        >
                            {t.chips[item.status]}
                        </RowChip>
                    ) : null}
                </>
            }
            detail={
                <>
                    {detail}
                    {item.kind === "calendar" ? (
                        <span id={hintId} className="sr-only">
                            {t.calendarHint}
                        </span>
                    ) : null}
                </>
            }
            target={
                <MessageTargetView
                    target={{
                        lines: [
                            channel
                                ? { text: channel, kind: "channel" }
                                : { text: text.notSet, kind: "plain" },
                        ],
                    }}
                />
            }
            toggle={
                enabled === undefined
                    ? undefined
                    : {
                          checked: enabled,
                          onChange: onToggle,
                          label: switchLabel,
                          disabled: !item.toggleable,
                          describedBy:
                              item.kind === "calendar" ? hintId : undefined,
                      }
            }
            action={
                <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                >
                    <Link href={editHref}>
                        {text.edit}
                        <ChevronRight className="size-3.5" aria-hidden="true" />
                    </Link>
                </Button>
            }
        />
    )
}
