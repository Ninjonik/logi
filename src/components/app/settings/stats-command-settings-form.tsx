"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import {
    DEFAULT_STATS_COMMAND_SETTINGS,
    STATS_COMMAND_GAMES,
    type StatsCommandSettings,
} from "@/domain/player-stats/command-settings"
import {
    gameExceptions,
    showsGameExceptions,
    withGameExceptions,
} from "@/domain/workspaces/game-exceptions"
import type {
    DiscordConfig,
    GameDiscordOverrides,
    PlayerStatsServer,
} from "@/types/domain"
import { saveDiscordSettings } from "@/components/app/settings/save-discord-settings"
import { GameExceptionList } from "@/components/app/settings/game-exception-list"
import { DiscordChannelSelect } from "@/components/app/discord-channel-select"
import { useDiscordMetadata } from "@/hooks/use-discord-metadata"
import { GAME_LABELS, type GameId } from "@/domain/games/game"
import { Card, CardContent } from "@/components/ui/card"
import type { Dictionary } from "@/i18n/dictionaries"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

/**
 * `/stats` availability and the stats servers it reads. Everything applies to
 * the whole clan; a game can read its own server list instead (an exception).
 */
export function StatsCommandSettingsForm({
    serverId,
    dictionary,
    config,
    enabledGames,
}: {
    serverId: string
    dictionary: Dictionary
    /** The clan-wide settings with the stored game overrides. */
    config: DiscordConfig | null
    enabledGames: readonly GameId[]
}) {
    const router = useRouter()
    const [isPending, startTransition] = useTransition()
    const metadata = useDiscordMetadata(serverId)
    const [statsSettings, setStatsSettings] = useState<StatsCommandSettings>(
        config?.statsSettings ?? DEFAULT_STATS_COMMAND_SETTINGS
    )
    const [servers, setServers] = useState<PlayerStatsServer[]>(
        config?.playerStatsServers ?? []
    )
    const [serverExceptions, setServerExceptions] = useState(() =>
        gameExceptions<GameDiscordOverrides, "playerStatsServers">(
            config?.gameOverrides,
            "playerStatsServers",
            enabledGames
        )
    )
    const exceptionsShown = showsGameExceptions(enabledGames, [
        serverExceptions,
    ])

    async function save() {
        const result = await saveDiscordSettings(serverId, {
            statsSettings,
            playerStatsServers: servers,
            gameOverrides: withGameExceptions<
                GameDiscordOverrides,
                "playerStatsServers"
            >(
                config?.gameOverrides,
                "playerStatsServers",
                serverExceptions,
                enabledGames
            ),
        })
        if (!result.ok) {
            toast.error(
                result.error ??
                    dictionary.serverSettings.discordSettingsSaveError
            )
            return
        }
        toast.success(dictionary.serverSettings.discordSettingsSaved)
        startTransition(() => router.refresh())
    }

    return (
        <Card className="border-border/60 rounded-2xl">
            <CardContent className="space-y-8">
                <section className="space-y-4">
                    <div className="space-y-1">
                        <h3 className="font-medium">
                            {dictionary.serverSettings.statsCommandTitle}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            {dictionary.serverSettings.statsCommandDescription}
                        </p>
                    </div>
                    <div className="flex items-center justify-between gap-4">
                        <Label htmlFor="stats-command-enabled">
                            {dictionary.serverSettings.statsCommandEnabled}
                        </Label>
                        <Switch
                            id="stats-command-enabled"
                            checked={statsSettings.enabled}
                            onCheckedChange={(checked) =>
                                setStatsSettings((current) => ({
                                    ...current,
                                    enabled: checked,
                                }))
                            }
                        />
                    </div>
                    {STATS_COMMAND_GAMES.map((game) => (
                        <div
                            key={game}
                            className="flex items-center justify-between gap-4"
                        >
                            <Label htmlFor={`stats-command-${game}`}>
                                {dictionary.serverSettings.statsCommandGame.replace(
                                    "{game}",
                                    GAME_LABELS[game]
                                )}
                            </Label>
                            <Switch
                                id={`stats-command-${game}`}
                                checked={statsSettings.games[game]}
                                disabled={!statsSettings.enabled}
                                onCheckedChange={(checked) =>
                                    setStatsSettings((current) => ({
                                        ...current,
                                        games: {
                                            ...current.games,
                                            [game]: checked,
                                        },
                                    }))
                                }
                            />
                        </div>
                    ))}
                    <div className="space-y-2">
                        <Label>
                            {
                                dictionary.serverSettings
                                    .statsCommandDefaultChannel
                            }
                        </Label>
                        <DiscordChannelSelect
                            value={statsSettings.defaultShareChannelId}
                            onChange={(value) =>
                                setStatsSettings((current) => ({
                                    ...current,
                                    defaultShareChannelId: value || undefined,
                                }))
                            }
                            channels={metadata?.channels ?? []}
                            placeholder={
                                dictionary.serverSettings
                                    .statsCommandDefaultChannel
                            }
                        />
                        <p className="text-muted-foreground text-sm">
                            {
                                dictionary.serverSettings
                                    .statsCommandDefaultChannelHelp
                            }
                        </p>
                    </div>
                </section>
                <section className="border-border/60 space-y-4 border-t pt-6">
                    <div className="space-y-1">
                        <h3 className="font-medium">
                            {dictionary.serverSettings.playerStatsServersTitle}
                        </h3>
                        <p className="text-muted-foreground text-sm">
                            {
                                dictionary.serverSettings
                                    .playerStatsServersDescription
                            }
                        </p>
                    </div>
                    <StatsServerList
                        idPrefix="stats-server"
                        servers={servers}
                        onChange={setServers}
                        dictionary={dictionary}
                    />
                    {exceptionsShown ? (
                        <div className="space-y-2 pt-2">
                            <h4 className="text-sm font-medium">
                                {dictionary.settingsHub.statsServersPerGame}
                            </h4>
                            <p className="text-muted-foreground text-sm">
                                {dictionary.settingsHub.statsServersPerGameHelp}
                            </p>
                            <GameExceptionList<PlayerStatsServer[]>
                                enabledGames={enabledGames}
                                exceptions={serverExceptions}
                                onChange={setServerExceptions}
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
                </section>
                <Button
                    className="rounded-xl"
                    onClick={save}
                    disabled={isPending}
                >
                    {dictionary.serverSettings.saveDiscordSettings}
                </Button>
            </CardContent>
        </Card>
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
                    className="border-border/60 grid gap-3 rounded-2xl border p-4 md:grid-cols-[1fr_1fr_auto] md:items-end"
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
