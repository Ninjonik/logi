"use client"

import { ArrowRight, ChevronDown } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { GameExceptionList } from "@/components/app/settings/game-exception-list"
import { SettingsPanel } from "@/components/app/settings/settings-panel"
import type { PlayerStatsServer } from "@/types/domain"
import type { Dictionary } from "@/i18n/dictionaries"
import type { GameId } from "@/domain/games/game"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

export type LegacyServerExceptions = Partial<
    Record<GameId, PlayerStatsServer[]>
>

/**
 * "Stará připojení ke stats serverům · 2" (N3-05..07): the old CRCON player
 * search connections with "Převést do Herních serverů", which stores each
 * key encrypted as a game server to test (N3-B09), and "Zobrazit připojení".
 */
export function LegacyStatsConnections({
    serverId,
    servers,
    exceptions,
    enabledGames,
    exceptionsShown,
    onServersChange,
    onExceptionsChange,
    dictionary,
}: {
    serverId: string
    servers: PlayerStatsServer[]
    exceptions: LegacyServerExceptions
    enabledGames: readonly GameId[]
    exceptionsShown: boolean
    onServersChange(servers: PlayerStatsServer[]): void
    onExceptionsChange(exceptions: LegacyServerExceptions): void
    dictionary: Dictionary
}) {
    const text = dictionary.settingsHub.commandsPage.legacy
    const [open, setOpen] = useState(false)
    const [busy, setBusy] = useState(false)
    const count =
        servers.length +
        Object.values(exceptions).reduce(
            (sum, list) => sum + (list?.length ?? 0),
            0
        )
    if (!count) return null

    async function convert() {
        setBusy(true)
        try {
            const response = await fetch(
                `/api/servers/${serverId}/discord-commands`,
                {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ action: "convertLegacy" }),
                }
            )
            const body = (await response.json().catch(() => null)) as {
                converted?: number
                skipped?: number
                error?: string
            } | null
            if (body?.error === "encryption_unavailable") {
                toast.error(text.encryptionUnavailable)
                return
            }
            if (!response.ok || !body) throw new Error("conversion failed")
            const converted = body.converted ?? 0
            if (converted)
                toast.success(
                    text.converted.replace("{converted}", String(converted))
                )
            else toast.message(text.nothingToConvert)
            if (body.skipped)
                toast.message(
                    text.skipped.replace("{count}", String(body.skipped))
                )
        } catch {
            toast.error(text.failed)
        } finally {
            setBusy(false)
        }
    }

    return (
        <SettingsPanel
            id="commands-legacy"
            title={text.title.replace("{count}", String(count))}
            description={text.help}
            className="border-amber-300 bg-amber-50 dark:border-amber-500/40 dark:bg-amber-500/10 [&_h2]:text-amber-900 dark:[&_h2]:text-amber-100"
        >
            <div className="flex flex-wrap items-center gap-2">
                <Button
                    type="button"
                    variant="outline"
                    className="rounded-xl"
                    disabled={busy}
                    onClick={() => void convert()}
                >
                    {text.convert}
                    <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    className="rounded-xl"
                    aria-expanded={open}
                    aria-controls="commands-legacy-list"
                    onClick={() => setOpen((value) => !value)}
                >
                    {open ? text.hide : text.show}
                    <ChevronDown
                        className={cn(
                            "size-4 transition-transform",
                            open && "rotate-180"
                        )}
                        aria-hidden="true"
                    />
                </Button>
            </div>
            {open ? (
                <div id="commands-legacy-list" className="space-y-3">
                    <StatsServerList
                        idPrefix="stats-server"
                        servers={servers}
                        onChange={onServersChange}
                        dictionary={dictionary}
                    />
                    {exceptionsShown ? (
                        <div className="space-y-2 pt-2">
                            <h3 className="text-sm font-medium">
                                {dictionary.settingsHub.statsServersPerGame}
                            </h3>
                            <p className="text-muted-foreground text-sm">
                                {dictionary.settingsHub.statsServersPerGameHelp}
                            </p>
                            <GameExceptionList<PlayerStatsServer[]>
                                enabledGames={enabledGames}
                                exceptions={exceptions}
                                onChange={onExceptionsChange}
                                emptyValue={[{ token: "", url: "" }]}
                                canAdd={enabledGames.length > 1}
                                dictionary={dictionary}
                                renderValue={(game, value, setValue) => (
                                    <StatsServerList
                                        idPrefix={`stats-server-${game}`}
                                        servers={value ?? []}
                                        onChange={setValue}
                                        dictionary={dictionary}
                                    />
                                )}
                            />
                        </div>
                    ) : null}
                </div>
            ) : null}
        </SettingsPanel>
    )
}

/** Editable stats server rows with add and remove. */
function StatsServerList({
    idPrefix,
    servers,
    onChange,
    dictionary,
}: {
    idPrefix: string
    servers: PlayerStatsServer[]
    onChange: (servers: PlayerStatsServer[]) => void
    dictionary: Dictionary
}) {
    function updateServer(index: number, patch: Partial<PlayerStatsServer>) {
        onChange(
            servers.map((server, serverIndex) =>
                serverIndex === index ? { ...server, ...patch } : server
            )
        )
    }

    return (
        <div className="space-y-3">
            {servers.map((server, index) => (
                <div
                    key={index}
                    className="border-border/60 bg-background grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
                >
                    <div className="space-y-2">
                        <Label htmlFor={`${idPrefix}-${index}-url`}>
                            {dictionary.serverSettings.playerStatsServerUrl}
                        </Label>
                        <Input
                            id={`${idPrefix}-${index}-url`}
                            value={server.url}
                            onChange={(event) =>
                                updateServer(index, { url: event.target.value })
                            }
                            placeholder={
                                dictionary.serverSettings
                                    .playerStatsServerUrlPlaceholder
                            }
                            className="rounded-xl"
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor={`${idPrefix}-${index}-token`}>
                            {dictionary.serverSettings.playerStatsServerToken}
                        </Label>
                        <Input
                            id={`${idPrefix}-${index}-token`}
                            type="password"
                            autoComplete="off"
                            value={server.token}
                            onChange={(event) =>
                                updateServer(index, {
                                    token: event.target.value,
                                })
                            }
                            placeholder={
                                dictionary.serverSettings
                                    .playerStatsServerTokenPlaceholder
                            }
                            className="rounded-xl"
                        />
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        className="rounded-xl"
                        onClick={() =>
                            onChange(
                                servers.filter(
                                    (_, serverIndex) => serverIndex !== index
                                )
                            )
                        }
                    >
                        {dictionary.serverSettings.removePlayerStatsServer}
                    </Button>
                </div>
            ))}
            <Button
                type="button"
                variant="outline"
                className="rounded-xl"
                onClick={() => onChange([...servers, { token: "", url: "" }])}
            >
                {dictionary.serverSettings.addPlayerStatsServer}
            </Button>
        </div>
    )
}
