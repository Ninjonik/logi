"use client"
import {
    DEFAULT_TRACKING_SETTINGS,
    REFRESH_MINUTES,
    SCAN_MINUTES,
    trackingSettingsSchema,
    type TrackingSettings,
} from "@/domain/wardogs-league/discovery"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DiscordChannelSelect,
    type SelectableDiscordChannel,
} from "./discord-channel-select"
import {
    leagueReadSchema,
    type LeagueSnapshot,
} from "@/domain/wardogs-league/contracts"
import { leagueFixtureSchema } from "@/domain/wardogs-league/fixture"
import { useCallback, useEffect, useId, useState } from "react"
import { EmptyState } from "@/components/app/empty-state"
import type { Dictionary } from "@/i18n/dictionaries"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Trophy } from "lucide-react"
import { useLocale } from "next-intl"
import { z } from "zod"
const savedSchema = z.object({
    settings: trackingSettingsSchema,
    scan: z
        .object({
            fetchedAt: z.number().nullable(),
            nextScanAt: z.number(),
            error: z.string().nullable(),
            incomplete: z.boolean(),
            queueFull: z.boolean(),
        })
        .nullable(),
    records: z.array(
        z.object({
            id: z.string(),
            state: z.string(),
            pinned: z.boolean(),
            ignored: z.boolean(),
            paused: z.boolean(),
            eventId: z.string().nullable(),
            fixture: leagueFixtureSchema.nullable(),
            error: z.string().nullable(),
        })
    ),
})
type Saved = z.infer<typeof savedSchema>
/** A Logi match a tracked fixture can be linked to. */
export type LeagueLinkableEvent = { id: string; name: string; startsAt: string }
const NOT_LINKED = "none"
const STATES = [
    "pending",
    "tracked",
    "paused",
    "ignored",
    "archived",
    "unmatched",
] as const
function isKnownState(value: string): value is (typeof STATES)[number] {
    return (STATES as readonly string[]).includes(value)
}
export function LeagueTrackingForm({
    serverId,
    dictionary,
    events,
}: {
    serverId: string
    dictionary: Dictionary
    /** The clan's Wardogs matches, newest first. */
    events: LeagueLinkableEvent[]
}) {
    const t = dictionary.integrationSettings.league
    const locale = useLocale(),
        id = useId(),
        base = `/api/servers/${serverId}/league-tracking`
    const [settings, setSettings] = useState<TrackingSettings>(
            DEFAULT_TRACKING_SETTINGS
        ),
        [teams, setTeams] = useState("VLK"),
        [saved, setSaved] = useState<Saved | null>(null),
        [channels, setChannels] = useState<SelectableDiscordChannel[]>([])
    const [busy, setBusy] = useState(false),
        [message, setMessage] = useState(""),
        [url, setUrl] = useState(""),
        [preview, setPreview] = useState<LeagueSnapshot | null>(null),
        [bindings, setBindings] = useState<Record<string, string>>({})
    const load = useCallback(
        async (updateSettings = false) => {
            const response = await fetch(base, { cache: "no-store" })
            if (!response.ok) throw new Error()
            const value = savedSchema.parse(await response.json())
            setSaved(value)
            if (updateSettings) {
                setSettings(value.settings)
                setTeams(value.settings.teamCodes.join(", "))
            }
        },
        [base]
    )
    useEffect(() => {
        let active = true
        void load(true).catch(() => {
            if (active) setMessage(t.loadFailed)
        })
        void fetch(`/api/servers/${serverId}/discord-metadata`)
            .then((r) => (r.ok ? r.json() : null))
            .then((v) => {
                if (active && v?.channels) setChannels(v.channels)
            })
            .catch(() => {})
        const timer = setInterval(() => {
            if (document.visibilityState === "visible")
                void load().catch(() => {})
        }, 15000)
        return () => {
            active = false
            clearInterval(timer)
        }
    }, [load, serverId, t])
    const post = async (body: unknown) => {
        setBusy(true)
        setMessage("")
        try {
            const response = await fetch(base, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            })
            if (!response.ok) throw new Error()
            await load()
            setMessage(t.saved)
        } catch {
            setMessage(t.saveFailed)
        } finally {
            setBusy(false)
        }
    }
    const time = (value: number | string | null | undefined) =>
        value
            ? new Intl.DateTimeFormat(locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Europe/Prague",
              }).format(new Date(value))
            : "—"
    const action = (recordId: string, operation: string, eventId?: string) =>
        post({
            operation,
            sourceUrl: `https://wardogsleague.net/matches/${recordId}`,
            ...(eventId !== undefined ? { eventId } : {}),
        })
    const minutes = (value: number) =>
        t.minutes.replace("{minutes}", String(value))
    return (
        <section
            className="space-y-4 rounded-xl border p-4"
            aria-labelledby={`${id}-title`}
        >
            <h3 id={`${id}-title`} className="text-lg font-semibold">
                {t.title}
            </h3>
            <p className="text-muted-foreground text-sm">
                {t.cadence
                    .replace("{scan}", String(settings.scanMinutes))
                    .replace("{refresh}", String(settings.refreshMinutes))}
            </p>
            <form
                className="space-y-4"
                onSubmit={(e) => {
                    e.preventDefault()
                    void post({
                        operation: "configure",
                        settings: {
                            ...settings,
                            teamCodes: teams
                                .split(",")
                                .map((code) => code.trim())
                                .filter(Boolean),
                        },
                    })
                }}
            >
                <div className="flex items-center gap-2">
                    <Checkbox
                        id={`${id}-enabled`}
                        checked={settings.enabled}
                        disabled={busy}
                        onCheckedChange={(checked) =>
                            setSettings({
                                ...settings,
                                enabled: checked === true,
                            })
                        }
                    />
                    <Label htmlFor={`${id}-enabled`} className="font-normal">
                        {t.enable}
                    </Label>
                </div>
                <div className="space-y-2">
                    <Label htmlFor={`${id}-teams`}>{t.teamCodes}</Label>
                    <Input
                        id={`${id}-teams`}
                        value={teams}
                        maxLength={820}
                        disabled={busy}
                        onChange={(e) => setTeams(e.target.value)}
                    />
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-scan`}>{t.scanEvery}</Label>
                        <Select
                            value={String(settings.scanMinutes)}
                            disabled={busy}
                            onValueChange={(value) => {
                                const scanMinutes = SCAN_MINUTES.find(
                                    (entry) => String(entry) === value
                                )
                                if (scanMinutes)
                                    setSettings({ ...settings, scanMinutes })
                            }}
                        >
                            <SelectTrigger id={`${id}-scan`} className="w-full">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {SCAN_MINUTES.map((value) => (
                                    <SelectItem
                                        key={value}
                                        value={String(value)}
                                    >
                                        {minutes(value)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${id}-refresh`}>
                            {t.refreshEvery}
                        </Label>
                        <Select
                            value={String(settings.refreshMinutes)}
                            disabled={busy}
                            onValueChange={(value) => {
                                const refreshMinutes = REFRESH_MINUTES.find(
                                    (entry) => String(entry) === value
                                )
                                if (refreshMinutes)
                                    setSettings({ ...settings, refreshMinutes })
                            }}
                        >
                            <SelectTrigger
                                id={`${id}-refresh`}
                                className="w-full"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {REFRESH_MINUTES.map((value) => (
                                    <SelectItem
                                        key={value}
                                        value={String(value)}
                                    >
                                        {minutes(value)}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <p className="text-muted-foreground text-xs">{t.scanNote}</p>
                <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                        <p className="text-sm font-medium">{t.intakeChannel}</p>
                        <DiscordChannelSelect
                            channels={channels}
                            value={settings.inputChannelId ?? undefined}
                            onChange={(v) =>
                                setSettings({
                                    ...settings,
                                    inputChannelId: v ?? null,
                                })
                            }
                            placeholder={t.intakePlaceholder}
                        />
                    </div>
                </div>
                <p className="text-muted-foreground text-xs">{t.intakeNote}</p>
                <p className="text-muted-foreground text-xs">{t.panelsNote}</p>
                <Button disabled={busy} type="submit">
                    {t.save}
                </Button>
            </form>
            <div className="bg-muted/40 space-y-1 rounded-lg p-3 text-sm">
                <p>
                    {t.lastScan}: {time(saved?.scan?.fetchedAt)}
                </p>
                <p>
                    {t.nextScan}: {time(saved?.scan?.nextScanAt)}
                </p>
                {saved?.scan?.incomplete && <p>{t.incomplete}</p>}
                {saved?.scan?.queueFull && <p role="status">{t.queueFull}</p>}
                {saved?.scan?.error && <p role="status">{t.sourceError}</p>}
            </div>
            <form
                className="space-y-2 border-t pt-4"
                onSubmit={async (e) => {
                    e.preventDefault()
                    setBusy(true)
                    setPreview(null)
                    setMessage("")
                    try {
                        const r = await fetch(
                            `/api/servers/${serverId}/league-matches?${new URLSearchParams({ game: "wardogs", url: url.trim() })}`
                        )
                        const body = await r.json()
                        const read = leagueReadSchema.parse(body.data)
                        if (!r.ok || !read.snapshot) throw new Error()
                        setPreview(read.snapshot)
                    } catch {
                        setMessage(t.previewFailed)
                    } finally {
                        setBusy(false)
                    }
                }}
            >
                <Label htmlFor={`${id}-url`}>{t.addByUrl}</Label>
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Input
                        id={`${id}-url`}
                        type="url"
                        required
                        value={url}
                        maxLength={250}
                        disabled={busy}
                        className="flex-1"
                        onChange={(e) => {
                            setUrl(e.target.value)
                            setPreview(null)
                        }}
                        placeholder="https://wardogsleague.net/matches/…"
                    />
                    <Button type="submit" variant="outline" disabled={busy}>
                        {t.preview}
                    </Button>
                </div>
                {preview && (
                    <div className="space-y-2 rounded-lg border p-3">
                        <p className="font-semibold">{preview.title}</p>
                        <p className="text-sm">
                            {preview.teams
                                ?.map((team) => team.code)
                                .join(" · ")}{" "}
                            · {time(preview.scheduledAt)}
                        </p>
                        <Button
                            type="button"
                            disabled={busy || !saved?.settings.enabled}
                            onClick={() =>
                                void post({
                                    operation: "add",
                                    sourceUrl: preview.sourceUrl,
                                })
                            }
                        >
                            {t.track}
                        </Button>
                    </div>
                )}
            </form>
            <p className="text-sm">
                <a
                    className="text-primary font-medium underline-offset-4 hover:underline"
                    href={`/${locale}/dashboard/servers/${serverId}/events/create?game=wardogs`}
                >
                    {t.createNative}
                </a>
            </p>
            <div aria-live="polite" role="status" className="text-sm">
                {message}
            </div>
            {saved && saved.records.length === 0 ? (
                <EmptyState
                    icon={Trophy}
                    title={t.emptyTitle}
                    description={t.emptyDescription}
                />
            ) : null}
            <div className="space-y-3">
                {saved?.records.map((record) => {
                    const linked = bindings[record.id] ?? record.eventId ?? ""
                    const linkedKnown = events.some(
                        (event) => event.id === linked
                    )
                    return (
                        <article
                            key={record.id}
                            className="space-y-3 rounded-lg border p-3"
                        >
                            <div className="flex flex-wrap justify-between gap-2">
                                <a
                                    className="font-medium break-words underline"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    href={`https://wardogsleague.net/matches/${record.id}`}
                                >
                                    {record.fixture?.snapshot.title ??
                                        record.id}
                                </a>
                                <span className="text-muted-foreground text-sm">
                                    {isKnownState(record.state)
                                        ? t.states[record.state]
                                        : record.state}
                                </span>
                            </div>
                            <p className="text-sm">
                                {time(record.fixture?.snapshot.scheduledAt)} ·{" "}
                                {record.fixture?.snapshot.teams
                                    ?.map((team) => team.code)
                                    .join(" · ")}
                            </p>
                            {record.fixture?.stale && (
                                <p className="text-sm text-amber-700 dark:text-amber-400">
                                    {t.staleData.replace(
                                        "{time}",
                                        time(record.fixture.snapshot.fetchedAt)
                                    )}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy}
                                    onClick={() =>
                                        void action(
                                            record.id,
                                            record.paused ||
                                                record.ignored ||
                                                record.state === "archived"
                                                ? "resume"
                                                : "pause"
                                        )
                                    }
                                >
                                    {record.state === "archived"
                                        ? t.refreshOnce
                                        : record.paused || record.ignored
                                          ? t.resume
                                          : t.pause}
                                </Button>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    disabled={busy || record.ignored}
                                    onClick={() =>
                                        void action(record.id, "ignore")
                                    }
                                >
                                    {t.ignore}
                                </Button>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor={`${id}-${record.id}-event`}>
                                    {t.linkedEvent}
                                </Label>
                                <div className="flex flex-col gap-2 sm:flex-row">
                                    <Select
                                        value={linked || NOT_LINKED}
                                        disabled={busy}
                                        onValueChange={(value) =>
                                            setBindings({
                                                ...bindings,
                                                [record.id]:
                                                    value === NOT_LINKED
                                                        ? ""
                                                        : value,
                                            })
                                        }
                                    >
                                        <SelectTrigger
                                            id={`${id}-${record.id}-event`}
                                            className="w-full sm:max-w-sm"
                                        >
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value={NOT_LINKED}>
                                                {t.notLinked}
                                            </SelectItem>
                                            {linked && !linkedKnown ? (
                                                <SelectItem value={linked}>
                                                    {t.unknownEvent}
                                                </SelectItem>
                                            ) : null}
                                            {events.map((event) => (
                                                <SelectItem
                                                    key={event.id}
                                                    value={event.id}
                                                >
                                                    {event.name} ·{" "}
                                                    {time(event.startsAt)}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="self-start sm:self-auto"
                                        disabled={
                                            busy ||
                                            linked === (record.eventId ?? "")
                                        }
                                        onClick={() =>
                                            void action(
                                                record.id,
                                                "link",
                                                linked
                                            )
                                        }
                                    >
                                        {t.saveLink}
                                    </Button>
                                </div>
                                {events.length === 0 ? (
                                    <p className="text-muted-foreground text-xs">
                                        {t.noEvents}
                                    </p>
                                ) : null}
                            </div>
                        </article>
                    )
                })}
            </div>
        </section>
    )
}
