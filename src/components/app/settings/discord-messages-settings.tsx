"use client"

import {
    Bell,
    Bug,
    CalendarDays,
    Lock,
    Megaphone,
    Radio,
    Trophy,
    TriangleAlert,
    Users,
} from "lucide-react"
import {
    useEffect,
    useId,
    useState,
    useTransition,
    type ReactNode,
} from "react"
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
    SegmentedControl,
    SettingsField,
    SettingsPanel,
} from "@/components/app/settings/settings-panel"
import {
    clearableId,
    saveDiscordSettings,
} from "@/components/app/settings/save-discord-settings"
import { UnsavedChangesBar } from "@/components/app/settings/unsaved-changes-bar"
import { DEFAULT_MESSAGE_ACCENT_COLOR } from "@/domain/discord-messages/format"
import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import type { Dictionary } from "@/i18n/dictionaries"
import type { DiscordConfig } from "@/types/domain"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const DEFAULT_HEX = `#${DEFAULT_MESSAGE_ACCENT_COLOR.toString(16).toUpperCase().padStart(6, "0")}`

type ChannelField =
    "announcementsChannelId" | "eventInfoChannelId" | "errorsChannelId"
const CHANNEL_FIELDS: readonly ChannelField[] = [
    "announcementsChannelId",
    "eventInfoChannelId",
    "errorsChannelId",
]

type Draft = {
    /** As typed; saved only when it is a hex colour or blank. */
    accentColor: string
    iconDensity: MessageIconDensity
} & Partial<Record<ChannelField, string>>

type Editor = ChannelField

/** Saved public panels, as `GET …/discord-public-panels` lists them. */
type PanelSummary = {
    kind: "server" | "scoreboard" | "results"
    channelId: string
    enabled: boolean
    refreshSeconds: number
}

function initialDraft(config: DiscordConfig | null): Draft {
    const style = normalizeMessageStyle(config?.messageStyle)
    return {
        accentColor: style.accentColor ?? "",
        iconDensity: style.iconDensity ?? "sparse",
        announcementsChannelId: config?.announcementsChannelId,
        eventInfoChannelId: config?.eventInfoChannelId,
        errorsChannelId: config?.errorsChannelId,
    }
}

function MessageRow({
    icon: Icon,
    title,
    detail,
    warning = false,
    action,
    children,
}: {
    icon: LucideIcon
    title: string
    detail: ReactNode
    warning?: boolean
    action?: ReactNode
    children?: ReactNode
}) {
    return (
        <li className="px-5 py-4 sm:px-6">
            <div className="flex flex-wrap items-start gap-x-3 gap-y-2 sm:flex-nowrap">
                <span
                    className={cn(
                        "flex size-9 shrink-0 items-center justify-center rounded-lg",
                        children
                            ? "bg-foreground text-background"
                            : "bg-muted text-muted-foreground"
                    )}
                >
                    <Icon className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="text-sm font-semibold">{title}</div>
                    <div
                        className={cn(
                            "flex items-start gap-1.5 text-[13px]",
                            warning
                                ? "text-amber-800 dark:text-amber-200"
                                : "text-muted-foreground"
                        )}
                    >
                        {warning ? (
                            <TriangleAlert
                                className="mt-0.5 size-3.5 shrink-0"
                                aria-hidden="true"
                            />
                        ) : null}
                        <span className="min-w-0 break-words">{detail}</span>
                    </div>
                </div>
                {action ? (
                    <div className="w-full shrink-0 pl-12 sm:w-auto sm:pl-0">
                        {action}
                    </div>
                ) : null}
            </div>
            {children ? <div className="mt-4 sm:pl-12">{children}</div> : null}
        </li>
    )
}

/**
 * Discord messages (design D4): one look for every bot message (clan colour,
 * icon density, language) and the messages the bot sends, each with where it
 * goes and an editor that opens under its row. Channels edited here are the
 * clan-wide ones; per-game channels stay under Channels and language.
 */
