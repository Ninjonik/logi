"use client"
import {
    DEFAULT_TRACKING_SETTINGS,
    trackingSettingsSchema,
    type TrackingSettings,
} from "@/domain/wardogs-league/discovery"
import {
    DiscordChannelSelect,
    type SelectableDiscordChannel,
} from "./discord-channel-select"
import {
    leagueReadSchema,
    type LeagueSnapshot,
} from "@/domain/wardogs-league/contracts"
import { leagueFixtureSchema } from "@/domain/wardogs-league/fixture"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
export function LeagueTrackingForm({ serverId }: { serverId: string }) {
    const locale = useLocale(),
        cs = locale === "cs",
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
            if (active)
                setMessage(
                    cs
                        ? "Nastavení nelze načíst."
                        : "Unable to load tracking settings."
                )
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
    }, [load, serverId, cs])
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
            setMessage(cs ? "Uloženo." : "Saved.")
        } catch {
            setMessage(
                cs
                    ? "Uložení selhalo. Ověř oprávnění, odkaz a nastavení místností."
                    : "Save failed. Check permissions, the link and channel settings."
            )
        } finally {
            setBusy(false)
        }
    }
    const time = (value: number | string | null | undefined) =>
        value
            ? new Intl.DateTimeFormat(cs ? "cs" : "en", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "Europe/Prague",
              }).format(new Date(value))
            : "—"
    const action = (id: string, operation: string, eventId?: string) =>
        post({
            operation,
            sourceUrl: `https://wardogsleague.net/matches/${id}`,
            ...(eventId !== undefined ? { eventId } : {}),
        })
    return (
        <section
            className="mt-6 space-y-4 rounded-xl border p-4"
            aria-label={
                cs ? "Sledování Wardogs League" : "Wardogs League tracking"
            }
        >
            <h3 className="text-lg font-semibold">
                {cs ? "Sledování Wardogs League" : "Wardogs League tracking"}
            </h3>
            <p className="text-muted-foreground text-sm">
                {cs
                    ? "Nové zápasy kontrolujeme po 10 minutách, sledované detaily po 5 minutách. Web i Discord používají stejný záznam."
                    : "Discover new fixtures every 10 minutes and refresh tracked details every 5 minutes. Website and Discord share the same record."}
            </p>
            <form
                className="space-y-3"
                onSubmit={(e) => {
                    e.preventDefault()
                    void post({
                        operation: "configure",
                        settings: {
                            ...settings,
                            teamCodes: teams
                                .split(",")
                                .map((t) => t.trim())
                                .filter(Boolean),
                        },
                    })
                }}
            >
                <label className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={settings.enabled}
                        disabled={busy}
                        onChange={(e) =>
                            setSettings({
                                ...settings,
                                enabled: e.target.checked,
                            })
                        }
                    />
                    {cs
                        ? "Zapnout sledování a Discord karty"
                        : "Enable tracking and Discord cards"}
                </label>
                <label className="block space-y-1">
                    <span>
                        {cs
                            ? "Kódy sledovaných týmů (oddělené čárkou)"
                            : "Watched team codes (comma separated)"}
                    </span>
                    <Input
                        value={teams}
                        maxLength={820}
                        disabled={busy}
                        onChange={(e) => setTeams(e.target.value)}
                    />
                </label>
                <div className="grid gap-4 md:grid-cols-2">
                    <div>
                        <p className="mb-1 text-sm">
                            {cs
                                ? "Místnost pro odkazy od lidí"
                                : "Human link intake channel"}
                        </p>
                        <DiscordChannelSelect
                            channels={channels}
                            value={settings.inputChannelId ?? undefined}
                            onChange={(v) =>
                                setSettings({
                                    ...settings,
                                    inputChannelId: v ?? null,
                                })
                            }
                            placeholder={
                                cs
                                    ? "Vybrat vstupní místnost"
                                    : "Select intake channel"
                            }
                        />
                    </div>
                    <div>
                        <p className="mb-1 text-sm">
                            {cs
                                ? "Místnost pro karty zápasů"
                                : "Match card destination"}
                        </p>
                        <DiscordChannelSelect
                            channels={channels}
                            value={settings.outputChannelId ?? undefined}
                            onChange={(v) =>
                                setSettings({
                                    ...settings,
                                    outputChannelId: v ?? null,
                                })
                            }
                            placeholder={
                                cs
                                    ? "Vybrat cílovou místnost"
                                    : "Select destination channel"
                            }
                        />
                    </div>
                </div>
                <p className="text-muted-foreground text-xs">
                    {cs
                        ? "Boty ignorujeme. Automatické čtení lidských zpráv musí provozovatel zapnout v nastavení bota (Message Content). Scan a ruční přidání fungují samostatně."
                        : "Bot messages are ignored. Automatic human-link intake requires the operator to enable Message Content. Website scanning and manual additions work independently."}
                </p>
                <Button disabled={busy} type="submit">
                    {cs ? "Uložit nastavení" : "Save settings"}
                </Button>
            </form>
            <div className="bg-muted/40 rounded-lg p-3 text-sm">
                <p>
                    {cs ? "Poslední úspěšný scan" : "Last successful scan"}:{" "}
                    {time(saved?.scan?.fetchedAt)}
                </p>
                <p>
                    {cs ? "Další scan" : "Next scan"}:{" "}
                    {time(saved?.scan?.nextScanAt)}
                </p>
                {saved?.scan?.incomplete && (
                    <p>
                        {cs
                            ? "Seznam není úplný; chybějící zápas lze přidat ručně."
                            : "Index coverage is incomplete; add a missing match manually."}
                    </p>
                )}
                {saved?.scan?.queueFull && (
                    <p role="status">
                        {cs
                            ? "Fronta automatických kandidátů je plná. Existující zápasy se dál obnovují; zbývající kapacita je vyhrazena ručnímu přidání."
                            : "Automatic discovery capacity reached. Existing fixtures still refresh; remaining slots are reserved for manual additions."}
                    </p>
                )}
                {saved?.scan?.error && (
                    <p role="status">
                        {cs
                            ? "Zdroj je nedostupný. Zachováváme poslední data."
                            : "Source unavailable. Last valid data is retained."}
                    </p>
                )}
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
                        setMessage(
                            cs
                                ? "Náhled není dostupný. Zkontroluj odkaz."
                                : "Preview unavailable. Check the match URL."
                        )
                    } finally {
                        setBusy(false)
                    }
                }}
            >
                <label className="block space-y-1">
                    <span>
                        {cs
                            ? "Přidat zápas z League URL"
                            : "Add a match by League URL"}
                    </span>
                    <Input
                        type="url"
                        required
                        value={url}
                        maxLength={250}
                        disabled={busy}
                        onChange={(e) => {
                            setUrl(e.target.value)
                            setPreview(null)
                        }}
                        placeholder="https://wardogsleague.net/matches/…"
                    />
                </label>
                <Button type="submit" variant="outline" disabled={busy}>
                    {cs ? "Načíst náhled" : "Preview match"}
                </Button>
                {preview && (
                    <div className="space-y-2 rounded border p-3">
                        <p className="font-semibold">{preview.title}</p>
                        <p>
                            {preview.teams?.map((t) => t.code).join(" · ")} ·{" "}
                            {time(preview.scheduledAt)}
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
                            {cs ? "Přidat do sledování" : "Track this match"}
                        </Button>
                    </div>
                )}
            </form>
            <p className="text-sm">
                <a
                    className="underline"
                    href={`/${locale}/dashboard/servers/${serverId}/events/create?game=wardogs`}
                >
                    {cs
                        ? "Vytvořit vlastní zápas v Logim"
                        : "Create a native Logi match"}
                </a>
            </p>
            <div aria-live="polite" role="status" className="text-sm">
                {message}
            </div>
            <div className="space-y-3">
                {saved?.records.map((record) => (
                    <article
                        key={record.id}
                        className="space-y-2 rounded-lg border p-3"
                    >
                        <div className="flex flex-wrap justify-between gap-2">
                            <a
                                className="font-medium underline"
                                target="_blank"
                                rel="noopener noreferrer"
                                href={`https://wardogsleague.net/matches/${record.id}`}
                            >
                                {record.fixture?.snapshot.title ?? record.id}
                            </a>
                            <span className="text-sm">
                                {
                                    (
                                        {
                                            pending: cs
                                                ? "Čeká na načtení"
                                                : "Pending",
                                            tracked: cs
                                                ? "Sledováno"
                                                : "Tracking",
                                            paused: cs
                                                ? "Pozastaveno"
                                                : "Paused",
                                            ignored: cs
                                                ? "Ignorováno"
                                                : "Ignored",
                                            archived: cs
                                                ? "Archiv"
                                                : "Archived",
                                            unmatched: cs
                                                ? "Mimo filtr"
                                                : "Outside filter",
                                        } as Record<string, string>
                                    )[record.state]
                                }
                            </span>
                        </div>
                        <p className="text-sm">
                            {time(record.fixture?.snapshot.scheduledAt)} ·{" "}
                            {record.fixture?.snapshot.teams
                                ?.map((t) => t.code)
                                .join(" · ")}
                        </p>
                        {record.fixture?.stale && (
                            <p className="text-sm text-amber-600">
                                {cs
                                    ? "Starší data, poslední načtení"
                                    : "Stale data, last fetched"}
                                : {time(record.fixture.snapshot.fetchedAt)}
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
                                    ? cs
                                        ? "Znovu načíst"
                                        : "Refresh once"
                                    : record.paused || record.ignored
                                      ? cs
                                          ? "Obnovit"
                                          : "Resume"
                                      : cs
                                        ? "Pozastavit"
                                        : "Pause"}
                            </Button>
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || record.ignored}
                                onClick={() => void action(record.id, "ignore")}
                            >
                                {cs ? "Ignorovat" : "Ignore"}
                            </Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <Input
                                className="max-w-sm"
                                aria-label={
                                    cs
                                        ? "ID existujícího Logi zápasu"
                                        : "Existing Logi event ID"
                                }
                                placeholder={
                                    cs
                                        ? "ID existujícího Logi zápasu (volitelné)"
                                        : "Existing Logi event ID (optional)"
                                }
                                value={
                                    bindings[record.id] ?? record.eventId ?? ""
                                }
                                maxLength={100}
                                onChange={(e) =>
                                    setBindings({
                                        ...bindings,
                                        [record.id]: e.target.value,
                                    })
                                }
                            />
                            <Button
                                size="sm"
                                variant="outline"
                                disabled={busy}
                                onClick={() =>
                                    void action(
                                        record.id,
                                        "link",
                                        bindings[record.id] ??
                                            record.eventId ??
                                            ""
                                    )
                                }
                            >
                                {cs ? "Uložit propojení" : "Save event link"}
                            </Button>
                        </div>
                    </article>
                ))}
            </div>
        </section>
    )
}
