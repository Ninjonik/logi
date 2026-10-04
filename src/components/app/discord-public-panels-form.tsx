"use client"
import {
    publicPanelSettingsSchema,
    type PublicPanelSettings,
} from "@/domain/discord-publications/settings"
import {
    DiscordChannelSelect,
    type SelectableDiscordChannel,
} from "./discord-channel-select"
import {
    gameDataSettingsSchema,
    type ServerSnapshot,
} from "@/domain/game-data/contracts"
import { useCallback, useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { useLocale } from "next-intl"
type SavedPanel = PublicPanelSettings & {
    _id: string
    guildId: string
    publications: {
        channelId: string | null
        messageId: string | null
        lastSuccessAt: number | null
        error: string | null
        pending: boolean
    }[]
}
const defaults: PublicPanelSettings = {
    kind: "server",
    connectionId: "",
    channelId: "",
    enabled: true,
    showPlayers: false,
    showLeaders: false,
    artwork: true,
    refreshSeconds: 60,
}
export function DiscordPublicPanelsForm({
    serverId,
    gameId,
}: {
    serverId: string
    gameId?: string
}) {
    const cs = useLocale() === "cs"
    const [channels, setChannels] = useState<SelectableDiscordChannel[]>([]),
        [sources, setSources] = useState<
            {
                id: string
                name: string
                gameId: string
                snapshot: ServerSnapshot
            }[]
        >([])
    const [panels, setPanels] = useState<SavedPanel[]>([]),
        [settings, setSettings] = useState(defaults),
        [message, setMessage] = useState(""),
        [busy, setBusy] = useState(false)
    const [reportCategories, setReportCategories] = useState<
        { id: string; label: string; parentChannelId: string | null }[]
    >([])
    const base = `/api/servers/${serverId}/discord-public-panels`
    const load = useCallback(async () => {
        try {
            const responses = await Promise.all([
                fetch(base),
                fetch(`/api/servers/${serverId}/discord-metadata`),
                fetch(`/api/servers/${serverId}/game-data`),
            ])
            if (responses.some((r) => !r.ok)) throw new Error()
            const [saved, metadata, data] = await Promise.all(
                responses.map((r) => r.json())
            )
            const parsed = gameDataSettingsSchema.parse(data)
            setPanels(saved.panels)
            setReportCategories(saved.reportCategories ?? [])
            setChannels(metadata.channels)
            setSources(
                parsed.connections
                    .filter((c) => !gameId || c.snapshot.gameId === gameId)
                    .map((c) => ({
                        id: c.snapshot.id,
                        name: c.snapshot.displayName ?? c.sourceRef,
                        gameId: c.snapshot.gameId,
                        snapshot: c.snapshot,
                    }))
            )
        } catch {
            setMessage(
                cs
                    ? "Nelze načíst panely. Ověř přístup bota a zdroje dat."
                    : "Cannot load panels. Check bot access and data sources."
            )
        }
    }, [base, serverId, gameId, cs])
    useEffect(() => {
        // load updates state only after awaiting HTTP responses.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        void load()
    }, [load])
    async function save(verify = false) {
        const parsed = publicPanelSettingsSchema.safeParse(settings)
        if (!parsed.success) {
            setMessage(
                cs
                    ? "Vyber zdroj a platné ID místnosti."
                    : "Select a source and valid channel ID."
            )
            return
        }
        setBusy(true)
        try {
            const response = await fetch(
                `${base}${verify ? "?verify=1" : ""}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(parsed.data),
                }
            )
            const result = await response.json()
            if (!response.ok) throw new Error(result.error)
            setMessage(
                verify
                    ? cs
                        ? "Bot má potřebná oprávnění."
                        : "Bot permissions verified."
                    : cs
                      ? "Uloženo. Bot změnu načte do 15 sekund; případný přesun čeká na odstranění původní zprávy."
                      : "Saved. Bot picks up changes within 15 seconds; moves wait for removal of the original message."
            )
            await load()
        } catch (error) {
            setMessage(
                error instanceof Error ? error.message : "Request failed."
            )
        } finally {
            setBusy(false)
        }
    }
    const label = (kind: string) =>
        kind === "server"
            ? cs
                ? "Server + skóre"
                : "Server + score"
            : kind === "scoreboard"
              ? cs
                  ? "Samostatné skóre"
                  : "Separate scoreboard"
              : cs
                ? "Potvrzené výsledky"
                : "Confirmed results"
    const preview = sources.find(
        (source) => source.id === settings.connectionId
    )?.snapshot
    return (
        <section
            className="space-y-4 rounded-xl border p-4"
            aria-label={cs ? "Veřejné Discord panely" : "Public Discord panels"}
        >
            <div className="flex justify-between gap-4">
                <h3 className="font-semibold">
                    {cs ? "Veřejné panely" : "Public panels"}
                </h3>
                <Button
                    type="button"
                    variant="outline"
                    onClick={() => void load()}
                >
                    {cs
                        ? "Obnovit místnosti a stav"
                        : "Refresh channels and status"}
                </Button>
            </div>
            <p className="text-muted-foreground text-sm">
                {cs
                    ? "Jeden kompaktní panel na zdroj. Samostatné skóre vytvoř jen v další místnosti. Výsledky se zveřejňují až po potvrzení v Logim; historické výsledky se zpětně neposílají."
                    : "One compact panel per source. Use a separate scoreboard only in another channel. Results publish after review in Logi; historic results are not backfilled."}
            </p>
            <div className="grid gap-3 md:grid-cols-2">
                <label>
                    {cs ? "Funkce" : "Feature"}
                    <select
                        className="bg-background block w-full rounded border p-2"
                        value={settings.kind}
                        onChange={(e) =>
                            setSettings((s) => ({
                                ...s,
                                kind: e.target
                                    .value as PublicPanelSettings["kind"],
                                ...(e.target.value === "results"
                                    ? { reportCategoryId: "" }
                                    : {}),
                            }))
                        }
                    >
                        {["server", "scoreboard", "results"].map((k) => (
                            <option key={k} value={k}>
                                {label(k)}
                            </option>
                        ))}
                    </select>
                </label>
                <label>
                    {cs ? "Zdroj dat" : "Data source"}
                    <select
                        className="bg-background block w-full rounded border p-2"
                        value={settings.connectionId}
                        onChange={(e) =>
                            setSettings((s) => ({
                                ...s,
                                connectionId: e.target.value,
                            }))
                        }
                    >
                        <option value="">
                            {cs ? "Vyber zdroj" : "Select source"}
                        </option>
                        {sources.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.name} · {s.gameId}
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <DiscordChannelSelect
                channels={channels}
                value={settings.channelId}
                onChange={(channelId) =>
                    setSettings((s) => ({ ...s, channelId: channelId ?? "" }))
                }
                placeholder={cs ? "Cílová místnost" : "Destination channel"}
            />
            <div className="flex flex-wrap gap-4">
                <label>
                    {cs
                        ? "Report Player · kategorie soukromého ticketu"
                        : "Report Player · private ticket category"}
                    <select
                        className="bg-background block rounded border p-2"
                        value={settings.reportCategoryId ?? ""}
                        onChange={(e) =>
                            setSettings((s) => ({
                                ...s,
                                reportCategoryId: e.target.value,
                            }))
                        }
                        disabled={settings.kind === "results"}
                    >
                        <option value="">{cs ? "Vypnuto" : "Disabled"}</option>
                        {reportCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.label} ·{" "}
                                {channels.find(
                                    (ch) => ch.id === c.parentChannelId
                                )?.name ??
                                    c.parentChannelId ??
                                    "—"}
                            </option>
                        ))}
                    </select>
                    <p className="text-muted-foreground text-xs">
                        {cs
                            ? "Místnost a role správců nastavíš v sekci Tickety. Bot před odesláním ověří soukromí a přístup."
                            : "Choose the destination channel and staff roles in Tickets. The bot checks privacy and access before submission."}
                    </p>
                </label>
                {(
                    [
                        "enabled",
                        "showPlayers",
                        "showLeaders",
                        "artwork",
                    ] as const
                ).map((key) => (
                    <label key={key} className="flex gap-2">
                        <input
                            type="checkbox"
                            checked={settings[key]}
                            onChange={(e) =>
                                setSettings((s) => ({
                                    ...s,
                                    [key]: e.target.checked,
                                }))
                            }
                        />
                        {key === "enabled"
                            ? cs
                                ? "Zapnuto"
                                : "Enabled"
                            : key === "showPlayers"
                              ? cs
                                  ? "Soukromý detail hráčů (Warcon / CRCON)"
                                  : "Private player details (Warcon / CRCON)"
                              : key === "showLeaders"
                                ? cs
                                    ? "Veřejní TOP hráči (jména + statistiky)"
                                    : "Public leaders (names + stats)"
                                : cs
                                  ? "Mapa / banner"
                                  : "Map / banner"}
                    </label>
                ))}
                <label>
                    {cs ? "Obnova" : "Refresh"}{" "}
                    <select
                        className="bg-background rounded border"
                        value={settings.refreshSeconds}
                        onChange={(e) =>
                            setSettings((s) => ({
                                ...s,
                                refreshSeconds: Number(e.target.value) as
                                    30 | 60 | 300,
                            }))
                        }
                    >
                        {[30, 60, 300].map((n) => (
                            <option key={n} value={n}>
                                {n} s
                            </option>
                        ))}
                    </select>
                </label>
            </div>
            <div className="flex gap-2">
                <Button
                    type="button"
                    disabled={busy}
                    onClick={() => void save()}
                >
                    {cs ? "Uložit / obnovit panel" : "Save / refresh panel"}
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    disabled={busy}
                    onClick={() => void save(true)}
                >
                    {cs ? "Ověřit místnost" : "Verify channel"}
                </Button>
            </div>
            <p role="status" className="text-sm">
                {message}
            </p>
            {preview && settings.kind !== "results" && (
                <details className="rounded border p-3 text-sm">
                    <summary>
                        {cs ? "Náhled dat panelu" : "Panel data preview"}
                    </summary>
                    <p className="mt-2 font-semibold">
                        {preview.displayName ?? "—"}
                    </p>
                    <p>
                        {preview.map ?? "—"} · {preview.players ?? "—"}/
                        {preview.capacity ?? "—"}
                    </p>
                    {preview.scores?.slice(0, 8).map((score, index) => (
                        <p key={index}>
                            {score.label}: {score.score ?? "—"}
                        </p>
                    ))}
                    <p>
                        {preview.freshness} · {preview.observedAt ?? "—"}
                    </p>
                </details>
            )}
            {panels
                .filter((p) => sources.some((s) => s.id === p.connectionId))
                .map((p) => (
                    <div key={p._id} className="rounded border p-3 text-sm">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() =>
                                setSettings(
                                    publicPanelSettingsSchema.strip().parse(p)
                                )
                            }
                        >
                            {label(p.kind)} · {p.enabled ? "●" : "⏸"} · #
                            {channels.find((c) => c.id === p.channelId)?.name ??
                                p.channelId}
                        </Button>
                        {p.publications.map((state, index) => (
                            <p key={index}>
                                {state.messageId && state.channelId && (
                                    <a
                                        className="underline"
                                        target="_blank"
                                        rel="noreferrer"
                                        href={`https://discord.com/channels/${p.guildId}/${state.channelId}/${state.messageId}`}
                                    >
                                        {cs ? "Zpráva" : "Message"}
                                    </a>
                                )}{" "}
                                ·{" "}
                                {state.lastSuccessAt
                                    ? new Date(
                                          state.lastSuccessAt
                                      ).toLocaleString()
                                    : cs
                                      ? "Čeká na bota"
                                      : "Awaiting bot"}{" "}
                                {state.pending
                                    ? "· pending reconciliation"
                                    : ""}{" "}
                                {state.error}
                            </p>
                        ))}
                    </div>
                ))}
        </section>
    )
}