export function DiscordMessagesSettings({
    serverId,
    config,
    enabledGames,
    hrefs,
    dictionary,
}: {
    serverId: string
    config: DiscordConfig | null
    enabledGames: readonly GameId[]
    hrefs: {
        channels: string
        league: string
        matchTemplates: string
        /** "Panely v Discordu", where live and results panels are edited. */
        panels: string
    }
    dictionary: Dictionary
}) {
    const text = dictionary.settingsHub.messagesPage
    const router = useRouter()
    const ids = useId()
    const [isPending, startTransition] = useTransition()
    const [saving, setSaving] = useState(false)
    const metadata = useDiscordMetadata(serverId)
    const [saved, setSaved] = useState<Draft>(() => initialDraft(config))
    const [draft, setDraft] = useState<Draft>(saved)
    const [open, setOpen] = useState<Editor | null>(null)
    const [panels, setPanels] = useState<PanelSummary[] | null>(null)

    useEffect(() => {
        let active = true
        fetch(`/api/servers/${serverId}/discord-public-panels`)
            .then((response) => (response.ok ? response.json() : null))
            .then((body: { panels?: PanelSummary[] } | null) => {
                if (active && Array.isArray(body?.panels))
                    setPanels(body.panels)
            })
            .catch(() => undefined)
        return () => {
            active = false
        }
    }, [serverId])

    const typedColor = draft.accentColor.trim()
    const accentColor = normalizeAccentColor(typedColor)
    const colorInvalid = Boolean(typedColor) && !accentColor
    const styleChanges = [
        (accentColor ?? "") !== (normalizeAccentColor(saved.accentColor) ?? ""),
        draft.iconDensity !== saved.iconDensity,
    ].filter(Boolean).length
    const channelChanges = CHANNEL_FIELDS.filter(
        (field) => (draft[field] || undefined) !== (saved[field] || undefined)
    )
    const changes = styleChanges + channelChanges.length

    function update(patch: Partial<Draft>) {
        setDraft((current) => ({ ...current, ...patch }))
    }

    async function save() {
        if (colorInvalid) {
            toast.error(text.clanColorInvalid)
            return
        }
        setSaving(true)
        try {
            const result = await saveDiscordSettings(serverId, {
                ...(styleChanges
                    ? {
                          messageStyle: {
                              accentColor: accentColor ?? null,
                              iconDensity: draft.iconDensity,
                          },
                      }
                    : {}),
                ...Object.fromEntries(
                    channelChanges.map((field) => [
                        field,
                        clearableId(draft[field]),
                    ])
                ),
            })
            if (!result.ok) {
                toast.error(
                    result.error ??
                        dictionary.serverSettings.discordSettingsSaveError
                )
                return
            }
            const next = { ...draft, accentColor: accentColor ?? "" }
            setSaved(next)
            setDraft(next)
            toast.success(dictionary.serverSettings.discordSettingsSaved)
            startTransition(() => router.refresh())
        } finally {
            setSaving(false)
        }
    }

    function channelLabel(channelId: string | undefined) {
        if (!channelId) return undefined
        const found = metadata?.channels.find((item) => item.id === channelId)
        return found ? `#${found.name}` : text.channelUnknown
    }
    function toggle(editor: Editor) {
        setOpen((current) => (current === editor ? null : editor))
    }
    function editButton(editor: Editor) {
        return (
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-lg"
                aria-expanded={open === editor}
                aria-controls={`${ids}-${editor}`}
                onClick={() => toggle(editor)}
            >
                {open === editor ? text.close : text.edit}
            </Button>
        )
    }
    const linkButton = (href: string, label = text.edit) => (
        <Button asChild variant="outline" size="sm" className="rounded-lg">
            <Link href={href}>{label}</Link>
        </Button>
    )

    /** Games whose own channel replaces the clan-wide one for `field`. */
    function exceptions(
        field: "announcementsChannelId" | "eventInfoChannelId"
    ) {
        return enabledGames.flatMap((game) => {
            const channelId = config?.gameOverrides?.[game]?.[field]
            return channelId
                ? [
                      text.gameException
                          .replace("{game}", GAME_LABELS[game])
                          .replace(
                              "{channel}",
                              channelLabel(channelId) ?? text.channelUnknown
                          ),
                  ]
                : []
        })
    }

    function channelEditor(field: ChannelField, help: string) {
        const notes = field === "errorsChannelId" ? [] : exceptions(field)
        return (
            <div
                id={`${ids}-${field}`}
                className="bg-muted/30 max-w-xl space-y-2 rounded-xl border p-4"
            >
                <div className="text-sm font-medium">{text.channel}</div>
                <DiscordChannelSelect
                    value={draft[field]}
                    onChange={(value) => update({ [field]: value })}
                    channels={metadata?.channels ?? []}
                    placeholder={text.channel}
                    noneLabel={text.noChannel}
                />
                <p className="text-muted-foreground text-[13px]">{help}</p>
                {notes.map((note) => (
                    <p key={note} className="text-muted-foreground text-[13px]">
                        {note}{" "}
                        <Link
                            href={hrefs.channels}
                            className="text-foreground underline underline-offset-3"
                        >
                            {text.languageLink}
                        </Link>
                    </p>
                ))}
            </div>
        )
    }

    const announcement = channelLabel(draft.announcementsChannelId)
    const eventInfo = channelLabel(draft.eventInfoChannelId)
    const errors = channelLabel(draft.errorsChannelId)
    const live = panels?.find(
        (panel) => panel.enabled && panel.kind !== "results"
    )
    const results = panels?.find(
        (panel) => panel.enabled && panel.kind === "results"
    )
    const swatch = accentColor ?? DEFAULT_HEX

    return (
        <div className="space-y-6">
            <SettingsPanel id="messages-look" title={text.lookTitle}>
                <div className="divide-y border-t">
                    <div className="pt-4 pb-4">
                        <SettingsField
                            label={
                                <label htmlFor={`${ids}-color`}>
                                    {text.clanColor}
                                </label>
                            }
                            help={text.clanColorHelp}
                        >
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="relative size-9 shrink-0 overflow-hidden rounded-lg border shadow-xs">
                                    <span
                                        aria-hidden="true"
                                        className="absolute inset-0"
                                        style={{ backgroundColor: swatch }}
                                    />
                                    <input
                                        type="color"
                                        aria-label={text.clanColorPicker}
                                        value={swatch.toLowerCase()}
                                        onChange={(event) =>
                                            update({
                                                accentColor:
                                                    event.target.value.toUpperCase(),
                                            })
                                        }
                                        className="absolute inset-0 size-full cursor-pointer opacity-0"
                                    />
                                </span>
                                <Input
                                    id={`${ids}-color`}
                                    value={draft.accentColor}
                                    onChange={(event) =>
                                        update({
                                            accentColor: event.target.value,
                                        })
                                    }
                                    placeholder={DEFAULT_HEX}
                                    spellCheck={false}
                                    autoComplete="off"
                                    maxLength={7}
                                    aria-invalid={colorInvalid || undefined}
                                    aria-describedby={`${ids}-color-note`}
                                    className="w-32 rounded-lg font-mono uppercase"
                                />
                                <span
                                    id={`${ids}-color-note`}
                                    className={cn(
                                        "basis-full text-[13px]",
                                        colorInvalid
                                            ? "text-destructive"
                                            : "text-muted-foreground"
                                    )}
                                >
                                    {colorInvalid
                                        ? text.clanColorInvalid
                                        : accentColor
                                          ? null
                                          : text.clanColorDefault}
                                </span>
                            </div>
                        </SettingsField>
                    </div>
                    <div className="py-4">
                        <SettingsField
                            label={
                                <span id={`${ids}-icons`}>{text.icons}</span>
                            }
                            help={text.iconsHelp}
                        >
                            <SegmentedControl<MessageIconDensity>
                                labelledBy={`${ids}-icons`}
                                value={draft.iconDensity}
                                onChange={(iconDensity) =>
                                    update({ iconDensity })
                                }
                                options={[
                                    {
                                        value: "sparse",
                                        label: text.iconsSparse,
                                    },
                                    { value: "rich", label: text.iconsRich },
                                ]}
                            />
                        </SettingsField>
                    </div>
                    <div className="pt-4">
                        <SettingsField label={text.language}>
                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                                <span className="font-medium">
                                    {
                                        text.languages[
                                            config?.defaultLanguage ?? "en"
                                        ]
                                    }
                                </span>
                                <span className="text-muted-foreground inline-flex items-center gap-1.5 text-[13px]">
                                    <Lock
                                        className="size-3.5"
                                        aria-hidden="true"
                                    />
                                    <span>
                                        {text.languageFrom}{" "}
                                        <Link
                                            href={hrefs.channels}
                                            className="text-foreground underline underline-offset-3"
                                        >
                                            {text.languageLink}
                                        </Link>
                                        {text.languageScope}
                                    </span>
                                </span>
                            </div>
                        </SettingsField>
                    </div>
                </div>
            </SettingsPanel>
            <section
                aria-labelledby="messages-list"
                className="bg-card overflow-hidden rounded-2xl border"
            >
                <h2
                    id="messages-list"
                    className="border-b px-5 py-4 text-base font-semibold sm:px-6"
                >
                    {text.listTitle}
                </h2>
                <ul className="divide-y">
                    <MessageRow
                        icon={Megaphone}
                        title={text.announcement}
                        detail={
                            announcement
                                ? `${announcement} · ${text.announcementDetail}`
                                : text.channelNotSet
                        }
                        warning={!announcement}
                        action={editButton("announcementsChannelId")}
                    >
                        {open === "announcementsChannelId"
                            ? channelEditor(
                                  "announcementsChannelId",
                                  text.announcementHelp
                              )
                            : null}
                    </MessageRow>
                    <MessageRow
                        icon={Users}
                        title={text.eventInfo}
                        detail={
                            eventInfo
                                ? `${eventInfo} · ${text.eventInfoDetail}`
                                : text.channelOff
                        }
                        action={editButton("eventInfoChannelId")}
                    >
                        {open === "eventInfoChannelId"
                            ? channelEditor(
                                  "eventInfoChannelId",
                                  text.eventInfoHelp
                              )
                            : null}
                    </MessageRow>
                    <MessageRow
                        icon={Bell}
                        title={text.reminders}
                        detail={text.remindersDetail}
                        action={linkButton(hrefs.matchTemplates)}
                    />
                    <MessageRow
                        icon={Radio}
                        title={text.liveScore}
                        detail={
                            live
                                ? text.liveScoreDetail
                                      .replace(
                                          "{channel}",
                                          channelLabel(live.channelId) ??
                                              text.channelUnknown
                                      )
                                      .replace(
                                          "{refresh}",
                                          live.refreshSeconds >= 120 &&
                                              live.refreshSeconds % 60 === 0
                                              ? text.minutes.replace(
                                                    "{count}",
                                                    String(
                                                        live.refreshSeconds / 60
                                                    )
                                                )
                                              : text.seconds.replace(
                                                    "{count}",
                                                    String(live.refreshSeconds)
                                                )
                                      )
                                : text.liveScoreOff
                        }
                        action={linkButton(hrefs.panels)}
                    />
                    <MessageRow
                        icon={Trophy}
                        title={text.results}
                        detail={
                            results
                                ? `${channelLabel(results.channelId) ?? text.channelUnknown} · ${text.resultsDetail}`
                                : `${text.off} · ${text.resultsDetail}`
                        }
                        action={linkButton(hrefs.panels)}
                    />
                    {enabledGames.includes("wardogs") ? (
                        <MessageRow
                            icon={CalendarDays}
                            title={text.league}
                            detail={text.leagueDetail}
                            action={linkButton(hrefs.league)}
                        />
                    ) : null}
                    <MessageRow
                        icon={Bug}
                        title={text.errors}
                        detail={
                            errors
                                ? `${errors} · ${text.errorsDetail}`
                                : text.channelOff
                        }
                        action={editButton("errorsChannelId")}
                    >
                        {open === "errorsChannelId"
                            ? channelEditor("errorsChannelId", text.errorsHelp)
                            : null}
                    </MessageRow>
                </ul>
            </section>
            <UnsavedChangesBar
                changes={changes}
                saving={saving || isPending}
                onDiscard={() => setDraft(saved)}
                onSave={() => void save()}
                dictionary={dictionary}
            />
        </div>
    )
}
